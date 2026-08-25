import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { MatMenuTrigger } from '@angular/material/menu';
import { ColorUtil } from 'app/modules/editor/scripts/common';
import * as _ from 'lodash';

interface Hsva {
  readonly h: number; // 0..360
  readonly s: number; // 0..1
  readonly v: number; // 0..1
  readonly a: number; // 0..1
}

/**
 * A popover color picker (saturation/value area + hue and alpha sliders + hex
 * field) with an explicit "no color" state. Values are Android color strings
 * (#AARRGGBB); an empty string means the color is turned off.
 */
@Component({
  standalone: false,
  selector: 'app-color-picker',
  templateUrl: './colorpicker.component.html',
  styleUrls: ['./colorpicker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorPickerComponent implements OnDestroy {
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<string>();
  // Fired when the picker popup menu opens/closes, so hosts can keep the
  // trigger button mounted while the user is still interacting with it.
  @Output() opened = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  hsva: Hsva = { h: 0, s: 1, v: 1, a: 1 };
  hasColor = false;
  hexText = '';

  private lastEmitted: string;
  private stopDrag?: () => void;

  // The popover panel stops click propagation (so drags inside it don't close
  // the menu), which also disables the menu's built-in close-on-click — the
  // "No color" action closes it explicitly through the trigger instead.
  @ViewChild(MatMenuTrigger) private menuTrigger: MatMenuTrigger;

  constructor(private readonly changeDetectorRef: ChangeDetectorRef) {}

  @Input()
  set value(androidColor: string) {
    if (androidColor === this.lastEmitted) {
      // Ignore the echo of our own emission so the hue/saturation thumbs don't
      // jump while dragging (e.g. pure black loses hue information in RGB).
      return;
    }
    this.lastEmitted = androidColor;
    const d = ColorUtil.parseAndroidColor(androidColor);
    if (!d) {
      this.hasColor = false;
      this.hexText = '';
      return;
    }
    this.hasColor = true;
    this.hsva = { ...rgbToHsv(d.r, d.g, d.b), a: d.a / 255 };
    this.hexText = rgbToHexString(d.r, d.g, d.b);
  }

  ngOnDestroy() {
    this.stopDrag?.();
  }

  // ── Template getters ──────────────────────────────────────────────────────

  // Fully opaque version of the current color (alpha slider gradient, thumbs).
  opaqueCss() {
    const { r, g, b } = hsvToRgb(this.hsva.h, this.hsva.s, this.hsva.v);
    return `rgb(${r}, ${g}, ${b})`;
  }

  cssColor() {
    const { r, g, b } = hsvToRgb(this.hsva.h, this.hsva.s, this.hsva.v);
    return `rgba(${r}, ${g}, ${b}, ${+this.hsva.a.toFixed(3)})`;
  }

  hueCss() {
    return `hsl(${this.hsva.h}, 100%, 50%)`;
  }

  alphaPercent() {
    return Math.round(this.hsva.a * 100);
  }

  // Icon color that stays legible on top of the current swatch color: dark on
  // light/transparent colors, white on dark opaque ones.
  triggerIconColor() {
    const { r, g, b } = hsvToRgb(this.hsva.h, this.hsva.s, this.hsva.v);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const isLight = luminance > 0.6 || this.hsva.a < 0.5;
    return isLight ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.9)';
  }

  // ── Pointer interactions ──────────────────────────────────────────────────

  // The track element is passed explicitly (rather than read off the event)
  // so the drag can also start on the overhanging thumb circle and still
  // measure against the track.
  onAreaPointerDown(event: PointerEvent, track: HTMLElement) {
    const rect = track.getBoundingClientRect();
    this.beginDrag(event, e => {
      const s = _.clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const v = 1 - _.clamp((e.clientY - rect.top) / rect.height, 0, 1);
      this.hsva = { ...this.hsva, s, v };
      this.commit();
    });
  }

  onHuePointerDown(event: PointerEvent, track: HTMLElement) {
    const rect = track.getBoundingClientRect();
    this.beginDrag(event, e => {
      const h = _.clamp((e.clientX - rect.left) / rect.width, 0, 1) * 360;
      this.hsva = { ...this.hsva, h };
      this.commit();
    });
  }

  onAlphaPointerDown(event: PointerEvent, track: HTMLElement) {
    const rect = track.getBoundingClientRect();
    this.beginDrag(event, e => {
      const a = _.clamp((e.clientX - rect.left) / rect.width, 0, 1);
      this.hsva = { ...this.hsva, a };
      this.commit();
    });
  }

  onHexInputChange(event: Event) {
    const text = (event.target as HTMLInputElement).value.trim();
    let parsed = ColorUtil.parseAndroidColor(text) || ColorUtil.parseAndroidColor(`#${text}`);
    if (!parsed) {
      parsed = ColorUtil.parseAndroidColor(ColorUtil.svgToAndroidColor(text));
    }
    if (!parsed) {
      // Revert the field to the last valid value.
      (event.target as HTMLInputElement).value = this.hexText;
      return;
    }
    // Keep the current alpha unless the entered value carries its own.
    const a = text.replace('#', '').length === 8 ? parsed.a / 255 : this.hsva.a;
    this.hsva = { ...rgbToHsv(parsed.r, parsed.g, parsed.b), a };
    this.commit();
  }

  onNoColorClick() {
    this.hasColor = false;
    this.hexText = '';
    this.lastEmitted = '';
    this.valueChange.emit('');
    this.menuTrigger?.closeMenu();
    this.changeDetectorRef.markForCheck();
  }

  private commit() {
    const { r, g, b } = hsvToRgb(this.hsva.h, this.hsva.s, this.hsva.v);
    this.hasColor = true;
    this.hexText = rgbToHexString(r, g, b);
    this.lastEmitted = ColorUtil.toAndroidString({ r, g, b, a: Math.round(this.hsva.a * 255) });
    this.valueChange.emit(this.lastEmitted);
    this.changeDetectorRef.markForCheck();
  }

  private beginDrag(event: PointerEvent, moveFn: (e: PointerEvent) => void) {
    if (this.disabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.stopDrag?.();
    moveFn(event);
    const onPointerMove = (e: PointerEvent) => moveFn(e);
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      this.stopDrag = undefined;
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    this.stopDrag = onPointerUp;
  }
}

function rgbToHexString(r: number, g: number, b: number) {
  const hex = (n: number) => (n < 16 ? '0' : '') + n.toString(16);
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === rn) {
      h = ((gn - bn) / d) % 6;
    } else if (max === gn) {
      h = (bn - rn) / d + 2;
    } else {
      h = (rn - gn) / d + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (h < 180) {
    [r, g, b] = [0, c, x];
  } else if (h < 240) {
    [r, g, b] = [0, x, c];
  } else if (h < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}
