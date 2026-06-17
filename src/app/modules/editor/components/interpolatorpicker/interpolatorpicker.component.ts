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
  readonly CANVAS_SIZE = 180;
  readonly Y_OFFSET = 0.5; // canvas shows y ∈ [-0.5, 1.5]
  readonly Y_RANGE = 2.0;

  // Cubic-bezier control points.
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
    if (isCustomInterpolator(this.value)) {
      return 'Custom';
    }
    const preset = INTERPOLATORS.find(i => i.value === this.value);
    return preset ? preset.label : this.value;
  }

  get bezierCurveD(): string {
    const { px, py } = this;
    const [sx1, sy1] = [px(this.x1), py(this.y1)];
    const [sx2, sy2] = [px(this.x2), py(this.y2)];
    const [endX, endY] = [px(1), py(1)];
    return `M ${px(0)} ${py(0)} C ${sx1} ${sy1}, ${sx2} ${sy2}, ${endX} ${endY}`;
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
    this.draggingHandle = handle;
    (event.target as Element).setPointerCapture(event.pointerId);
  }

  onSvgPointerMove(event: PointerEvent): void {
    if (!this.draggingHandle) { return; }
    event.preventDefault();
    const svg = this.bezierCanvasRef?.nativeElement;
    if (!svg) { return; }
    const rect = svg.getBoundingClientRect();
    const rawX = (event.clientX - rect.left) / rect.width;
    const rawY = (event.clientY - rect.top) / rect.height;
    const valX = Math.max(0, Math.min(1, rawX));
    const valY = Math.max(-0.5, Math.min(1.5, (1 - rawY) * this.Y_RANGE - this.Y_OFFSET));

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

  // Map value-space → SVG pixel space.
  px(x: number): number {
    return x * this.CANVAS_SIZE;
  }

  py(y: number): number {
    // y=0 → bottom of canvas, y=1 → top. SVG y increases downward.
    // We show y ∈ [-0.5, 1.5] → [canvas_bottom, canvas_top]
    // pixel = (1 - (y + Y_OFFSET) / Y_RANGE) * CANVAS_SIZE
    return (1 - (y + this.Y_OFFSET) / this.Y_RANGE) * this.CANVAS_SIZE;
  }

  private emitCustom(): void {
    this.valueChange.emit(
      buildCustomInterpolatorValue(this.x1, this.y1, this.x2, this.y2),
    );
    this.restartPreview();
  }

  private restartPreview(): void {
    if (this.previewTimer) { clearTimeout(this.previewTimer); }
    this.showPreviewDot = false;
    this.previewTimer = setTimeout(() => {
      this.showPreviewDot = true;
      this.previewTimer = null;
    }, 0);
  }
}
