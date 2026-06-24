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
  pathData: { label: 'Morph', icon: 'animation', cat: 'path' },
  fillColor: { label: 'Color', icon: 'format_color_fill', cat: 'fill' },
  fillAlpha: { label: 'Alpha', icon: 'opacity', cat: 'fill' },
  strokeColor: { label: 'Color', icon: 'border_color', cat: 'stroke' },
  strokeAlpha: { label: 'Alpha', icon: 'opacity', cat: 'stroke' },
  strokeWidth: { label: 'Width', icon: 'line_weight', cat: 'stroke' },
  trimPathStart: { label: 'Start', icon: 'content_cut', cat: 'trim' },
  trimPathEnd: { label: 'End', icon: 'content_cut', cat: 'trim' },
  trimPathOffset: { label: 'Offset', icon: 'sync', cat: 'trim' },
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

// Filters `propertyNames` down to the ones in `cat` that match the (already
// lowercased + trimmed) search query.
export function filterPropertyNames(
  propertyNames: ReadonlyArray<string>,
  cat: string,
  query: string,
) {
  return propertyNames.filter(propertyName => {
    if (getPropertyCategory(propertyName) !== cat) {
      return false;
    }
    if (!query) {
      return true;
    }
    return (
      getPropertyLabel(propertyName).toLowerCase().includes(query) ||
      propertyName.toLowerCase().includes(query)
    );
  });
}
