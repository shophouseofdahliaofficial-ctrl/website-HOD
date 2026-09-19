import type { Canvas, FabricModule, FabricObject } from './types';
import {
  beginFrameBorderToggleTransition,
  getFrameById,
  getFrameGeometry,
  getFrameImageForFrame,
  getFrameObjects,
  highlightFrame,
  updateFrameImageCrop,
} from './frames';
import {
  getFrameCrop,
  getFrameId,
  getFrameBorderColor,
  getFrameBorderEnabled,
  getFrameBorderPadding,
  getFrameBorderWeight,
  isCanvasPlacedImage,
  isFrameEmptyHint,
  isFrameImage,
  isGalleryPreview,
  type PbTaggedObject,
} from './frameMeta';
import {
  applyCaptureFilterToDataUrl,
  isPhotoboothFilterId,
  PHOTOBOOTH_UI_FILTERS,
} from '@/lib/photobooth/captureFilters';

export type PbLegacyFrameImageFilter = 'grayscale' | 'sepia' | 'vintage' | 'vivid';

export type PbPhotoboothFrameFilter =
  | 'retro'
  | 'inst-sq'
  | 'film'
  | 'flash'
  | 'sunkissed'
  | 'autumn'
  | 'noir'
  | 'lomo';

export type PbFrameImageFilter = 'none' | PbPhotoboothFrameFilter | PbLegacyFrameImageFilter;

export type PbFrameImageStylePatch = {
  angle?: number;
  frameFilter?: PbFrameImageFilter;
  frameCornerRadius?: number;
  frameBorderEnabled?: boolean;
  frameBorderPadding?: number;
  frameBorderColor?: string;
  frameBorderWeight?: number;
};

export const PB_FRAME_IMAGE_FILTERS: Array<{ id: PbFrameImageFilter; label: string }> = [
  { id: 'none', label: 'Original' },
  ...(PHOTOBOOTH_UI_FILTERS as Array<{ id: PbPhotoboothFrameFilter; label: string }>),
];

const LEGACY_FRAME_IMAGE_FILTERS: PbLegacyFrameImageFilter[] = ['grayscale', 'sepia', 'vintage', 'vivid'];

function isLegacyFrameImageFilter(filter: string): filter is PbLegacyFrameImageFilter {
  return (LEGACY_FRAME_IMAGE_FILTERS as string[]).includes(filter);
}

export function normalizeFrameImageFilter(filter?: string | null): PbFrameImageFilter {
  if (!filter || filter === 'original') return 'none';
  if (filter === 'none') return 'none';
  if (PB_FRAME_IMAGE_FILTERS.some((f) => f.id === filter)) return filter as PbFrameImageFilter;
  if (isLegacyFrameImageFilter(filter)) return filter;
  return 'none';
}

export function getFrameImageFilter(obj: FabricObject): PbFrameImageFilter {
  return normalizeFrameImageFilter((obj as PbTaggedObject).frameFilter);
}

export function getFrameCornerRadius(obj: FabricObject): number {
  const radius = (obj as PbTaggedObject).frameCornerRadius;
  return typeof radius === 'number' && Number.isFinite(radius) ? Math.max(0, radius) : 0;
}

export function getFrameImageBorderPadding(obj: FabricObject): number {
  return getFrameBorderPadding(obj);
}

export function getFrameImageBorderColor(obj: FabricObject): string {
  return getFrameBorderColor(obj);
}

export function getFrameImageBorderWeight(obj: FabricObject): number {
  return getFrameBorderWeight(obj);
}

export function getFrameImageAngle(obj: FabricObject): number {
  const angle = obj.angle ?? 0;
  const normalized = Math.round(angle) % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

async function applyLegacyFabricFilters(
  fabric: FabricModule,
  img: FabricObject,
  filterId: PbLegacyFrameImageFilter,
): Promise<void> {
  const image = img as FabricObject & {
    filters?: unknown[];
    applyFilters?: () => Promise<unknown>;
  };
  if (typeof image.applyFilters !== 'function') return;

  const { filters } = fabric;
  switch (filterId) {
    case 'grayscale':
      image.filters = [new filters.Grayscale()];
      break;
    case 'sepia':
      image.filters = [new filters.Sepia()];
      break;
    case 'vintage':
      image.filters = [new filters.Vintage()];
      break;
    case 'vivid':
      image.filters = [new filters.Vibrance({ vibrance: 0.35 }), new filters.Saturation({ saturation: 0.2 })];
      break;
  }
  await image.applyFilters();
}

async function applyPhotoboothFilterToFabricImage(
  img: FabricObject,
  filterId: PbFrameImageFilter,
): Promise<void> {
  const tagged = img as PbTaggedObject;
  const fabricImg = img as FabricObject & {
    filters?: unknown[];
    applyFilters?: () => Promise<unknown>;
    setSrc?: (src: string, options?: { crossOrigin?: string }) => Promise<void>;
    getSrc?: () => string;
  };
  const sourceUrl = tagged.sourceUrl || fabricImg.getSrc?.() || '';
  if (!sourceUrl) return;
  if (!tagged.sourceUrl) tagged.sourceUrl = sourceUrl;

  const bakeId = filterId === 'none' ? 'original' : filterId;
  const displayUrl =
    bakeId === 'original' ? sourceUrl : await applyCaptureFilterToDataUrl(sourceUrl, bakeId);

  if (typeof fabricImg.setSrc === 'function') {
    await fabricImg.setSrc(displayUrl, { crossOrigin: 'anonymous' });
  }

  fabricImg.filters = [];
  if (typeof fabricImg.applyFilters === 'function') {
    await fabricImg.applyFilters();
  }
}

async function applyFrameImageFilters(
  fabric: FabricModule,
  img: FabricObject,
  filterId: PbFrameImageFilter,
): Promise<void> {
  if (isLegacyFrameImageFilter(filterId)) {
    await applyLegacyFabricFilters(fabric, img, filterId);
    return;
  }

  if (filterId === 'none' || isPhotoboothFilterId(filterId)) {
    await applyPhotoboothFilterToFabricImage(img, filterId);
  }
}

export type PbFrameImageStyleOptions = {
  onFrameBorderTransitionEnd?: () => void;
};

function applyFreeImageVisualStyle(fabric: FabricModule, img: FabricObject) {
  const tagged = img as PbTaggedObject;
  const w = Math.max(1, img.width ?? 1);
  const h = Math.max(1, img.height ?? 1);
  const padding = getFrameBorderPadding(img);
  const radius = getFrameCornerRadius(img);
  const maxPad = Math.max(0, Math.floor(Math.min(w, h) / 2) - 1);
  const safePad = Math.max(0, Math.min(padding, maxPad));
  const cw = Math.max(1, w - safePad * 2);
  const ch = Math.max(1, h - safePad * 2);
  const r = Math.max(0, Math.min(radius, Math.min(cw, ch) / 2));

  if (safePad > 0 || r > 0) {
    const clip = new fabric.Rect({
      width: cw,
      height: ch,
      rx: r,
      ry: r,
      originX: 'center',
      originY: 'center',
    });
    img.set({ clipPath: clip });
  } else {
    img.set({ clipPath: undefined });
  }
  tagged.frameCornerRadius = r;

  if (getFrameBorderEnabled(img)) {
    img.set({
      stroke: getFrameBorderColor(img),
      strokeWidth: getFrameBorderWeight(img),
      strokeUniform: true,
    });
  } else {
    img.set({ stroke: null, strokeWidth: 0, strokeDashArray: null });
  }
}

export async function applyFrameImageStyle(
  fabric: FabricModule,
  canvas: Canvas,
  img: FabricObject,
  patch: PbFrameImageStylePatch,
  pad: number,
  options?: PbFrameImageStyleOptions,
): Promise<void> {
  if (!isCanvasPlacedImage(img)) return;

  const tagged = img as PbTaggedObject;
  const framed = isFrameImage(img);
  const frameId = framed ? getFrameId(img) ?? '' : '';
  const frame = framed ? getFrameById(canvas, frameId) : null;
  const geom = frame ? getFrameGeometry(frame, pad) : null;

  if (patch.angle !== undefined) {
    img.set({ angle: patch.angle });
  }
  if (patch.frameCornerRadius !== undefined) {
    const radius = Math.max(0, Math.min(100, patch.frameCornerRadius));
    tagged.frameCornerRadius = radius;
  }
  if (patch.frameFilter !== undefined) {
    tagged.frameFilter = patch.frameFilter;
    await applyFrameImageFilters(fabric, img, patch.frameFilter);
  }
  if (patch.frameBorderEnabled !== undefined) {
    tagged.frameBorderEnabled = patch.frameBorderEnabled;
    if (framed && frameId) {
      beginFrameBorderToggleTransition(canvas, frameId, options?.onFrameBorderTransitionEnd);
    }
  }
  if (patch.frameBorderPadding !== undefined) {
    tagged.frameBorderPadding = Math.max(0, Math.min(80, Math.round(patch.frameBorderPadding)));
  }
  if (patch.frameBorderColor !== undefined && !framed) {
    tagged.frameBorderColor = patch.frameBorderColor;
  }
  if (patch.frameBorderWeight !== undefined && !framed) {
    tagged.frameBorderWeight = Math.max(1, Math.min(24, Math.round(patch.frameBorderWeight)));
  }

  if (geom) {
    updateFrameImageCrop(fabric, img, geom, pad, getFrameCrop(img));
    if (frame) highlightFrame(frame, false, canvas);
  } else {
    applyFreeImageVisualStyle(fabric, img);
    img.setCoords();
    img.dirty = true;
  }

  canvas.requestRenderAll();
}

export async function syncFrameImageVisualStyle(
  fabric: FabricModule,
  img: FabricObject,
  pad: number,
  canvas: Canvas,
): Promise<void> {
  if (isFrameImage(img)) {
    const frameId = getFrameId(img) ?? '';
    const frame = getFrameById(canvas, frameId);
    const geom = frame ? getFrameGeometry(frame, pad) : null;
    if (!geom) return;

    const filter = getFrameImageFilter(img);
    await applyFrameImageFilters(fabric, img, filter);
    updateFrameImageCrop(fabric, img, geom, pad, getFrameCrop(img));
    if (frame) highlightFrame(frame, false, canvas);
    return;
  }

  if ((img as PbTaggedObject).pbKind === 'image') {
    const filter = getFrameImageFilter(img);
    await applyFrameImageFilters(fabric, img, filter);
    applyFreeImageVisualStyle(fabric, img);
    img.setCoords();
    img.dirty = true;
  }
}

export async function syncAllPlacedImageStylesForExport(
  fabric: FabricModule,
  canvas: Canvas,
  pad: number,
): Promise<void> {
  for (const obj of canvas.getObjects()) {
    if (!isCanvasPlacedImage(obj)) continue;
    await syncFrameImageVisualStyle(fabric, obj, pad, canvas);
  }
}

/** Strip editor chrome and accidental image strokes before print/PDF export. */
export function preparePhotobookCanvasForPrintExport(canvas: Canvas): void {
  canvas.getObjects().forEach((obj) => {
    if (isGalleryPreview(obj) || isFrameEmptyHint(obj)) {
      obj.set({ visible: false });
      return;
    }

    if (isCanvasPlacedImage(obj) && !getFrameBorderEnabled(obj)) {
      obj.set({ stroke: null, strokeWidth: 0, strokeDashArray: null });
      obj.dirty = true;
    }
  });

  getFrameObjects(canvas).forEach((frame) => {
    if (!(frame as PbTaggedObject).pbFrameFilled) {
      frame.set({ visible: false });
      return;
    }
    highlightFrame(frame, false, canvas);
    const frameId = getFrameId(frame) ?? '';
    const frameImg = getFrameImageForFrame(canvas, frameId);
    if (frameImg && !getFrameBorderEnabled(frameImg)) {
      frame.set({ stroke: 'transparent', strokeWidth: 0 });
    }
  });

  canvas.requestRenderAll();
}
