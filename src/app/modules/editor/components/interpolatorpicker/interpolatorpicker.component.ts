import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  INTERPOLATORS,
  buildCustomInterpolatorValue,
  isCustomInterpolator,
  parseCustomInterpolator,
} from 'app/modules/editor/model/interpolators';

@Component({
  selector: 'app-interpolator-picker',
  templateUrl: './interpolatorpicker.component.html',
  styleUrls: ['./interpolatorpicker.component.scss'],
  standalone: false,
})
export class InterpolatorPickerComponent implements OnChanges, OnDestroy {
  @Input() value: string;
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('bezierCanvas') bezierCanvasRef: ElementRef<SVGSVGElement>;

  readonly INTERPOLATORS = INTERPOLATORS;

  // SVG coordinate system: 200×200 units.
  // Visible y range is [-0.5, 1.5] so handles can show overshoot/anticipate.
  readonly CANVAS_SIZE = 200;
  readonly Y_MAX = 1.5;
  readonly Y_RANGE = 2.0; // Y_MAX − Y_MIN = 1.5 − (−0.5)

  // Pre-computed pixel positions for the [0,1] grid box (constants, used in template).
  readonly GRID_Y0 = 150;  // py(0)
  readonly GRID_Y1 = 50;   // py(1)

  x1 = 0.42;
  y1 = 0;
  x2 = 0.58;
  y2 = 1;

  showCustomEditor = false;
  draggingHandle: 1 | 2 | null = null;

  // Preview animation trigger — toggled to restart CSS animation.
  showPreviewDot = true;
  private previewTimer: any = null;

  get currentLabel(): string {
    if (isCustomInterpolator(this.value)) { return 'Custom'; }
    const preset = INTERPOLATORS.find(i => i.value === this.value);
    return preset ? preset.label : this.value;
  }

  get bezierCurveD(): string {
    return `M ${this.px(0)} ${this.py(0)} C ${this.px(this.x1)} ${this.py(this.y1)}, ${this.px(this.x2)} ${this.py(this.y2)}, ${this.px(1)} ${this.py(1)}`;
  }

  get handle1X(): number { return this.px(this.x1); }
  get handle1Y(): number { return this.py(this.y1); }
  get handle2X(): number { return this.px(this.x2); }
  get handle2Y(): number { return this.py(this.y2); }

  get line1D(): string {
    return `M ${this.px(0)} ${this.py(0)} L ${this.handle1X} ${this.handle1Y}`;
  }

  get line2D(): string {
    return `M ${this.px(1)} ${this.py(1)} L ${this.handle2X} ${this.handle2Y}`;
  }

  get cubicBezierCSS(): string {
    return `cubic-bezier(${this.x1}, ${this.y1}, ${this.x2}, ${this.y2})`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      if (isCustomInterpolator(this.value)) {
        const [x1, y1, x2, y2] = parseCustomInterpolator(this.value);
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.showCustomEditor = true;
      } else {
        this.showCustomEditor = false;
      }
      this.restartPreview();
    }
  }

  ngOnDestroy(): void {
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
    }
  }

  onPresetSelect(presetValue: string): void {
    if (this.disabled) { return; }
    this.showCustomEditor = false;
    this.valueChange.emit(presetValue);
  }

  toggleCustomEditor(): void {
    if (this.disabled) { return; }
    this.showCustomEditor = !this.showCustomEditor;
    if (this.showCustomEditor && !isCustomInterpolator(this.value)) {
      this.emitCustom();
    }
  }

  onControlPointInput(field: 'x1' | 'y1' | 'x2' | 'y2', event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const num = parseFloat(raw);
    if (isNaN(num)) { return; }
    if (field === 'x1') { this.x1 = Math.max(0, Math.min(1, num)); }
    if (field === 'y1') { this.y1 = Math.max(-0.5, Math.min(1.5, num)); }
    if (field === 'x2') { this.x2 = Math.max(0, Math.min(1, num)); }
    if (field === 'y2') { this.y2 = Math.max(-0.5, Math.min(1.5, num)); }
    this.emitCustom();
  }

  onHandlePointerDown(event: PointerEvent, handle: 1 | 2): void {
    if (this.disabled) { return; }
    event.preventDefault();
    event.stopPropagation();
    this.draggingHandle = handle;
    (event.target as Element).setPointerCapture(event.pointerId);
  }

  onSvgPointerMove(event: PointerEvent): void {
    if (!this.draggingHandle) { return; }
    event.preventDefault();
    const svg = this.bezierCanvasRef?.nativeElement;
    if (!svg) { return; }
    // getScreenCTM gives correct mapping regardless of how CSS scales the SVG.
    const ctm = svg.getScreenCTM();
    if (!ctm) { return; }
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());

    const valX = Math.max(0, Math.min(1, svgPt.x / this.CANVAS_SIZE));
    const valY = Math.max(-0.5, Math.min(1.5,
      this.Y_MAX - (svgPt.y / this.CANVAS_SIZE) * this.Y_RANGE));

    if (this.draggingHandle === 1) {
      this.x1 = Math.round(valX * 100) / 100;
      this.y1 = Math.round(valY * 100) / 100;
    } else {
      this.x2 = Math.round(valX * 100) / 100;
      this.y2 = Math.round(valY * 100) / 100;
    }
    this.emitCustom();
  }

  onSvgPointerUp(event: PointerEvent): void {
    if (this.draggingHandle) {
      (event.target as Element).releasePointerCapture(event.pointerId);
    }
    this.draggingHandle = null;
  }

  px(x: number): number {
    return x * this.CANVAS_SIZE;
  }

  py(y: number): number {
    // y=1.5→0 (top), y=1→50, y=0→150, y=−0.5→200 (bottom)
    return (this.Y_MAX - y) / this.Y_RANGE * this.CANVAS_SIZE;
  }

  private emitCustom(): void {
    this.valueChange.emit(buildCustomInterpolatorValue(this.x1, this.y1, this.x2, this.y2));
    this.restartPreview();
  }

  private restartPreview(): void {
    if (this.previewTimer) { clearTimeout(this.previewTimer); }
    this.showPreviewDot = false;
    this.previewTimer = setTimeout(() => {
      this.showPreviewDot = true;
      this.previewTimer = null;
    }, 50);
  }
}
