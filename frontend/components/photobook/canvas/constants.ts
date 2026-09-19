/** Design page size in page-space pixels (Fabric coordinates inside the bleed pad). */
export const PB_PAGE_SIZE_PX = 380;

/** Extra canvas margin so selection handles are not clipped at page edges. */
export const PB_VIEW_PAD_PX = 56;

export const PB_CANVAS_SIZE_PX = PB_PAGE_SIZE_PX + PB_VIEW_PAD_PX * 2;

export const PB_SERIALIZE_PROPS = [
  'pbKind',
  'pbTextPreset',
  'name',
  'strokeUniform',
  'textTransform',
  'globalCompositeOperation',
  'pbLineType',
  'pathPoints',
  'lineStartMarker',
  'lineEndMarker',
  'strokeLineCap',
  'frameId',
  'layoutId',
  'isPlaceholder',
  'isTemplateLocked',
  'sourceUrl',
  'crop',
  'pbFrameFilled',
  'frameFilter',
  'frameCornerRadius',
  'frameBorderEnabled',
  'frameBorderPadding',
  'frameBorderColor',
  'frameBorderWeight',
] as const;

export type PbTextPresetKind = 'heading' | 'caption' | 'paragraph';

export type PbCanvasToolMode = 'select' | 'shapes' | 'draw' | 'lines';

export const PB_CHROME_KINDS = new Set(['page-bg', 'bleed-guide']);

export const PB_CROP_OVERLAY_NAME = 'pb-crop-overlay';
