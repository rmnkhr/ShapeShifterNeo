import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { Animation } from 'app/modules/editor/model/timeline';
import { Dragger } from 'app/modules/editor/scripts/dragger';
import { DestroyableMixin } from 'app/modules/editor/scripts/mixins';
import { ShortcutService, ThemeService } from 'app/modules/editor/services';
import * as $ from 'jquery';
import * as _ from 'lodash';
import { filter } from 'rxjs/operators';

import { TIMELINE_ANIMATION_PADDING } from './constants';

const HEADER_HEIGHT = 49;
const GRID_INTERVALS_MS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000];

@Directive({
  standalone: false,
  selector: '[appLayerTimelineGrid]' })
export class LayerTimelineGridDirective extends DestroyableMixin() implements OnInit {
  @Input()
  isHeader: boolean;
  @Output()
  scrub = new EventEmitter<ScrubEvent>();

  private readonly canvas: HTMLCanvasElement;
  private readonly $canvas: JQuery;
  private animation_: Animation;
  private currentTime_: number;
  private horizZoom_: number;

  constructor(elementRef: ElementRef, private readonly themeService: ThemeService) {
    super();
    this.canvas = elementRef.nativeElement;
    this.$canvas = $(this.canvas);
  }

  ngOnInit() {
    this.registerSubscription(
      this.themeService
        .asObservable()
        .pipe(filter(t => !t.isInitialPageLoad))
        .subscribe(t => this.redraw()),
    );
  }

  get horizZoom() {
    return this.horizZoom_;
  }

  @Input()
  set horizZoom(horizZoom: number) {
    if (this.horizZoom_ !== horizZoom) {
      this.horizZoom_ = horizZoom;
      this.redraw();
    }
  }

  get currentTime() {
    return this.currentTime_;
  }

  set currentTime(currentTime: number) {
    if (this.currentTime_ !== currentTime) {
      this.currentTime_ = currentTime;
      this.redraw();
    }
  }

  get animation() {
    return this.animation_;
  }

  @Input()
  set animation(animation: Animation) {
    this.animation_ = animation;
    this.redraw();
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    this.handleScrubEvent(event.clientX, ShortcutService.isOsDependentModifierKey(event));
    // tslint:disable-next-line: no-unused-expression
    new Dragger({
      direction: 'horizontal',
      downX: event.clientX,
      downY: event.clientY,
      shouldSkipSlopCheck: true,
      onDragFn: e => this.handleScrubEvent(e.clientX, ShortcutService.isOsDependentModifierKey(e)),
    });
    event.preventDefault();
    return false;
  }

  private handleScrubEvent(clientX: number, disableSnap: boolean) {
    const x = clientX - this.$canvas.offset().left;
    let time =
      ((x - TIMELINE_ANIMATION_PADDING) / (this.$canvas.width() - TIMELINE_ANIMATION_PADDING * 2)) *
      this.animation.duration;
    time = _.clamp(time, 0, this.animation.duration);
    this.scrub.emit({ time, disableSnap });
  }

  redraw() {
    if (!this.$canvas.is(':visible')) {
      return;
    }

    const width = this.$canvas.width();
    const height = this.$canvas.height();
    this.$canvas.attr('width', width * window.devicePixelRatio);
    this.$canvas.attr('height', height * window.devicePixelRatio);

    const ctx = this.canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.translate(TIMELINE_ANIMATION_PADDING, 0);

    const styles = getComputedStyle(this.canvas);
    const onVariant = styles.getPropertyValue('--ss-on-surface-variant').trim();
    const outline = styles.getPropertyValue('--ss-outline-variant').trim();
    const playhead = styles.getPropertyValue('--ss-playhead').trim() || '#e8542f';

    // Compute grid spacing (40 = minimum grid spacing in pixels).
    let interval = 0;
    let spacingMs = GRID_INTERVALS_MS[interval];
    while (spacingMs * this.horizZoom < 40 && interval < GRID_INTERVALS_MS.length - 1) {
      interval++;
      spacingMs = GRID_INTERVALS_MS[interval];
    }

    const spacingPx = spacingMs * this.horizZoom;

    if (this.isHeader) {
      ctx.strokeStyle = outline || this.themeService.getDividerTextColor();
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.55;
      for (let x = 0; round(x) <= round(width - TIMELINE_ANIMATION_PADDING * 2); x += spacingPx) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 16);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Text labels.
      ctx.fillStyle = onVariant || this.themeService.getSecondaryTextColor();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = `500 11px 'Hanken Grotesk', Roboto, 'Helvetica Neue', sans-serif`;
      for (
        let x = 0, t = 0, i = 0;
        round(x) <= round(width - TIMELINE_ANIMATION_PADDING * 2);
        x += spacingPx, t += spacingMs, i++
      ) {
        if (i % 5 !== 0 && x !== 0) {
          continue;
        }
        ctx.globalAlpha = 1;
        ctx.fillText(formatSeconds(t), x, 7);
        ctx.strokeStyle = outline || this.themeService.getDividerTextColor();
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = playhead;
      const playheadX = this.currentTime * this.horizZoom;
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(playheadX - 1, 8, 2, height - 8);
    } else {
      // Grid lines.
      ctx.fillStyle = outline || this.themeService.getDividerTextColor();
      ctx.globalAlpha = 0.55;
      for (
        let x = spacingPx;
        round(x) < round(width - TIMELINE_ANIMATION_PADDING * 2);
        x += spacingPx
      ) {
        ctx.fillRect(x - 0.5, HEADER_HEIGHT, 1, height - HEADER_HEIGHT);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = playhead;
      ctx.fillRect(this.currentTime * this.horizZoom - 1, HEADER_HEIGHT, 2, height - HEADER_HEIGHT);
    }
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    // This ensures that click events originating on top of the
    // host element aren't triggered in the component.
    event.stopPropagation();
  }
}

function round(n: number) {
  return _.round(n, 8);
}

function formatSeconds(ms: number) {
  const seconds = ms / 1000;
  return `${Number(seconds.toFixed(3))}s`;
}

export interface ScrubEvent {
  time: number;
  disableSnap: boolean;
}
