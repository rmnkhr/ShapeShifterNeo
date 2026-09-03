import { Path } from 'app/modules/editor/model/paths';

import { traceFilledPath } from './StrokeTracer';

// Google Material Symbols icons (24dp, weight 400, viewBox '0 -960 960 960').
const SEARCH_ICON =
  'M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 ' +
  '75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 ' +
  '56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 ' +
  '52.5T200-580q0 75 52.5 127.5T380-400Z';
const ADD_ICON = 'M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z';
const INFO_ICON =
  'M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 ' +
  '0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 ' +
  '31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 ' +
  '83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 ' +
  '0-227 93t-93 227q0 134 93 227t227 93Z';
const HEART_ICON =
  'm480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 ' +
  '0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 ' +
  '705-329T538-172l-58 52Z';

describe('StrokeTracer', () => {
  it('converts the search icon into a stroked circle and a line', () => {
    const result = traceFilledPath(new Path(SEARCH_ICON), 'nonZero');
    expect(result).toBeDefined();
    // The Material 400-weight stroke is 80 units wide in a 960 viewport.
    expect(result.strokeWidth).toBeGreaterThan(70);
    expect(result.strokeWidth).toBeLessThan(90);
    expect(result.strokes.length).toBe(2);
    const kinds = result.strokes.map(s => s.kind).sort();
    expect(kinds).toEqual(['circle', 'line']);
    expect(result.residualFills.length).toBe(0);
  });

  it('converts the add icon into two perpendicular lines', () => {
    const result = traceFilledPath(new Path(ADD_ICON), 'nonZero');
    expect(result).toBeDefined();
    expect(result.strokes.length).toBe(2);
    expect(result.strokes.every(s => s.kind === 'line')).toBe(true);
  });

  it('keeps the info icon dot as a residual fill', () => {
    const result = traceFilledPath(new Path(INFO_ICON), 'nonZero');
    expect(result).toBeDefined();
    expect(result.strokes.length).toBe(2);
    expect(result.strokes.some(s => s.kind === 'circle')).toBe(true);
    expect(result.strokes.some(s => s.kind === 'line')).toBe(true);
    expect(result.residualFills.length).toBe(1);
  });

  it('refuses to convert solid shapes', () => {
    const result = traceFilledPath(new Path(HEART_ICON), 'nonZero');
    expect(result).toBeUndefined();
  });
});
