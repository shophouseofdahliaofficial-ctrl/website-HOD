import type { FabricObject } from './types';
import { isCanvasPlacedImage, isFrameImage, getFrameBorderPadding, getFrameBorderEnabled, getFrameBorderColor, getFrameBorderWeight, type PbTaggedObject } from './frameMeta';
import { getTextStyle, isTextObject, type PbCanvasTextStyle } from './textStyle';

export type { PbCanvasTextStyle };
export type PbFabricTextStyle = PbCanvasTextStyle;

export type ToolbarColorMode = 'fill' | 'stroke' | 'none';

export type PbCanvasObjectEditMeta = {
  objectType: string;
  label: string;
  showColor: boolean;
  showCrop: boolean;
  colorMode: ToolbarColorMode;
  fill: string;
  frameId?: string;
  layoutId?: string;
  locked: boolean;
  textStyle?: PbCanvasTextStyle;
  pbKind?: string;
  width?: number;
  height?: number;
  text?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDashArray?: number[] | null;
  strokeLineCap?: string;
  lineStartMarker?: string;
  lineEndMarker?: string;
  rx?: number;
  ry?: number;
  opacity?: number;
  angle?: number;
  frameFilter?: import('./frameImageStyle').PbFrameImageFilter;
  frameCornerRadius?: number;
  frameBorderEnabled?: boolean;
  frameBorderPadding?: number;
  frameBorderColor?: string;
  frameBorderWeight?: number;
  frameFilled?: boolean;
};

export type PbFabricObjectEditMeta = PbCanvasObjectEditMeta;

const STROKE = '#ff1e68';
const DEFAULT_SHAPE_FILL = '#3b82f6';

export function getToolbarConfig(obj: FabricObject): {
  showColor: boolean;
  showCrop: boolean;
  colorMode: ToolbarColorMode;
} {
  const type = (obj.type ?? '').toLowerCase();
  const pbKind = (obj as FabricObject & { pbKind?: string }).pbKind;
  if (pbKind === 'frame-image' || pbKind === 'image') {
    return { showColor: false, showCrop: false, colorMode: 'none' };
  }
  if (pbKind === 'image-frame') {
    return { showColor: false, showCrop: false, colorMode: 'none' };
  }
  if (type === 'image') {
    return { showColor: false, showCrop: true, colorMode: 'none' };
  }
  if (isTextObject(obj)) {
    return { showColor: true, showCrop: false, colorMode: 'fill' };
  }
  if (type === 'line' || type === 'path' || type === 'polyline') {
    return { showColor: true, showCrop: false, colorMode: 'stroke' };
  }
  if (
    type === 'rect' ||
    type === 'circle' ||
    type === 'ellipse' ||
    type === 'triangle' ||
    type === 'polygon' ||
    type === 'group'
  ) {
    return { showColor: true, showCrop: false, colorMode: 'fill' };
  }
  return { showColor: false, showCrop: false, colorMode: 'none' };
}

export function getObjectColor(obj: FabricObject, colorMode: ToolbarColorMode): string {
  if (colorMode === 'stroke') {
    const stroke = obj.stroke;
    if (typeof stroke === 'string' && stroke !== 'transparent') return stroke;
    return STROKE;
  }
  if (colorMode === 'fill') {
    const fill = obj.fill;
    if (typeof fill === 'string' && fill !== 'transparent') return fill;
    return DEFAULT_SHAPE_FILL;
  }
  return DEFAULT_SHAPE_FILL;
}

export function getObjectEditLabel(obj: FabricObject): string {
  const tagged = obj as FabricObject & { pbTextPreset?: string; pbKind?: string };
  if (tagged.pbKind === 'frame-image') return 'Frame photo';
  if (tagged.pbKind === 'image-frame') return 'Photo frame';
  if (tagged.pbKind === 'layout-headline') return 'Heading';
  if (tagged.pbKind === 'line') return 'Line';
  if (tagged.pbKind === 'draw') return 'Drawing';
  if (tagged.pbTextPreset === 'heading') return 'Heading';
  if (tagged.pbTextPreset === 'caption') return 'Caption';
  if (tagged.pbTextPreset === 'paragraph') return 'Paragraph';
  if (tagged.pbKind === 'emoji') return 'Emoji';
  const type = (obj.type ?? '').toLowerCase();
  if (type === 'image') return 'Image';
  if (isTextObject(obj)) return 'Text';
  if (type === 'line' || type === 'path' || type === 'polyline') return 'Drawing';
  if (
    type === 'rect' ||
    type === 'circle' ||
    type === 'ellipse' ||
    type === 'triangle' ||
    type === 'polygon' ||
    type === 'group'
  ) {
    return 'Shape';
  }
  return 'Object';
}

export function getObjectEditMeta(obj: FabricObject): PbCanvasObjectEditMeta {
  const config = getToolbarConfig(obj);
  const tagged = obj as FabricObject & {
    pbKind?: string;
    frameId?: string;
    layoutId?: string;
    stroke?: string;
    strokeWidth?: number;
    strokeDashArray?: number[] | null;
    rx?: number;
    ry?: number;
    frameFilter?: import('./frameImageStyle').PbFrameImageFilter;
    frameCornerRadius?: number;
  };
  
  let w = 0;
  let h = 0;
  if (obj && typeof obj.getBoundingRect === 'function') {
    try {
      const rect = obj.getBoundingRect();
      w = Math.round(rect.width);
      h = Math.round(rect.height);
    } catch {
      w = Math.round(obj.width ?? 0);
      h = Math.round(obj.height ?? 0);
    }
  } else if (obj) {
    w = Math.round(obj.width ?? 0);
    h = Math.round(obj.height ?? 0);
  }

  return {
    objectType: obj.type ?? 'object',
    label: getObjectEditLabel(obj),
    showColor: config.showColor,
    showCrop: config.showCrop,
    colorMode: config.colorMode,
    fill: getObjectColor(obj, config.colorMode),
    locked: isFrameImage(obj) ? false : !!obj.lockMovementX,
    textStyle: getTextStyle(obj) ?? undefined,
    pbKind: tagged.pbKind,
    frameId: tagged.frameId,
    layoutId: tagged.layoutId,
    width: w || undefined,
    height: h || undefined,
    text: isTextObject(obj) ? (obj as any).text : undefined,
    stroke: tagged.stroke,
    strokeWidth: tagged.strokeWidth,
    strokeDashArray: tagged.strokeDashArray,
    strokeLineCap: (obj as any).strokeLineCap,
    lineStartMarker: (obj as any).lineStartMarker,
    lineEndMarker: (obj as any).lineEndMarker,
    rx: tagged.rx,
    ry: tagged.ry,
    opacity: obj.opacity,
    angle: Math.round(obj.angle ?? 0),
    frameFilter: tagged.frameFilter ?? 'none',
    frameCornerRadius:
      typeof tagged.frameCornerRadius === 'number' ? Math.max(0, tagged.frameCornerRadius) : 0,
    frameBorderEnabled: isCanvasPlacedImage(obj) ? getFrameBorderEnabled(obj) : undefined,
    frameBorderPadding: isCanvasPlacedImage(obj) ? getFrameBorderPadding(obj) : undefined,
    frameBorderColor: isCanvasPlacedImage(obj) && (obj as PbTaggedObject).pbKind === 'image' ? getFrameBorderColor(obj) : undefined,
    frameBorderWeight: isCanvasPlacedImage(obj) && (obj as PbTaggedObject).pbKind === 'image' ? getFrameBorderWeight(obj) : undefined,
    frameFilled:
      tagged.pbKind === 'image-frame'
        ? !!(obj as FabricObject & { pbFrameFilled?: boolean }).pbFrameFilled
        : undefined,
  };
}
