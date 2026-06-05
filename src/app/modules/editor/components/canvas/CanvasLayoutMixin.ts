import * as _ from 'lodash';

import { DestroyableMixin, IDestroyable } from 'app/modules/editor/scripts/mixins';

export interface ICanvasLayout {
  readonly cssScale: number;
  readonly attrScale: number;
  getBounds(): Size;
  getViewport(): Size;
  getZoom(): number;
  getTranslation(): { tx: number; ty: number };
  setDimensions(bounds: Size, viewport: Size): void;
  setZoomPan(zoom: number, translation: Readonly<{ tx: number; ty: number }>): void;
}

class EmptyBase {}

export function CanvasLayoutMixin<TBase extends Constructor = typeof EmptyBase>(
  Base: TBase = (EmptyBase as unknown) as TBase,
): Constructor<ICanvasLayout> & TBase {
  return class CanvasLayout extends Base {
    private bounds = { w: 24, h: 24 };
    private viewport = { w: 24, h: 24 };
    private zoom = 1;
    private translation = { tx: 0, ty: 0 };

    /**
     * The 'cssScale' represents the number of CSS pixels per SVG viewport pixel.
     */
    get cssScale() {
      const { w: vWidth, h: vHeight } = this.getViewport();
      const { w: bWidth, h: bHeight } = this.getBounds();
      const vectorAspectRatio = vWidth / vHeight;
      const containerAspectRatio = bWidth / bHeight;
      if (vectorAspectRatio > containerAspectRatio) {
        return bWidth / vWidth;
      } else {
        return bHeight / vHeight;
      }
    }

    /**
     * The 'attrScale' represents the number of physical pixels per SVG viewport pixel.
     */
    get attrScale() {
      return this.cssScale * devicePixelRatio;
    }

    getBounds() {
      return this.bounds;
    }

    getViewport() {
      return this.viewport;
    }

    getZoom() {
      return this.zoom;
    }

    getTranslation() {
      return this.translation;
    }

    setDimensions(bounds: Size, viewport: Size) {
      if (!_.isEqual(this.bounds, bounds) || !_.isEqual(this.viewport, viewport)) {
        this.bounds = bounds;
        this.viewport = viewport;
        this.onDimensionsChanged(this.bounds, this.viewport);
      }
    }

    protected onDimensionsChanged(bounds: Size, viewport: Size) {}

    setZoomPan(zoom: number, translation: Readonly<{ tx: number; ty: number }>) {
      if (this.zoom !== zoom || !_.isEqual(this.translation, translation)) {
        this.zoom = zoom;
        this.translation = translation;
        this.onZoomPanChanged(zoom, translation);
      }
    }

    protected onZoomPanChanged(zoom: number, translation: Readonly<{ tx: number; ty: number }>) {}
  } as Constructor<ICanvasLayout> & TBase;
}

export interface Size {
  readonly w: number;
  readonly h: number;
}

/**
 * Combined Canvas + Destroyable mixin. Type-safe alternative to chaining mixin
 * calls, which TypeScript 3.8+ fails to infer correctly.
 */
export const CanvasLayoutDestroyableMixin = (): Constructor<ICanvasLayout & IDestroyable> =>
  CanvasLayoutMixin(DestroyableMixin()) as any;
