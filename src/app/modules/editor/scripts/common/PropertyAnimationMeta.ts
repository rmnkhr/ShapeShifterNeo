import * as _ from 'lodash';

// Shared metadata for the "Add animation" property pickers. Used by both the
// layer-tree's per-layer animate menu (LayerListTreeComponent) and the property
// inspector's animate-this-layer menu (PropertyInputComponent) so the two stay
// in sync.

export const CATEGORY_ORDER = ['transform', 'path', 'fill', 'stroke', 'trim'];

export const CATEGORY_LABELS: _.Dictionary<string> = {
  transform: 'Transform',
  path: 'Path',
  fill: 'Fill',
  stroke: 'Stroke',
  trim: 'Trim',
};

export const PROPERTY_META: _.Dictionary<{ label: string; icon: string; cat: string }> = {
  rotation: { label: 'Rotation', icon: 'rotate_right', cat: 'transform' },
  pivotX: { label: 'Pivot X', icon: 'open_with', cat: 'transform' },
  pivotY: { label: 'Pivot Y', icon: 'open_with', cat: 'transform' },
  scaleX: { label: 'Scale X', icon: 'swap_horiz', cat: 'transform' },
  scaleY: { label: 'Scale Y', icon: 'swap_vert', cat: 'transform' },
  translateX: { label: 'Translate X', icon: 'east', cat: 'transform' },
  translateY: { label: 'Translate Y', icon: 'south', cat: 'transform' },
  pathData: { label: 'Path morph', icon: 'animation', cat: 'path' },
  fillColor: { label: 'Fill color', icon: 'format_color_fill', cat: 'fill' },
  fillAlpha: { label: 'Fill alpha', icon: 'opacity', cat: 'fill' },
  strokeColor: { label: 'Stroke color', icon: 'border_color', cat: 'stroke' },
  strokeAlpha: { label: 'Stroke alpha', icon: 'opacity', cat: 'stroke' },
  strokeWidth: { label: 'Stroke width', icon: 'line_weight', cat: 'stroke' },
  trimPathStart: { label: 'Trim start', icon: 'content_cut', cat: 'trim' },
  trimPathEnd: { label: 'Trim end', icon: 'content_cut', cat: 'trim' },
  trimPathOffset: { label: 'Trim offset', icon: 'sync', cat: 'trim' },
};

export function getPropertyLabel(propertyName: string) {
  return PROPERTY_META[propertyName] ? PROPERTY_META[propertyName].label : _.startCase(propertyName);
}

export function getPropertyIcon(propertyName: string) {
  return PROPERTY_META[propertyName] ? PROPERTY_META[propertyName].icon : 'animation';
}

export function getPropertyCategory(propertyName: string) {
  return PROPERTY_META[propertyName] ? PROPERTY_META[propertyName].cat : 'transform';
}

export function getCategoryLabel(cat: string) {
  return CATEGORY_LABELS[cat] || _.upperCase(cat);
}

export function filterPropertyNamesByCategory(
  propertyNames: ReadonlyArray<string>,
  cat: string,
) {
  return propertyNames.filter(propertyName => getPropertyCategory(propertyName) === cat);
}
