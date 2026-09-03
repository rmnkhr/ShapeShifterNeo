import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { ClipPathLayer, GroupLayer, Layer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Animation, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { ModelUtil } from 'app/modules/editor/scripts/common';
import {
  CATEGORY_ORDER,
  filterPropertyNamesByCategory,
  getCategoryLabel,
  getPropertyCategory,
  getPropertyIcon,
  getPropertyLabel,
} from 'app/modules/editor/scripts/common/PropertyAnimationMeta';
import { ActionModeService } from 'app/modules/editor/services';
import { State, Store } from 'app/modules/editor/store';
import { getLayerListTreeState } from 'app/modules/editor/store/common/selectors';
import * as _ from 'lodash';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  standalone: false,
  selector: 'app-layerlisttree',
  templateUrl: './layerlisttree.component.html',
  styleUrls: ['./layerlisttree.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayerListTreeComponent implements OnInit, Callbacks {
  layerModel$: Observable<LayerModel>;

  @Input() layer: Layer;

  // MouseEvents from this layer (or children layers further down the tree)
  // are recursively handled by parent components until they reach
  // the LayerTimelineComponent.
  @Output() layerClick = new EventEmitter<LayerEvent>();
  @Output() layerDoubleClick = new EventEmitter<LayerEvent>();
  @Output() layerMouseDown = new EventEmitter<LayerEvent>();
  @Output() layerToggleExpanded = new EventEmitter<LayerEvent>();
  @Output() layerToggleVisibility = new EventEmitter<LayerEvent>();
  @Output() addTimelineBlockClick = new EventEmitter<TimelineBlockEvent>();
  @Output() removeTimelinePropertyClick = new EventEmitter<TimelineBlockEvent>();
  @Output() convertToClipPathClick = new EventEmitter<LayerEvent>();
  @Output() convertToPathClick = new EventEmitter<LayerEvent>();
  @Output() convertToStrokedPathsClick = new EventEmitter<LayerEvent>();
  @Output() flattenGroupClick = new EventEmitter<LayerEvent>();

  readonly categoryOrder = CATEGORY_ORDER;

  constructor(
    private readonly store: Store<State>,
    private readonly actionModeService: ActionModeService,
  ) {}

  ngOnInit() {
    this.layerModel$ = this.store.select(getLayerListTreeState).pipe(
      map(
        ({
          animation,
          selectedLayerIds,
          collapsedLayerIds,
          hiddenLayerIds,
          hoveredLayerId,
          isActionMode,
        }) => {
          const isExpandable = this.isLayerExpandable();
          const availablePropertyNames = Array.from(
            ModelUtil.getAvailablePropertyNamesForLayer(this.layer, animation),
          );
          const getExistingPropertyNamesFn = (layerId: string) => {
            return _.keys(ModelUtil.getOrderedBlocksByPropertyByLayer(animation)[layerId]);
          };
          const existingPropertyNames = getExistingPropertyNamesFn(this.layer.id);
          // Everything the animate menu lists: properties that can still be
          // animated plus the ones that already have blocks (shown checked),
          // ordered by category and label.
          const allPropertyNames = _.sortBy(
            _.uniq([...availablePropertyNames, ...existingPropertyNames]),
            propertyName =>
              `${CATEGORY_ORDER.indexOf(getPropertyCategory(propertyName))}:${getPropertyLabel(
                propertyName,
              )}`,
          );
          const canBeConvertedToPath = this.layer instanceof ClipPathLayer;
          // We can't convert a path into a clip path if it has incompatible animation blocks.
          const canBeConvertedToClipPath =
            this.layer instanceof PathLayer &&
            // TODO: comparing the sets of all animatable properties for each layer type would be more robust
            !animation.blocks.some(b => !(b instanceof PathAnimationBlock));
          const canBeConvertedToStrokedPaths =
            this.layer instanceof PathLayer &&
            !!this.layer.pathData &&
            this.layer.isFilled() &&
            !this.layer.isStroked();
          const canBeFlattened =
            this.layer instanceof GroupLayer &&
            this.layer.children.length > 0 &&
            // TODO: allow merging groups w/ existing blocks in some cases?
            existingPropertyNames.length === 0 &&
            this.layer.children.every(l => {
              return (
                l instanceof PathLayer ||
                l instanceof ClipPathLayer ||
                // TODO: allow merging groups into groups w/ existing blocks in some cases?
                getExistingPropertyNamesFn(l.id).length === 0
              );
            });
          return {
            animation,
            isSelected: selectedLayerIds.has(this.layer.id),
            isHovered: hoveredLayerId === this.layer.id,
            isExpandable,
            isExpanded: !collapsedLayerIds.has(this.layer.id),
            isVisible: !hiddenLayerIds.has(this.layer.id),
            availablePropertyNames,
            existingPropertyNames,
            allPropertyNames,
            isActionMode,
            canBeConvertedToClipPath,
            canBeConvertedToPath,
            canBeConvertedToStrokedPaths,
            canBeFlattened,
          };
        },
      ),
    );
  }

  // @Override
  onLayerClick(event: MouseEvent, layer: Layer) {
    event.stopPropagation();
    if (!this.actionModeService.isActionMode()) {
      this.layerClick.emit({ event, layer });
    }
  }

  // @Override
  onLayerMouseDown(event: MouseEvent, layer: Layer) {
    if (!this.actionModeService.isActionMode()) {
      this.layerMouseDown.emit({ event, layer });
    }
  }

  // @Override
  onLayerToggleExpanded(event: MouseEvent, layer: Layer) {
    event.stopPropagation();
    if (this.isLayerExpandable()) {
      this.layerToggleExpanded.emit({ event, layer });
    }
  }

  // @Override
  onLayerToggleVisibility(event: MouseEvent, layer: Layer) {
    event.stopPropagation();
    if (!this.actionModeService.isActionMode()) {
      this.layerToggleVisibility.emit({ event, layer });
    }
  }

  // @Override
  // Stops propagation so the menu stays open — several properties can be
  // toggled in one visit; the X button or backdrop closes it.
  onAddTimelineBlockClick(event: MouseEvent, layer: Layer, propertyName: string) {
    event.stopPropagation();
    if (!this.actionModeService.isActionMode()) {
      this.addTimelineBlockClick.emit({ event, layer, propertyName });
    }
  }

  onRemoveTimelinePropertyClick(event: MouseEvent, layer: Layer, propertyName: string) {
    event.stopPropagation();
    if (!this.actionModeService.isActionMode()) {
      this.removeTimelinePropertyClick.emit({ event, layer, propertyName });
    }
  }

  // @Override
  onConvertToClipPathClick(event: MouseEvent, layer: Layer) {
    if (!this.actionModeService.isActionMode()) {
      this.convertToClipPathClick.emit({ event, layer });
    }
  }

  // @Override
  onConvertToPathClick(event: MouseEvent, layer: Layer) {
    if (!this.actionModeService.isActionMode()) {
      this.convertToPathClick.emit({ event, layer });
    }
  }

  // @Override
  onConvertToStrokedPathsClick(event: MouseEvent, layer: Layer) {
    if (!this.actionModeService.isActionMode()) {
      this.convertToStrokedPathsClick.emit({ event, layer });
    }
  }

  // @Override
  onFlattenGroupClick(event: MouseEvent, layer: Layer) {
    if (!this.actionModeService.isActionMode()) {
      this.flattenGroupClick.emit({ event, layer });
    }
  }

  // Used by *ngFor loop.
  trackLayerFn(index: number, layer: Layer) {
    return layer.id;
  }

  trackPropertyNameFn(index: number, propertyName: string) {
    return propertyName;
  }

  getLayerTypeLabel() {
    return this.layer.type === 'mask' ? 'Clip path' : this.layer.type;
  }

  getPropertyLabel(propertyName: string) {
    return getPropertyLabel(propertyName);
  }

  getPropertyIcon(propertyName: string) {
    return getPropertyIcon(propertyName);
  }

  getCategoryLabel(cat: string) {
    return getCategoryLabel(cat);
  }

  getCategoryPropertyNames(model: LayerModel, cat: string) {
    return filterPropertyNamesByCategory(model.allPropertyNames, cat);
  }

  private isLayerExpandable() {
    return this.layer instanceof VectorLayer || this.layer instanceof GroupLayer;
  }
}

export interface Callbacks {
  onLayerClick(event: MouseEvent, layer: Layer): void;
  onLayerMouseDown(event: MouseEvent, layer: Layer): void;
  onLayerToggleExpanded(event: MouseEvent, layer: Layer): void;
  onLayerToggleVisibility(event: MouseEvent, layer: Layer): void;
  onAddTimelineBlockClick(event: MouseEvent, layer: Layer, propertyName: string): void;
  onRemoveTimelinePropertyClick(event: MouseEvent, layer: Layer, propertyName: string): void;
  onConvertToClipPathClick(event: MouseEvent, layer: Layer): void;
  onConvertToPathClick(event: MouseEvent, layer: Layer): void;
  onConvertToStrokedPathsClick(event: MouseEvent, layer: Layer): void;
  onFlattenGroupClick(event: MouseEvent, layer: Layer): void;
}

interface LayerEvent {
  readonly event: MouseEvent;
  readonly layer: Layer;
}

interface TimelineBlockEvent {
  readonly event: MouseEvent;
  readonly layer: Layer;
  readonly propertyName: string;
}

interface LayerModel {
  readonly animation: Animation;
  readonly isSelected: boolean;
  readonly isHovered: boolean;
  readonly isExpandable: boolean;
  readonly isExpanded: boolean;
  readonly isVisible: boolean;
  readonly availablePropertyNames: ReadonlyArray<string>;
  readonly existingPropertyNames: ReadonlyArray<string>;
  readonly allPropertyNames: ReadonlyArray<string>;
  readonly isActionMode: boolean;
  readonly canBeConvertedToPath: boolean;
  readonly canBeConvertedToClipPath: boolean;
  readonly canBeConvertedToStrokedPaths: boolean;
  readonly canBeFlattened: boolean;
}
