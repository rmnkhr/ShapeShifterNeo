import { VectorLayer } from 'app/modules/editor/model/layers';
import { Action } from 'app/modules/editor/store';

export enum LayerActionTypes {
  SetVectorLayer = '__layers__SET_VECTOR_LAYER',
  SetSelectedLayers = '__layers__SET_SELECTED_LAYERS',
  SetHiddenLayers = '__layers__SET_HIDDEN_LAYERS',
  SetCollapsedLayers = '__layers__SET_COLLAPSED_LAYERS',
  SetOnionSkinEnabled = '__layers__SET_ONION_SKIN_ENABLED',
}

export class SetVectorLayer implements Action {
  readonly type = LayerActionTypes.SetVectorLayer;
  readonly payload: { vectorLayer: VectorLayer };
  constructor(vectorLayer: VectorLayer) {
    this.payload = { vectorLayer };
  }
}

export class SetSelectedLayers implements Action {
  readonly type = LayerActionTypes.SetSelectedLayers;
  readonly payload: { layerIds: ReadonlySet<string> };
  constructor(layerIds: ReadonlySet<string>) {
    this.payload = { layerIds };
  }
}

export class SetHiddenLayers implements Action {
  readonly type = LayerActionTypes.SetHiddenLayers;
  readonly payload: { layerIds: ReadonlySet<string> };
  constructor(layerIds: ReadonlySet<string>) {
    this.payload = { layerIds };
  }
}

export class SetCollapsedLayers implements Action {
  readonly type = LayerActionTypes.SetCollapsedLayers;
  readonly payload: { layerIds: ReadonlySet<string> };
  constructor(layerIds: ReadonlySet<string>) {
    this.payload = { layerIds };
  }
}

export class SetOnionSkinEnabled implements Action {
  readonly type = LayerActionTypes.SetOnionSkinEnabled;
  readonly payload: { enabled: boolean };
  constructor(enabled: boolean) {
    this.payload = { enabled };
  }
}

export type LayerActions =
  | SetVectorLayer
  | SetSelectedLayers
  | SetHiddenLayers
  | SetCollapsedLayers
  | SetOnionSkinEnabled;
