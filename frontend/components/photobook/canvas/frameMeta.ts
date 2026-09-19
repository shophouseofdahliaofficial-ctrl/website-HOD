import type { FabricObject } from './types';

export type PbFrameCrop = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type PbFrameImageFilter = import('./frameImageStyle').PbFrameImageFilter;

export type PbTaggedObject = FabricObject & {
  pbKind?: string;
  frameId?: string;
  layoutId?: string;
  isPlaceholder?: boolean;
  isTemplateLocked?: boolean;
  sourceUrl?: string;
  crop?: PbFrameCrop;
  pbFrameFilled?: boolean;
  pbFrameAdjustActive?: boolean;
  frameFilter?: PbFrameImageFilter;
  frameCornerRadius?: number;
  frameBorderEnabled?: boolean;
  frameBorderPadding?: number;
  frameBorderColor?: string;
  frameBorderWeight?: number;
};

export const PB_DEFAULT_FRAME_BORDER_COLOR = '#ffffff';
export const PB_DEFAULT_FRAME_BORDER_WEIGHT = 2;

export const PB_KIND_IMAGE_FRAME = 'image-frame';
export const PB_KIND_FRAME_IMAGE = 'frame-image';
export const PB_KIND_FRAME_ADJUST_GHOST = 'frame-adjust-ghost';
export const PB_KIND_FRAME_EMPTY_HINT = 'frame-empty-hint';

export function isImageFrame(obj: FabricObject | null | undefined): boolean {
  return (obj as PbTaggedObject)?.pbKind === PB_KIND_IMAGE_FRAME;
}

export function isFrameImage(obj: FabricObject | null | undefined): boolean {
  return (obj as PbTaggedObject)?.pbKind === PB_KIND_FRAME_IMAGE;
}

/** Frame photo or a free-floating gallery/canvas image (not stickers). */
export function isCanvasPlacedImage(obj: FabricObject | null | undefined): boolean {
  const kind = (obj as PbTaggedObject)?.pbKind;
  return isFrameImage(obj) || kind === 'image';
}

export function isFrameAdjustGhost(obj: FabricObject | null | undefined): boolean {
  return (obj as PbTaggedObject)?.pbKind === PB_KIND_FRAME_ADJUST_GHOST;
}

export function isFrameEmptyHint(obj: FabricObject | null | undefined): boolean {
  return (obj as PbTaggedObject)?.pbKind === PB_KIND_FRAME_EMPTY_HINT;
}

export const PB_KIND_LAYOUT_HEADLINE = 'layout-headline';
export const PB_KIND_GALLERY_PREVIEW = 'gallery-preview';

export function isGalleryPreview(obj: FabricObject | null | undefined): boolean {
  const tagged = obj as PbTaggedObject & { name?: string };
  return tagged?.pbKind === PB_KIND_GALLERY_PREVIEW || tagged?.name === 'pb-gallery-preview';
}

export function isLayoutHeadline(obj: FabricObject | null | undefined): boolean {
  return (obj as PbTaggedObject)?.pbKind === PB_KIND_LAYOUT_HEADLINE;
}

export function isLayoutObject(obj: FabricObject | null | undefined): boolean {
  const kind = (obj as PbTaggedObject)?.pbKind;
  return (
    kind === PB_KIND_IMAGE_FRAME ||
    kind === PB_KIND_FRAME_IMAGE ||
    kind === PB_KIND_FRAME_ADJUST_GHOST ||
    kind === PB_KIND_FRAME_EMPTY_HINT ||
    kind === PB_KIND_LAYOUT_HEADLINE
  );
}

export function getFrameId(obj: FabricObject): string | undefined {
  return (obj as PbTaggedObject).frameId;
}

export function getLayoutId(obj: FabricObject): string | undefined {
  return (obj as PbTaggedObject).layoutId;
}

export function getFrameCrop(obj: FabricObject): PbFrameCrop {
  const tagged = obj as PbTaggedObject;
  return tagged.crop ?? { scale: 1, offsetX: 0, offsetY: 0 };
}

export function defaultFrameCrop(): PbFrameCrop {
  return { scale: 1, offsetX: 0, offsetY: 0 };
}

export function getFrameBorderEnabled(obj: FabricObject): boolean {
  return (obj as PbTaggedObject).frameBorderEnabled === true;
}

export function getFrameBorderPadding(obj: FabricObject): number {
  const padding = (obj as PbTaggedObject).frameBorderPadding;
  return typeof padding === 'number' && Number.isFinite(padding) ? Math.max(0, padding) : 0;
}

export function getFrameBorderColor(obj: FabricObject): string {
  const color = (obj as PbTaggedObject).frameBorderColor;
  return typeof color === 'string' && color.trim() ? color : PB_DEFAULT_FRAME_BORDER_COLOR;
}

export function getFrameBorderWeight(obj: FabricObject): number {
  const weight = (obj as PbTaggedObject).frameBorderWeight;
  return typeof weight === 'number' && Number.isFinite(weight) ? Math.max(1, Math.min(24, weight)) : PB_DEFAULT_FRAME_BORDER_WEIGHT;
}
