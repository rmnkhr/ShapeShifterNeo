import { Injectable } from '@angular/core';
import { ModelUtil } from 'app/modules/editor/scripts/common';
import { State, Store } from 'app/modules/editor/store';
import { getHiddenLayerIds, getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import { getAnimation } from 'app/modules/editor/store/timeline/selectors';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { debounceTime, skip } from 'rxjs/operators';

import { FileExportService } from './fileexport.service';

const STORAGE_KEY = 'ss-autosave';
const AUTOSAVE_VERSION = 1;
const DEBOUNCE_MILLIS = 1000;

export type AutosaveStatus = 'idle' | 'saving' | 'saved';

export interface AutosaveState {
  readonly status: AutosaveStatus;
  readonly lastSavedAt?: Date;
}

/**
 * Continuously persists the current workspace (layers + timeline) to
 * localStorage and restores it when the app starts.
 */
@Injectable({ providedIn: 'root' })
export class AutosaveService {
  private readonly stateSubject = new BehaviorSubject<AutosaveState>({ status: 'idle' });

  constructor(private readonly store: Store<State>) {}

  observeState() {
    return this.stateSubject.asObservable();
  }

  /**
   * Restores the last autosaved workspace (if one exists) and begins
   * watching the store for changes. Called once at app startup.
   */
  init() {
    this.restore();
    const workspace$ = combineLatest([
      this.store.select(getVectorLayer),
      this.store.select(getAnimation),
      this.store.select(getHiddenLayerIds),
    ]).pipe(
      // Ignore the first emission (the initial/restored state).
      skip(1),
    );
    // Flip to 'saving' as soon as anything changes...
    workspace$.subscribe(() => {
      if (this.stateSubject.getValue().status !== 'saving') {
        this.stateSubject.next({ ...this.stateSubject.getValue(), status: 'saving' });
      }
    });
    // ...and persist once the changes settle.
    workspace$
      .pipe(debounceTime(DEBOUNCE_MILLIS))
      .subscribe(([vectorLayer, animation, hiddenLayerIds]) => {
        try {
          const jsonStr = JSON.stringify({
            version: AUTOSAVE_VERSION,
            layers: {
              vectorLayer: vectorLayer.toJSON(),
              hiddenLayerIds: Array.from(hiddenLayerIds),
            },
            timeline: {
              animation: animation.toJSON(),
            },
          });
          window.localStorage.setItem(STORAGE_KEY, jsonStr);
          this.stateSubject.next({ status: 'saved', lastSavedAt: new Date() });
        } catch (e) {
          // Quota errors etc. shouldn't break the app — just report idle.
          console.warn('autosave failed', e);
          this.stateSubject.next({ ...this.stateSubject.getValue(), status: 'idle' });
        }
      });
  }

  private restore() {
    let jsonStr: string;
    try {
      jsonStr = window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return;
    }
    if (!jsonStr) {
      return;
    }
    try {
      const jsonObj = JSON.parse(jsonStr);
      const parsed = FileExportService.fromJSON(jsonObj);
      const regenerated = ModelUtil.regenerateModelIds(
        parsed.vectorLayer,
        parsed.animation,
        parsed.hiddenLayerIds,
      );
      this.store.dispatch(
        new ResetWorkspace(
          regenerated.vectorLayer,
          regenerated.animation,
          regenerated.hiddenLayerIds,
        ),
      );
      this.stateSubject.next({ status: 'saved', lastSavedAt: new Date() });
    } catch (e) {
      // Corrupt autosave data — discard it rather than break startup.
      console.warn('failed to restore autosaved workspace', e);
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (ignored) {}
    }
  }
}
