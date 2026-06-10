import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActionMode } from 'app/modules/editor/model/actionmode';
import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { FractionProperty, NameProperty, Option } from 'app/modules/editor/model/properties';
import { Animation, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { ColorUtil, ModelUtil } from 'app/modules/editor/scripts/common';
import {
  ActionModeService,
  LayerTimelineService,
  PlaybackService,
  ShortcutService,
  ThemeService,
} from 'app/modules/editor/services';
import { State, Store } from 'app/modules/editor/store';
import { getPropertyInputState } from 'app/modules/editor/store/common/selectors';
import { ThemeType } from 'app/modules/editor/store/theme/reducer';
import { SetAnimation } from 'app/modules/editor/store/timeline/actions';
import * as $ from 'jquery';
import * as _ from 'lodash';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

import { InspectedProperty } from './InspectedProperty';

declare const ga: Function;

// Section grouping for the property inspector. Properties are listed under these
// headers (in this order); anything not matched falls into a leading, unlabeled
// group so it renders first (e.g. 'name', 'pathData').
const PROPERTY_GROUPS: ReadonlyArray<{ label: string; properties: ReadonlyArray<string> }> = [
  { label: 'Fill', properties: ['fillColor', 'fillAlpha', 'fillType'] },
  {
    label: 'Stroke',
    properties: [
      'strokeColor',
      'strokeAlpha',
      'strokeWidth',
      'strokeLinecap',
      'strokeLinejoin',
      'strokeMiterLimit',
    ],
  },
  { label: 'Trim Path', properties: ['trimPathStart', 'trimPathEnd', 'trimPathOffset'] },
];

// Friendly labels shown in the inspector. The section header (Fill / Stroke /
// Trim Path) already gives context, so the per-row labels can be short.
const PROPERTY_DISPLAY_NAMES: { readonly [propertyName: string]: string } = {
  fillColor: 'Color',
  fillAlpha: 'Alpha',
  fillType: 'Type',
  strokeColor: 'Color',
  strokeAlpha: 'Alpha',
  strokeWidth: 'Width',
  strokeLinecap: 'Linecap',
  strokeLinejoin: 'Linejoin',
  strokeMiterLimit: 'Miter limit',
  trimPathStart: 'Start',
  trimPathEnd: 'End',
  trimPathOffset: 'Offset',
};

// TODO: when you enter a 'start time' larger than 'end time', transform 'end time' correctly
@Component({
  standalone: false,
  selector: 'app-propertyinput',
  templateUrl: './propertyinput.component.html',
  styleUrls: ['./propertyinput.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertyInputComponent implements OnInit {
  propertyInputModel$: Observable<PropertyInputModel>;

  // Map used to track user state that has been entered into textfields
  // but may not have been saved in the store.
  private readonly enteredValueMap = new Map<string, any>();

  themeState$: Observable<{ prevThemeType: ThemeType; currThemeType: ThemeType }>;

  constructor(
    private readonly store: Store<State>,
    private readonly actionModeService: ActionModeService,
    private readonly playbackService: PlaybackService,
    private readonly layerTimelineService: LayerTimelineService,
    readonly themeService: ThemeService,
  ) {}

  ngOnInit() {
    let prevThemeType: ThemeType;
    let currThemeType = this.themeService.getThemeType().themeType;
    this.propertyInputModel$ = this.store.select(getPropertyInputState).pipe(
      map(({ animation, isAnimationSelected, selectedBlockIds, vectorLayer, selectedLayerIds }) => {
        prevThemeType = currThemeType = this.themeService.getThemeType().themeType;
        if (selectedLayerIds.size) {
          return this.buildInspectedLayerProperties(vectorLayer, selectedLayerIds, animation);
        } else if (selectedBlockIds.size) {
          return this.buildInspectedBlockProperties(vectorLayer, animation, selectedBlockIds);
        } else if (isAnimationSelected) {
          return this.buildInspectedAnimationProperties(animation);
        } else {
          return {
            numSelections: 0,
            inspectedProperties: [],
            availablePropertyNames: [],
          } as PropertyInputModel;
        }
      }),
    );
    this.themeState$ = combineLatest(
      this.propertyInputModel$,
      this.themeService.asObservable(),
    ).pipe(
      map(([unused, { themeType }]) => {
        prevThemeType = currThemeType;
        currThemeType = this.themeService.getThemeType().themeType;
        return { prevThemeType, currThemeType };
      }),
    );
  }

  shouldShowStartActionModeButton(pim: PropertyInputModel) {
    return pim.numSelections === 1 && pim.model instanceof PathAnimationBlock;
  }

  shouldDisableStartActionModeButton(pim: PropertyInputModel) {
    if (!this.shouldShowStartActionModeButton(pim)) {
      return false;
    }
    const { fromValue, toValue } = pim.model as PathAnimationBlock;
    return !fromValue || !fromValue.getPathString() || !toValue || !toValue.getPathString();
  }

  onAutoFixPathsClick(pim: PropertyInputModel) {
    this.actionModeService.autoFix();
  }

  onStartActionModeClick() {
    ga('send', 'event', 'Action mode', 'Started');
    this.actionModeService.setActionMode(ActionMode.Selection);
  }

  shouldShowAnimateLayerButton(pim: PropertyInputModel) {
    return (
      pim.availablePropertyNames.length > 0 &&
      pim.numSelections === 1 &&
      (pim.model instanceof VectorLayer ||
        pim.model instanceof GroupLayer ||
        pim.model instanceof ClipPathLayer ||
        pim.model instanceof PathLayer)
    );
  }

  onAnimateLayerClick(layer: Layer, propertyName: string) {
    const clonedValue = layer.inspectableProperties
      .get(propertyName)
      .cloneValue((layer as any)[propertyName]);
    const currentTime = this.playbackService.getCurrentTime();
    this.layerTimelineService.addBlocks([
      {
        layerId: layer.id,
        propertyName,
        fromValue: clonedValue,
        toValue: clonedValue,
        currentTime,
      },
    ]);
  }

  shouldShowInvalidPathAnimationBlockMsg(pim: PropertyInputModel) {
    return (
      pim.numSelections === 1 &&
      pim.model instanceof PathAnimationBlock &&
      !pim.model.isAnimatable()
    );
  }

  isPathBlockFromValueEmpty(block: PathAnimationBlock) {
    return !block.fromValue || !block.fromValue.getPathString();
  }

  isPathBlockToValueEmpty(block: PathAnimationBlock) {
    return !block.toValue || !block.toValue.getPathString();
  }

  onValueEditorKeyDown(event: KeyboardEvent, ip: InspectedProperty<any>) {
    switch (event.keyCode) {
      // Up/down arrow buttons.
      case 38:
      case 40:
        ip.resolveEnteredValue();
        const $target = $(event.target) as JQuery<HTMLInputElement>;
        const numberValue = Number($target.val());
        if (isNaN(numberValue)) {
          break;
        }
        let delta = event.keyCode === 38 ? 1 : -1;

        if (ip.property instanceof FractionProperty) {
          delta *= 0.1;
        }

        if (event.shiftKey) {
          // TODO: make this more obvious somehow
          delta *= 10;
        } else if (ShortcutService.isOsDependentModifierKey(event)) {
          // TODO: make this more obvious somehow
          delta /= 10;
        }

        ip.property.setEditableValue(ip, 'value', Number((numberValue + delta).toFixed(6)));
        setTimeout(() => $target.get(0).select(), 0);
        return false;
    }
    return undefined;
  }

  private buildInspectedLayerProperties(
    vl: VectorLayer,
    selectedLayerIds: ReadonlySet<string>,
    animation: Animation,
  ) {
    const numSelections = selectedLayerIds.size;
    const selectedLayers = Array.from(selectedLayerIds).map(id => vl.findLayerById(id));
    if (numSelections > 1) {
      return {
        numSelections,
        icon: 'collection',
        description: `${numSelections} layers`,
        // TODO: implement batch editting
        inspectedProperties: [],
        availablePropertyNames: [],
      } as PropertyInputModel;
    }
    // Edit a single layer.
    const enteredValueMap = this.enteredValueMap;
    const layer = selectedLayers[0];
    const icon = layer.type;
    const description = layer.name;
    const inspectedProperties: InspectedProperty<any>[] = [];
    layer.inspectableProperties.forEach((property, propertyName) => {
      inspectedProperties.push(
        new InspectedProperty<any>(
          layer,
          property,
          propertyName,
          enteredValueMap,
          value => {
            // TODO: avoid dispatching the action if the properties are equal
            const clonedLayer: any = layer.clone();
            clonedLayer[propertyName] = value;
            this.layerTimelineService.updateLayer(clonedLayer);
          },
          // TODO: return the 'rendered' value if an animation is ongoing? (see AIA)
          undefined,
          enteredValue => {
            if (property instanceof NameProperty) {
              return LayerUtil.getUniqueLayerName([vl], NameProperty.sanitize(enteredValue));
            }
            return enteredValue;
          },
          // TODO: copy AIA conditions to determine whether this should be editable
          undefined,
        ),
      );
    });
    const availablePropertyNames = Array.from(
      ModelUtil.getAvailablePropertyNamesForLayer(layer, animation),
    );
    return {
      model: layer,
      numSelections,
      inspectedProperties,
      propertyGroups: this.groupInspectedProperties(inspectedProperties),
      icon,
      description,
      availablePropertyNames,
    } as PropertyInputModel;
  }

  private buildInspectedBlockProperties(
    vl: VectorLayer,
    animation: Animation,
    selectedBlockIds: ReadonlySet<string>,
  ) {
    const numSelections = selectedBlockIds.size;
    const selectedBlocks = Array.from(selectedBlockIds).map(id => {
      return _.find(animation.blocks, b => b.id === id);
    });
    if (numSelections > 1) {
      return {
        numSelections,
        icon: 'collection',
        // TODO: implement batch editting
        description: `${numSelections} property animations`,
        inspectedProperties: [],
        availablePropertyNames: [],
      } as PropertyInputModel;
    }
    const enteredValueMap = this.enteredValueMap;
    const block = selectedBlocks[0];
    const icon = 'animationblock';
    const description = block.propertyName;
    const blockLayer = vl.findLayerById(block.layerId);
    const subDescription = `for '${blockLayer.name}'`;
    const inspectedProperties: InspectedProperty<any>[] = [];
    block.inspectableProperties.forEach((property, propertyName) => {
      inspectedProperties.push(
        new InspectedProperty<any>(block, property, propertyName, enteredValueMap, value => {
          // TODO: avoid dispatching the action if the properties are equal
          const clonedBlock: any = block.clone();
          clonedBlock[propertyName] = value;
          this.layerTimelineService.updateBlocks([clonedBlock]);
        }),
      );
    });
    return {
      model: block,
      numSelections,
      inspectedProperties,
      propertyGroups: this.groupInspectedProperties(inspectedProperties),
      icon,
      description,
      subDescription,
      availablePropertyNames: [],
    } as PropertyInputModel;
  }

  private buildInspectedAnimationProperties(animation: Animation) {
    const store = this.store;
    const enteredValueMap = this.enteredValueMap;
    const icon = 'animation';
    const description = animation.name;
    const inspectedProperties: InspectedProperty<any>[] = [];
    animation.inspectableProperties.forEach((property, propertyName) => {
      inspectedProperties.push(
        new InspectedProperty<any>(
          animation,
          property,
          propertyName,
          enteredValueMap,
          value => {
            // TODO: avoid dispatching the action if the properties are equal
            const clonedAnimation: any = animation.clone();
            clonedAnimation[propertyName] = value;
            store.dispatch(new SetAnimation(clonedAnimation));
          },
          undefined,
          undefined,
          undefined,
        ),
      );
    });
    return {
      model: animation,
      numSelections: 1,
      inspectedProperties,
      propertyGroups: this.groupInspectedProperties(inspectedProperties),
      icon,
      description,
      availablePropertyNames: [],
    } as PropertyInputModel;
  }

  // Called from the HTML template.
  androidToCssColor(color: string) {
    return ColorUtil.androidToCssHexColor(color);
  }

  // The opaque #rrggbb value fed to the native <input type="color"> swatch
  // (the native picker has no alpha channel).
  colorToInputValue(androidColor: string) {
    const d = ColorUtil.parseAndroidColor(androidColor);
    if (!d) {
      return '#000000';
    }
    const hex = (n: number) => (n < 16 ? '0' : '') + n.toString(16);
    return '#' + hex(d.r) + hex(d.g) + hex(d.b);
  }

  // Fill width / handle position (%) for the bold fraction slider.
  fractionPercent(ip: InspectedProperty<any>) {
    const v = typeof ip.value === 'number' ? ip.value : 0;
    return _.clamp(v, 0, 1) * 100;
  }

  // The 0..1 slider for a FractionProperty moved. Native range events only fire
  // on user interaction (never on a programmatic [value] set), so a finer value
  // typed into the text field — e.g. 0.14 — is left untouched until the user
  // actually drags the slider, which then commits a clean 0.1-step value.
  onFractionSliderChange(ip: InspectedProperty<any>, event: Event) {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (isNaN(value)) {
      return;
    }
    // Discard any half-entered text value so the slider's value is what sticks.
    ip.resolveEnteredValue();
    ip.value = _.clamp(value, 0, 1);
  }

  // The color circle was used to pick a new color: apply the chosen rgb while
  // preserving the property's existing alpha.
  onColorPickerChange(ip: InspectedProperty<any>, event: Event) {
    const picked = ColorUtil.parseAndroidColor((event.target as HTMLInputElement).value);
    if (!picked) {
      return;
    }
    const existing = ColorUtil.parseAndroidColor(ip.value);
    const a = existing ? existing.a : 255;
    ip.value = ColorUtil.toAndroidString({ r: picked.r, g: picked.g, b: picked.b, a });
  }

  // Splits the flat inspected-property list into ordered, labeled sections.
  // Unmatched properties form a leading group with no header.
  private groupInspectedProperties(
    inspectedProperties: ReadonlyArray<InspectedProperty<any>>,
  ): PropertyGroup[] {
    const byName = new Map(inspectedProperties.map(ip => [ip.propertyName, ip]));
    const grouped = new Set<string>();
    const groups: PropertyGroup[] = [];
    for (const { label, properties } of PROPERTY_GROUPS) {
      const props = properties.map(name => byName.get(name)).filter(ip => !!ip);
      if (props.length) {
        props.forEach(ip => grouped.add(ip.propertyName));
        groups.push({ label, inspectedProperties: props });
      }
    }
    // Everything not claimed by a named group, kept in original order, leads.
    const ungrouped = inspectedProperties.filter(ip => !grouped.has(ip.propertyName));
    if (ungrouped.length) {
      groups.unshift({ label: undefined, inspectedProperties: ungrouped });
    }
    return groups;
  }

  // Friendly per-row label (falls back to the raw property name).
  displayName(ip: InspectedProperty<any>) {
    return PROPERTY_DISPLAY_NAMES[ip.propertyName] || ip.propertyName;
  }

  trackInspectedPropertyFn(index: number, ip: InspectedProperty<any>) {
    return ip.propertyName;
  }

  trackPropertyGroupFn(index: number, group: PropertyGroup) {
    return group.label || '__ungrouped__';
  }

  trackEnumOptionFn(index: number, option: Option) {
    return option.value;
  }
}

// TODO: use this for batch editing
// function getSharedPropertyNames(items: ReadonlyArray<Inspectable>) {
//   if (!items || !items.length) {
//     return [];
//   }
//   let shared: ReadonlyArray<string>;
//   items.forEach(item => {
//     const names = Array.from(item.inspectableProperties.keys());
//     if (!shared) {
//       shared = names;
//     } else {
//       shared = shared.filter(n => names.includes(n));
//     }
//   });
//   return shared;
// }

interface PropertyGroup {
  readonly label: string | undefined;
  readonly inspectedProperties: ReadonlyArray<InspectedProperty<any>>;
}

interface PropertyInputModel {
  readonly model?: any;
  readonly numSelections: number;
  readonly inspectedProperties: ReadonlyArray<InspectedProperty<any>>;
  readonly propertyGroups?: ReadonlyArray<PropertyGroup>;
  // TODO: use a union type here for better type safety?
  readonly icon?: string;
  readonly description?: string;
  readonly subDescription?: string;
  readonly availablePropertyNames: ReadonlyArray<string>;
}
