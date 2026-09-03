import { Path } from 'app/modules/editor/model/paths';

/**
 * Converts a filled path (e.g. a Google Material icon, where each glyph is a
 * single filled outline) into a set of stroked centerline paths. Filled icons
 * are drawn as outlines of uniform-width strokes; this module recovers the
 * original centerlines so each visual "stroke" can become its own path layer
 * with a real strokeWidth. That makes the icon much easier to animate
 * (trim path, morphing between simple primitives, etc.).
 *
 * The approach is a boundary-sampling approximation of the medial axis:
 *
 *   1. Flatten every subpath into a polygon and resample it uniformly.
 *   2. For each boundary sample, cast a ray inward along the normal to the
 *      opposite boundary. The midpoint is a centerline sample and the ray
 *      length is the local stroke width.
 *   3. The dominant (median) width is the icon's stroke width. Samples whose
 *      local width matches it are linked into centerline chains; the rest
 *      (junctions, blobs) break the chains.
 *   4. Each physical stroke is traced once from each of its two sides, so
 *      near-duplicate chains are removed. Chains interrupted by junctions
 *      are merged back together when the gap between them lies inside the
 *      filled region.
 *   5. Each chain is fitted to a primitive: full circle, straight line,
 *      circular arc, or a simplified polyline as a fallback.
 *
 * Shapes that don't look like uniform strokes at all (e.g. filled dots) are
 * returned unchanged as "residual" fill paths.
 */

interface Pt {
  x: number;
  y: number;
}

export interface TracedStroke {
  readonly pathString: string;
  readonly kind: 'circle' | 'line' | 'arc' | 'path';
  readonly isClosed: boolean;
  readonly strokeLinecap: 'butt' | 'round';
}

export interface TraceResult {
  /** The recovered uniform stroke width. */
  readonly strokeWidth: number;
  /** One entry per recovered centerline. */
  readonly strokes: ReadonlyArray<TracedStroke>;
  /** Subpath groups that could not be converted and should stay filled. */
  readonly residualFills: ReadonlyArray<string>;
}

// Number of line segments used to flatten each curve command.
const CURVE_FLATTEN_STEPS = 32;
// The boundary is resampled at (roughly) bboxDiagonal / SAMPLES_PER_DIAGONAL.
const SAMPLES_PER_DIAGONAL = 500;
// Upper bound on the total number of boundary samples (performance guard).
const MAX_TOTAL_SAMPLES = 8000;
// A sample belongs to a stroke run if its local width is within this
// fraction of the median width.
const WIDTH_TOLERANCE = 0.3;

export function traceFilledPath(
  path: Path,
  fillType: 'nonZero' | 'evenOdd' = 'nonZero',
): TraceResult | undefined {
  const rawPolys = flattenPathToPolygons(path);
  if (!rawPolys.length) {
    return undefined;
  }
  const diag = bboxDiagonal(rawPolys);
  if (!diag) {
    return undefined;
  }
  const totalPerimeter = sum(rawPolys.map(p => closedPolylineLength(p)));
  const step = Math.max(diag / SAMPLES_PER_DIAGONAL, totalPerimeter / MAX_TOTAL_SAMPLES);
  const polys = rawPolys
    .map(p => resampleClosed(p, step))
    .filter(p => p.length >= 4);
  if (!polys.length) {
    return undefined;
  }

  const insideFn = (pt: Pt) => isInsideFill(pt, polys, fillType);
  const samples = computeMedialSamples(polys, step, insideFn);
  const widths = samples
    .reduce((acc, polySamples) => acc.concat(polySamples), [] as MedialSample[])
    .filter(s => s.valid)
    .map(s => s.width)
    .sort((a, b) => a - b);
  if (widths.length < 8) {
    return undefined;
  }
  const strokeWidth = widths[Math.floor(widths.length / 2)];
  // If the dominant "width" is a large fraction of the icon itself, the
  // shape is a solid blob rather than an outlined stroke — leave it filled.
  if (strokeWidth < diag * 1e-4 || strokeWidth > diag * 0.2) {
    return undefined;
  }

  let chains = buildChains(samples, polys, strokeWidth, step);
  chains = dedupeChains(chains, strokeWidth);
  chains = mergeChains(chains, strokeWidth, step, insideFn, polys);
  chains = chains.filter(c => c.pts.length >= 3 && chainLength(c) >= strokeWidth * 0.5);
  chains.forEach(c => extendChainCaps(c, strokeWidth, step, polys, insideFn));

  const strokes = chains.map(c => fitChain(c, strokeWidth, polys, insideFn));
  const residualFills = collectResidualFills(path, polys, samples, chains, strokeWidth);
  if (!strokes.length && !residualFills.length) {
    return undefined;
  }
  return { strokeWidth: roundTo(strokeWidth, 2), strokes, residualFills };
}

// ------------------------------------------------------------------------
// Polygonization
// ------------------------------------------------------------------------

function flattenPathToPolygons(path: Path): Pt[][] {
  const polys: Pt[][] = [];
  let current: Pt[] = [];
  const finishPoly = () => {
    // Drop the closing point if it duplicates the start.
    if (current.length > 1 && dist(current[0], current[current.length - 1]) < 1e-9) {
      current.pop();
    }
    if (current.length >= 3) {
      polys.push(current);
    }
    current = [];
  };
  for (const cmd of path.getCommands()) {
    const pts = cmd.points as ReadonlyArray<Pt>;
    switch (cmd.type) {
      case 'M':
        finishPoly();
        current.push({ ...cmd.end });
        break;
      case 'L':
      case 'Z':
        current.push({ ...cmd.end });
        break;
      case 'Q':
      case 'C': {
        for (let i = 1; i <= CURVE_FLATTEN_STEPS; i++) {
          current.push(bezierPoint(pts, i / CURVE_FLATTEN_STEPS));
        }
        break;
      }
    }
  }
  finishPoly();
  return polys;
}

function bezierPoint(pts: ReadonlyArray<Pt>, t: number): Pt {
  // De Casteljau evaluation for quadratic/cubic control points.
  let ps = pts.map(p => ({ ...p }));
  while (ps.length > 1) {
    const next: Pt[] = [];
    for (let i = 0; i < ps.length - 1; i++) {
      next.push({
        x: ps[i].x + (ps[i + 1].x - ps[i].x) * t,
        y: ps[i].y + (ps[i + 1].y - ps[i].y) * t,
      });
    }
    ps = next;
  }
  return ps[0];
}

function resampleClosed(poly: Pt[], step: number): Pt[] {
  const total = closedPolylineLength(poly);
  const n = Math.max(4, Math.round(total / step));
  const spacing = total / n;
  const out: Pt[] = [];
  let segIdx = 0;
  let segStartDist = 0;
  let segLen = dist(poly[0], poly[1 % poly.length]);
  for (let i = 0; i < n; i++) {
    const target = i * spacing;
    while (segStartDist + segLen < target && segIdx < poly.length - 1) {
      segStartDist += segLen;
      segIdx++;
      segLen = dist(poly[segIdx], poly[(segIdx + 1) % poly.length]);
    }
    const a = poly[segIdx];
    const b = poly[(segIdx + 1) % poly.length];
    const t = segLen < 1e-12 ? 0 : (target - segStartDist) / segLen;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

// ------------------------------------------------------------------------
// Point-in-fill + ray casting
// ------------------------------------------------------------------------

function isInsideFill(pt: Pt, polys: Pt[][], fillType: 'nonZero' | 'evenOdd') {
  let winding = 0;
  let crossings = 0;
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (a.y <= pt.y) {
        if (b.y > pt.y && cross(sub(b, a), sub(pt, a)) > 0) {
          winding++;
          crossings++;
        }
      } else if (b.y <= pt.y && cross(sub(b, a), sub(pt, a)) < 0) {
        winding--;
        crossings++;
      }
    }
  }
  return fillType === 'evenOdd' ? crossings % 2 !== 0 : winding !== 0;
}

/** Returns the smallest t > minT where origin + t * dir hits the boundary. */
function castRay(origin: Pt, dir: Pt, polys: Pt[][], minT: number): number | undefined {
  let best: number | undefined;
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const e = sub(b, a);
      const denom = cross(dir, e);
      if (Math.abs(denom) < 1e-12) {
        continue;
      }
      const ao = sub(a, origin);
      const t = cross(ao, e) / denom;
      const u = cross(ao, dir) / denom;
      if (t > minT && u >= 0 && u <= 1 && (best === undefined || t < best)) {
        best = t;
      }
    }
  }
  return best;
}

function distToBoundary(pt: Pt, polys: Pt[][]) {
  let best = Infinity;
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      best = Math.min(best, distToSegment(pt, poly[i], poly[(i + 1) % poly.length]));
    }
  }
  return best;
}

// ------------------------------------------------------------------------
// Medial samples + chains
// ------------------------------------------------------------------------

interface MedialSample {
  valid: boolean;
  width: number;
  mid: Pt;
}

function computeMedialSamples(polys: Pt[][], step: number, insideFn: (p: Pt) => boolean) {
  const probe = step * 0.35;
  return polys.map(poly => {
    const n = poly.length;
    const samples: MedialSample[] = [];
    for (let i = 0; i < n; i++) {
      const prev = poly[(i - 1 + n) % n];
      const next = poly[(i + 1) % n];
      const tangent = normalize(sub(next, prev));
      if (!tangent) {
        samples.push({ valid: false, width: 0, mid: poly[i] });
        continue;
      }
      let normal = { x: -tangent.y, y: tangent.x };
      const inA = insideFn(add(poly[i], scale(normal, probe)));
      const inB = insideFn(sub(poly[i], scale(normal, probe)));
      if (inA === inB) {
        samples.push({ valid: false, width: 0, mid: poly[i] });
        continue;
      }
      if (!inA) {
        normal = scale(normal, -1);
      }
      const origin = add(poly[i], scale(normal, probe));
      const t = castRay(origin, normal, polys, probe * 0.5);
      if (t === undefined) {
        samples.push({ valid: false, width: 0, mid: poly[i] });
        continue;
      }
      const width = t + probe;
      samples.push({ valid: true, width, mid: add(poly[i], scale(normal, width / 2)) });
    }
    return samples;
  });
}

interface Chain {
  pts: Pt[];
  isClosed: boolean;
  // Which (polyIdx, sampleIdx) boundary samples produced this chain.
  sources: Array<{ polyIdx: number; sampleIdx: number }>;
}

function buildChains(
  samples: MedialSample[][],
  polys: Pt[][],
  strokeWidth: number,
  step: number,
): Chain[] {
  const chains: Chain[] = [];
  samples.forEach((polySamples, polyIdx) => {
    const n = polySamples.length;
    const ok = polySamples.map(
      s => s.valid && Math.abs(s.width - strokeWidth) <= strokeWidth * WIDTH_TOLERANCE,
    );
    const isLink = (i: number, j: number) =>
      ok[i] && ok[j] && dist(polySamples[i].mid, polySamples[j].mid) <= step * 3;
    // Check whether the whole subpath is one closed centerline loop.
    if (ok.every(Boolean) && polySamples.every((s, i) => isLink(i, (i + 1) % n))) {
      chains.push({
        pts: polySamples.map(s => s.mid),
        isClosed: true,
        sources: polySamples.map((s, i) => ({ polyIdx, sampleIdx: i })),
      });
      return;
    }
    // Otherwise collect maximal runs, allowing wrap-around at index 0.
    let start = 0;
    while (start < n && (ok[start] && isLink((start - 1 + n) % n, start))) {
      start++;
    }
    if (start === n) {
      start = 0;
    }
    let current: Chain | undefined;
    for (let k = 0; k <= n; k++) {
      const i = (start + k) % n;
      const prevI = (start + k - 1 + n) % n;
      if (k < n && ok[i] && (!current || isLink(prevI, i))) {
        if (!current) {
          current = { pts: [], isClosed: false, sources: [] };
        }
        current.pts.push(polySamples[i].mid);
        current.sources.push({ polyIdx, sampleIdx: i });
      } else {
        if (current) {
          chains.push(current);
          current = undefined;
        }
        if (k < n && ok[i]) {
          current = {
            pts: [polySamples[i].mid],
            isClosed: false,
            sources: [{ polyIdx, sampleIdx: i }],
          };
        }
      }
    }
    if (current) {
      chains.push(current);
    }
  });
  return chains.filter(c => c.pts.length >= 2);
}

/**
 * Each stroke is traced once from each side of its outline, so most chains
 * exist in duplicate. Keep the longest version of each centerline.
 */
function dedupeChains(chains: Chain[], strokeWidth: number): Chain[] {
  const sorted = chains.slice().sort((a, b) => chainLength(b) - chainLength(a));
  const accepted: Chain[] = [];
  const threshold = strokeWidth * 0.45;
  for (const chain of sorted) {
    const coveredFn = (p: Pt) =>
      accepted.some(acc => acc.pts.some(q => dist(p, q) <= threshold));
    const covered = chain.pts.map(coveredFn);
    const coveredCount = covered.filter(Boolean).length;
    if (coveredCount / chain.pts.length >= 0.5) {
      continue;
    }
    // Trim covered ends so partially-overlapping chains don't double-draw.
    if (!chain.isClosed) {
      let lo = 0;
      let hi = chain.pts.length - 1;
      while (lo < hi && covered[lo]) {
        lo++;
      }
      while (hi > lo && covered[hi]) {
        hi--;
      }
      chain.pts = chain.pts.slice(lo, hi + 1);
      chain.sources = chain.sources.slice(lo, hi + 1);
    }
    if (chain.pts.length >= 2) {
      accepted.push(chain);
    }
  }
  return accepted;
}

/**
 * Merges chains that were interrupted by junctions (e.g. the two halves of a
 * plus sign's horizontal bar) and closes chains that loop back onto
 * themselves (e.g. the ring of a search icon, interrupted where the handle
 * attaches). A merge is only allowed if the connecting gap lies well inside
 * the filled region.
 */
function mergeChains(
  chains: Chain[],
  strokeWidth: number,
  step: number,
  insideFn: (p: Pt) => boolean,
  polys: Pt[][],
): Chain[] {
  const gapMax = strokeWidth * 2.5;
  const gapIsFilled = (a: Pt, b: Pt) => {
    for (let i = 1; i <= 5; i++) {
      const t = i / 6;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (!insideFn(p) || distToBoundary(p, polys) < strokeWidth * 0.2) {
        return false;
      }
    }
    return true;
  };
  const endTangent = (chain: Chain, atStart: boolean) => {
    const pts = chain.pts;
    const k = Math.min(pts.length - 1, Math.max(2, Math.round(strokeWidth / (2 * step))));
    return atStart
      ? normalize(sub(pts[0], pts[k]))
      : normalize(sub(pts[pts.length - 1], pts[pts.length - 1 - k]));
  };
  const result = chains.slice();
  // Repeatedly apply the single best-aligned merge, so that at an X-shaped
  // junction the straight-through continuation always wins over a V-shaped
  // detour, until no valid merges remain.
  while (true) {
    let best:
      | { score: number; i: number; j: number; aStart: boolean; bStart: boolean }
      | undefined;
    for (let i = 0; i < result.length; i++) {
      const a = result[i];
      if (a.isClosed) {
        continue;
      }
      // A chain may also close onto itself; that competes with cross-chain
      // merges on the same alignment score.
      if (
        a.pts.length > 8 &&
        dist(a.pts[0], a.pts[a.pts.length - 1]) <= Math.min(gapMax, chainLength(a) * 0.35)
      ) {
        const aEnd = a.pts[a.pts.length - 1];
        const aStartPt = a.pts[0];
        if (gapIsFilled(aEnd, aStartPt)) {
          const gap = dist(aEnd, aStartPt);
          const gapDir = gap < step * 0.5 ? undefined : normalize(sub(aStartPt, aEnd));
          const ta = endTangent(a, false);
          const tb = endTangent(a, true);
          let score = 1;
          if (ta && tb) {
            score = gapDir
              ? Math.min(dot(ta, gapDir), dot(scale(tb, -1), gapDir))
              : dot(ta, scale(tb, -1));
          }
          if (score >= 0.3 && (!best || score > best.score)) {
            best = { score, i, j: i, aStart: false, bStart: true };
          }
        }
      }
      for (let j = 0; j < result.length; j++) {
        if (i >= j || result[j].isClosed) {
          continue;
        }
        const b = result[j];
        // Consider all four end-to-end combinations.
        const combos: Array<[boolean, boolean]> = [
          [false, true], // a end -> b start
          [false, false], // a end -> b end (reverse b)
          [true, true], // a start -> b start (reverse a)
          [true, false], // a start -> b end (swap)
        ];
        for (const [aStart, bStart] of combos) {
          const aPt = aStart ? a.pts[0] : a.pts[a.pts.length - 1];
          const bPt = bStart ? b.pts[0] : b.pts[b.pts.length - 1];
          const gap = dist(aPt, bPt);
          if (gap > gapMax || !gapIsFilled(aPt, bPt)) {
            continue;
          }
          const gapDir = gap < step * 0.5 ? undefined : normalize(sub(bPt, aPt));
          const ta = endTangent(a, aStart);
          const tb = endTangent(b, bStart);
          let score = 1;
          if (ta && tb) {
            score = gapDir
              ? Math.min(dot(ta, gapDir), dot(scale(tb, -1), gapDir))
              : dot(ta, scale(tb, -1));
          }
          // The gap must continue a's direction and flow into b's.
          if (score < 0.3) {
            continue;
          }
          if (!best || score > best.score) {
            best = { score, i, j, aStart, bStart };
          }
        }
      }
    }
    if (!best) {
      break;
    }
    if (best.i === best.j) {
      result[best.i].isClosed = true;
      continue;
    }
    const a = result[best.i];
    const b = result[best.j];
    const aPts = best.aStart ? a.pts.slice().reverse() : a.pts.slice();
    const aSrc = best.aStart ? a.sources.slice().reverse() : a.sources.slice();
    const bPts = best.bStart ? b.pts.slice() : b.pts.slice().reverse();
    const bSrc = best.bStart ? b.sources.slice() : b.sources.slice().reverse();
    a.pts = aPts.concat(bPts);
    a.sources = aSrc.concat(bSrc);
    result.splice(best.j, 1);
  }
  // Finally, close any chain that loops back onto itself (e.g. the ring of a
  // search icon, interrupted where the handle attaches).
  for (const a of result) {
    if (a.isClosed) {
      continue;
    }
    const selfGap = dist(a.pts[0], a.pts[a.pts.length - 1]);
    if (
      a.pts.length > 8 &&
      selfGap <= gapMax &&
      selfGap <= chainLength(a) * 0.35 &&
      gapIsFilled(a.pts[a.pts.length - 1], a.pts[0])
    ) {
      a.isClosed = true;
    }
  }
  return result;
}

/**
 * Extends the ends of open chains to the actual stroke ends. Along the way
 * we detect whether the cap looks flat (Material's default squared ends) or
 * round, and pick the matching linecap.
 */
function extendChainCaps(
  chain: Chain,
  strokeWidth: number,
  step: number,
  polys: Pt[][],
  insideFn: (p: Pt) => boolean,
) {
  if (chain.isClosed) {
    return;
  }
  (chain as any).linecap = 'butt';
  const extendEnd = (atStart: boolean) => {
    const pts = chain.pts;
    const k = Math.min(pts.length - 1, Math.max(2, Math.round(strokeWidth / (2 * step))));
    const endPt = atStart ? pts[0] : pts[pts.length - 1];
    const innerPt = atStart ? pts[k] : pts[pts.length - 1 - k];
    const dir = normalize(sub(endPt, innerPt));
    if (!dir) {
      return;
    }
    const s = castRay(endPt, dir, polys, 0);
    if (s === undefined || s > strokeWidth * 1.6) {
      return;
    }
    // Probe the lateral width just before the cap face: a flat cap keeps the
    // full stroke width all the way to the end, a round cap tapers off.
    const q = add(endPt, scale(dir, Math.max(0, s - strokeWidth * 0.15)));
    const perp = { x: -dir.y, y: dir.x };
    const w1 = insideFn(q) ? castRay(q, perp, polys, 0) : undefined;
    const w2 = insideFn(q) ? castRay(q, scale(perp, -1), polys, 0) : undefined;
    const lateral = (w1 === undefined ? 0 : w1) + (w2 === undefined ? 0 : w2);
    let newEnd: Pt;
    if (lateral >= strokeWidth * 0.8) {
      newEnd = add(endPt, scale(dir, s));
    } else {
      (chain as any).linecap = 'round';
      newEnd = add(endPt, scale(dir, Math.max(0, s - strokeWidth / 2)));
    }
    if (atStart) {
      pts.unshift(newEnd);
    } else {
      pts.push(newEnd);
    }
  };
  extendEnd(true);
  extendEnd(false);
}

// ------------------------------------------------------------------------
// Primitive fitting
// ------------------------------------------------------------------------

function fitChain(
  chain: Chain,
  strokeWidth: number,
  polys: Pt[][],
  insideFn: (p: Pt) => boolean,
): TracedStroke {
  const pts = chain.pts;
  const linecap: 'butt' | 'round' = (chain as any).linecap || 'butt';
  const circle = fitCircle(pts);
  if (chain.isClosed) {
    if (circle && circle.maxDev <= strokeWidth * 0.12) {
      const { cx, cy, r } = circle;
      const pathString =
        `M ${fmt(cx + r)} ${fmt(cy)} ` +
        `A ${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(cx - r)} ${fmt(cy)} ` +
        `A ${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(cx + r)} ${fmt(cy)} Z`;
      return { pathString, kind: 'circle', isClosed: true, strokeLinecap: linecap };
    }
    const simplified = reconstructCorners(
      simplifyPolyline(pts, strokeWidth * 0.1, true),
      true,
      strokeWidth,
      polys,
      insideFn,
    );
    return {
      pathString: polylineToPathString(simplified, true),
      kind: 'path',
      isClosed: true,
      strokeLinecap: linecap,
    };
  }
  // Straight line?
  const first = pts[0];
  const last = pts[pts.length - 1];
  const lineDev = Math.max(...pts.map(p => distToSegment(p, first, last)));
  if (lineDev <= strokeWidth * 0.08) {
    return {
      pathString: `M ${fmt(first.x)} ${fmt(first.y)} L ${fmt(last.x)} ${fmt(last.y)}`,
      kind: 'line',
      isClosed: false,
      strokeLinecap: linecap,
    };
  }
  // Circular arc? Fit on the middle of the chain first, then grow the fitted
  // range outward — the few samples nearest a junction or cap often drift.
  const arc = fitArc(pts, strokeWidth);
  if (arc) {
    const { cx, cy, r, lo, hi } = arc;
    const arcPts = pts.slice(lo, hi + 1);
    const angleOf = (p: Pt) => Math.atan2(p.y - cy, p.x - cx);
    // Determine the sweep direction from the sampled points.
    let sweepSum = 0;
    for (let i = 1; i < arcPts.length; i++) {
      let d = angleOf(arcPts[i]) - angleOf(arcPts[i - 1]);
      while (d > Math.PI) {
        d -= 2 * Math.PI;
      }
      while (d < -Math.PI) {
        d += 2 * Math.PI;
      }
      sweepSum += d;
    }
    const sweepFlag = sweepSum > 0 ? 1 : 0;
    const largeArcFlag = Math.abs(sweepSum) > Math.PI ? 1 : 0;
    // Project the endpoints radially onto the fitted circle.
    const project = (p: Pt) => {
      const angle = angleOf(p);
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    };
    const a = project(arcPts[0]);
    const b = project(arcPts[arcPts.length - 1]);
    const pathString =
      `M ${fmt(a.x)} ${fmt(a.y)} ` +
      `A ${fmt(r)} ${fmt(r)} 0 ${largeArcFlag} ${sweepFlag} ${fmt(b.x)} ${fmt(b.y)}`;
    return { pathString, kind: 'arc', isClosed: false, strokeLinecap: linecap };
  }
  const simplifiedOpen = reconstructCorners(
    simplifyPolyline(pts, strokeWidth * 0.1, false),
    false,
    strokeWidth,
    polys,
    insideFn,
  );
  return {
    pathString: polylineToPathString(simplifiedOpen, false),
    kind: 'path',
    isClosed: false,
    strokeLinecap: linecap,
  };
}

/**
 * Medial-axis chains stop about half a stroke width before a sharp corner,
 * so a corner comes out as a short "jog" segment between the two long legs.
 * This restores the crisp vertex: a short interior segment is replaced by
 * the intersection point of its two neighboring leg lines, provided the
 * intersection lies safely inside the fill.
 */
function reconstructCorners(
  pts: Pt[],
  isClosed: boolean,
  strokeWidth: number,
  polys: Pt[][],
  insideFn: (p: Pt) => boolean,
): Pt[] {
  if (pts.length < 4) {
    return pts;
  }
  const maxJog = strokeWidth * 2.2;
  const out = pts.slice();
  const n = () => out.length;
  // Walk segment pairs (B, C): candidates where A-B and C-D are the legs.
  for (let idx = 0; idx < n(); idx++) {
    if (n() < 4) {
      break;
    }
    const bIdx = idx;
    const cIdx = (idx + 1) % n();
    if (!isClosed && (bIdx === 0 || cIdx === 0 || bIdx === n() - 1)) {
      continue;
    }
    const aIdx = (bIdx - 1 + n()) % n();
    const dIdx = (cIdx + 1) % n();
    if (!isClosed && (aIdx >= bIdx || dIdx <= cIdx)) {
      continue;
    }
    const a = out[aIdx];
    const b = out[bIdx];
    const c = out[cIdx];
    const d = out[dIdx];
    if (dist(b, c) > maxJog) {
      continue;
    }
    const p = lineIntersection(a, b, c, d);
    if (
      !p ||
      dist(p, b) > maxJog ||
      dist(p, c) > maxJog ||
      !insideFn(p) ||
      distToBoundary(p, polys) < strokeWidth * 0.2
    ) {
      continue;
    }
    if (cIdx === 0) {
      // Wrap-around pair on a closed chain: B is last, C is first.
      out.pop();
      out.shift();
      out.push(p);
    } else {
      out.splice(bIdx, 2, p);
    }
    idx = -1; // restart the scan after a merge
  }
  return out;
}

function lineIntersection(a: Pt, b: Pt, c: Pt, d: Pt): Pt | undefined {
  const r = sub(b, a);
  const s = sub(d, c);
  const denom = cross(r, s);
  if (Math.abs(denom) < 1e-9) {
    return undefined;
  }
  const t = cross(sub(c, a), s) / denom;
  return add(a, scale(r, t));
}

/**
 * Robust arc fit for open chains: fits a circle to the middle 60% of the
 * points, grows the inlier range outward, and accepts if at least 80% of the
 * chain lies on the circle.
 */
function fitArc(pts: Pt[], strokeWidth: number) {
  const n = pts.length;
  if (n < 8) {
    return undefined;
  }
  const midLo = Math.floor(n * 0.2);
  const midHi = Math.ceil(n * 0.8);
  const midFit = fitCircle(pts.slice(midLo, midHi));
  const tol = strokeWidth * 0.12;
  if (!midFit || midFit.maxDev > tol) {
    return undefined;
  }
  const dev = (p: Pt, c: { cx: number; cy: number; r: number }) =>
    Math.abs(dist(p, { x: c.cx, y: c.cy }) - c.r);
  let lo = midLo;
  let hi = midHi - 1;
  while (lo > 0 && dev(pts[lo - 1], midFit) <= tol) {
    lo--;
  }
  while (hi < n - 1 && dev(pts[hi + 1], midFit) <= tol) {
    hi++;
  }
  if ((hi - lo + 1) / n < 0.8) {
    return undefined;
  }
  // Refit on the final inlier range for the best parameters.
  const finalFit = fitCircle(pts.slice(lo, hi + 1)) || midFit;
  return { cx: finalFit.cx, cy: finalFit.cy, r: finalFit.r, lo, hi };
}

function fitCircle(pts: Pt[]) {
  // Kasa algebraic least-squares circle fit.
  const n = pts.length;
  if (n < 3) {
    return undefined;
  }
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let sxz = 0;
  let syz = 0;
  let sz = 0;
  for (const p of pts) {
    const z = p.x * p.x + p.y * p.y;
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    syy += p.y * p.y;
    sxy += p.x * p.y;
    sxz += p.x * z;
    syz += p.y * z;
    sz += z;
  }
  // Solve [2sxx 2sxy sx; 2sxy 2syy sy; 2sx 2sy n] * [a b c]' = [sxz syz sz]'
  const m = [[2 * sxx, 2 * sxy, sx], [2 * sxy, 2 * syy, sy], [2 * sx, 2 * sy, n]];
  const rhs = [sxz, syz, sz];
  const det3 = (mm: number[][]) =>
    mm[0][0] * (mm[1][1] * mm[2][2] - mm[1][2] * mm[2][1]) -
    mm[0][1] * (mm[1][0] * mm[2][2] - mm[1][2] * mm[2][0]) +
    mm[0][2] * (mm[1][0] * mm[2][1] - mm[1][1] * mm[2][0]);
  const d = det3(m);
  if (Math.abs(d) < 1e-9) {
    return undefined;
  }
  const replaceCol = (col: number) =>
    m.map((row, i) => row.map((v, j) => (j === col ? rhs[i] : v)));
  const cx = det3(replaceCol(0)) / d;
  const cy = det3(replaceCol(1)) / d;
  const c = det3(replaceCol(2)) / d;
  const r = Math.sqrt(Math.max(0, c + cx * cx + cy * cy));
  if (!isFinite(r) || r <= 0) {
    return undefined;
  }
  let maxDev = 0;
  for (const p of pts) {
    maxDev = Math.max(maxDev, Math.abs(dist(p, { x: cx, y: cy }) - r));
  }
  return { cx, cy, r, maxDev };
}

function simplifyPolyline(pts: Pt[], tolerance: number, isClosed: boolean): Pt[] {
  const points = isClosed ? pts.concat([pts[0]]) : pts;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    let maxDist = 0;
    let maxIdx = -1;
    for (let i = lo + 1; i < hi; i++) {
      const dd = distToSegment(points[i], points[lo], points[hi]);
      if (dd > maxDist) {
        maxDist = dd;
        maxIdx = i;
      }
    }
    if (maxDist > tolerance && maxIdx > 0) {
      keep[maxIdx] = true;
      stack.push([lo, maxIdx], [maxIdx, hi]);
    }
  }
  const out = points.filter((p, i) => keep[i]);
  if (isClosed) {
    out.pop();
  }
  return out;
}

function polylineToPathString(pts: Pt[], isClosed: boolean) {
  const parts = [`M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`];
  for (let i = 1; i < pts.length; i++) {
    parts.push(`L ${fmt(pts[i].x)} ${fmt(pts[i].y)}`);
  }
  if (isClosed) {
    parts.push('Z');
  }
  return parts.join(' ');
}

// ------------------------------------------------------------------------
// Residual (untraceable) fills
// ------------------------------------------------------------------------

function collectResidualFills(
  path: Path,
  polys: Pt[][],
  samples: MedialSample[][],
  chains: Chain[],
  strokeWidth: number,
): string[] {
  const chainPts = chains.reduce((acc, c) => acc.concat(c.pts), [] as Pt[]);
  const threshold = strokeWidth * 0.55;
  const coverage = samples.map(polySamples => {
    if (!polySamples.length) {
      return 1;
    }
    const covered = polySamples.filter(
      s => s.valid && chainPts.some(q => dist(s.mid, q) <= threshold),
    );
    return covered.length / polySamples.length;
  });
  const residualIdxs = coverage
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c < 0.35)
    .map(({ i }) => i);
  if (!residualIdxs.length) {
    return [];
  }
  // Group residual subpaths: holes stay with the outline that contains them.
  const isInsidePoly = (pt: Pt, poly: Pt[]) => isInsideFill(pt, [poly], 'evenOdd');
  const residualSet = new Set(residualIdxs);
  const groups: number[][] = [];
  for (const i of residualIdxs) {
    const containers = residualIdxs.filter(
      j => j !== i && isInsidePoly(polys[i][0], polys[j]),
    );
    if (!containers.length) {
      groups.push([i]);
    }
  }
  for (const i of residualIdxs) {
    for (const group of groups) {
      if (group[0] !== i && isInsidePoly(polys[i][0], polys[group[0]])) {
        group.push(i);
      }
    }
  }
  const grouped = new Set(groups.reduce((acc, g) => acc.concat(g), [] as number[]));
  // Any leftover (weird containment) becomes its own group.
  residualSet.forEach(i => {
    if (!grouped.has(i)) {
      groups.push([i]);
    }
  });
  const subPaths = path.getSubPaths();
  return groups
    .filter(group => group.every(i => i < subPaths.length))
    .map(group => group.map(i => subPathToString(subPaths[i])).join(' '));
}

function subPathToString(subPath: { getCommands(): ReadonlyArray<any> }) {
  return subPath
    .getCommands()
    .map((cmd: { type: string; points: ReadonlyArray<Pt>; end: Pt }) => {
      switch (cmd.type) {
        case 'M':
          return `M ${fmt(cmd.end.x)} ${fmt(cmd.end.y)}`;
        case 'L':
          return `L ${fmt(cmd.end.x)} ${fmt(cmd.end.y)}`;
        case 'Q': {
          const [, cp, end] = cmd.points;
          return `Q ${fmt(cp.x)} ${fmt(cp.y)} ${fmt(end.x)} ${fmt(end.y)}`;
        }
        case 'C': {
          const [, cp1, cp2, end] = cmd.points;
          return (
            `C ${fmt(cp1.x)} ${fmt(cp1.y)} ` +
            `${fmt(cp2.x)} ${fmt(cp2.y)} ${fmt(end.x)} ${fmt(end.y)}`
          );
        }
        case 'Z':
          return 'Z';
        default:
          return '';
      }
    })
    .join(' ');
}

// ------------------------------------------------------------------------
// Geometry helpers
// ------------------------------------------------------------------------

function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: Pt, b: Pt): Pt {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(a: Pt, s: number): Pt {
  return { x: a.x * s, y: a.y * s };
}

function cross(a: Pt, b: Pt) {
  return a.x * b.y - a.y * b.x;
}

function dot(a: Pt, b: Pt) {
  return a.x * b.x + a.y * b.y;
}

function dist(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(a: Pt): Pt | undefined {
  const len = Math.hypot(a.x, a.y);
  return len < 1e-12 ? undefined : { x: a.x / len, y: a.y / len };
}

function distToSegment(p: Pt, a: Pt, b: Pt) {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  if (len2 < 1e-12) {
    return dist(p, a);
  }
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2));
  return dist(p, add(a, scale(ab, t)));
}

function closedPolylineLength(poly: Pt[]) {
  let total = 0;
  for (let i = 0; i < poly.length; i++) {
    total += dist(poly[i], poly[(i + 1) % poly.length]);
  }
  return total;
}

function chainLength(chain: Chain) {
  let total = 0;
  for (let i = 1; i < chain.pts.length; i++) {
    total += dist(chain.pts[i - 1], chain.pts[i]);
  }
  if (chain.isClosed && chain.pts.length > 1) {
    total += dist(chain.pts[chain.pts.length - 1], chain.pts[0]);
  }
  return total;
}

function bboxDiagonal(polys: Pt[][]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of polys) {
    for (const p of poly) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

function roundTo(n: number, digits: number) {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

function fmt(n: number) {
  return String(roundTo(n, 2));
}
