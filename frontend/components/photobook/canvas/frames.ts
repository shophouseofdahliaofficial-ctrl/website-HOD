import type { Canvas, FabricModule, FabricObject } from './types';
import type { PbPageDimensions } from './chrome';
import { isChromeObject } from './chrome';
import { PB_CROP_OVERLAY_NAME } from './constants';
import {
  defaultFrameCrop,
  getFrameBorderEnabled,
  getFrameBorderPadding,
  getFrameCrop,
  getFrameId,
  isFrameImage,
  isGalleryPreview,
  isImageFrame,
  isLayoutObject,
  PB_KIND_FRAME_IMAGE,
  PB_KIND_IMAGE_FRAME,
  PB_KIND_LAYOUT_HEADLINE,
  isLayoutHeadline,
  type PbFrameCrop,
  type PbTaggedObject,
} from './frameMeta';
import type { PbLayoutDefinition, PbLayoutFrameDef, PbLayoutId } from './layouts';
import { LAYOUT_HEADLINE_BAND_RATIO } from './layouts';
import { applyObjectControlStyle } from './controls';
import { attachFrameEmptyHintRender, ensureFrameEmptyHintRender } from './frameEmptyHintRender';
import { configureNewTextObject, refreshTextObjectGeometry } from './textLayout';
import { getTextPreset } from './textPresets';

function resolveLayoutHeadlineFontSize(bandH: number): number {
  const captionSize = getTextPreset('caption').style.fontSize;
  const targetSize = captionSize + 21;
  const bandCap = Math.round(bandH * 0.32);
  return Math.max(18, Math.min(targetSize, bandCap));
}

const FRAME_FILL = '#e8eaed';
const FRAME_BORDER = '#b8bcc4';
const FRAME_HIGHLIGHT = '#ff1e68';
const FRAME_HIGHLIGHT_WIDTH_HOVER = 5;
const FRAME_HIGHLIGHT_WIDTH_SELECTED = 5;

const FRAME_BORDER_TOGGLE_DELAY_MS = 1000;
const frameBorderTransitionUntil = new WeakMap<Canvas, Map<string, number>>();
const frameBorderTransitionTimers = new WeakMap<Canvas, Map<string, ReturnType<typeof setTimeout>>>();

function getFrameBorderTransitionMap<T>(
  store: WeakMap<Canvas, Map<string, T>>,
  canvas: Canvas,
): Map<string, T> {
  let map = store.get(canvas);
  if (!map) {
    map = new Map();
    store.set(canvas, map);
  }
  return map;
}

function isFrameBorderTransitionActive(canvas: Canvas | null | undefined, frameId: string | undefined): boolean {
  if (!canvas || !frameId) return false;
  const until = getFrameBorderTransitionMap(frameBorderTransitionUntil, canvas).get(frameId);
  if (until === undefined) return false;
  if (Date.now() >= until) {
    getFrameBorderTransitionMap(frameBorderTransitionUntil, canvas).delete(frameId);
    return false;
  }
  return true;
}

/** Suppress pink + static borders for 1s on toggle, then restore highlights. */
export function beginFrameBorderToggleTransition(
  canvas: Canvas,
  frameId: string,
  onComplete?: () => void,
) {
  const frame = getFrameById(canvas, frameId);
  if (!frame) return;

  const timers = getFrameBorderTransitionMap(frameBorderTransitionTimers, canvas);
  const untils = getFrameBorderTransitionMap(frameBorderTransitionUntil, canvas);
  const existing = timers.get(frameId);
  if (existing) clearTimeout(existing);

  untils.set(frameId, Date.now() + FRAME_BORDER_TOGGLE_DELAY_MS);
  highlightFrame(frame, false, canvas);

  const timer = setTimeout(() => {
    untils.delete(frameId);
    timers.delete(frameId);
    const frameImg = getFrameImageForFrame(canvas, frameId);
    syncFrameSelectionHighlight(canvas, frameImg ?? frame);
    onComplete?.();
    canvas.requestRenderAll();
  }, FRAME_BORDER_TOGGLE_DELAY_MS);

  timers.set(frameId, timer);
  canvas.requestRenderAll();
}

export function clearFrameBorderToggleTransitions(canvas: Canvas) {
  const timers = frameBorderTransitionTimers.get(canvas);
  timers?.forEach((timer) => clearTimeout(timer));
  frameBorderTransitionTimers.delete(canvas);
  frameBorderTransitionUntil.delete(canvas);
}

export type FrameHighlightState = false | 'hover' | 'selected';

function isCropOverlay(obj: FabricObject): boolean {
  return (obj as FabricObject & { name?: string }).name === PB_CROP_OVERLAY_NAME;
}

function isUserContent(obj: FabricObject): boolean {
  if (isChromeObject(obj) || isCropOverlay(obj) || isLayoutObject(obj) || isGalleryPreview(obj)) {
    return false;
  }
  return true;
}

export function getFrameObjects(canvas: Canvas): FabricObject[] {
  return canvas.getObjects().filter(isImageFrame);
}

export function getFrameImageObjects(canvas: Canvas): FabricObject[] {
  return canvas.getObjects().filter(isFrameImage);
}

export function findFrameAtPoint(
  canvas: Canvas,
  pageX: number,
  pageY: number,
  pad: number,
): FabricObject | null {
  const x = pageX - pad;
  const y = pageY - pad;
  const frames = getFrameObjects(canvas);
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i];
    const left = frame.left ?? 0;
    const top = frame.top ?? 0;
    const w = frame.width ?? 0;
    const h = frame.height ?? 0;
    if (x >= left - pad && x <= left - pad + w && y >= top - pad && y <= top - pad + h) {
      return frame;
    }
  }
  return null;
}

export function findFrameAtScenePoint(
  canvas: Canvas,
  sceneX: number,
  sceneY: number,
  pad: number,
): FabricObject | null {
  const frames = getFrameObjects(canvas);
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i];
    const geom = getFrameGeometry(frame, pad);
    if (!geom) continue;
    const left = pad + geom.x;
    const top = pad + geom.y;
    if (
      sceneX >= left &&
      sceneX <= left + geom.width &&
      sceneY >= top &&
      sceneY <= top + geom.height
    ) {
      return frame;
    }
  }
  return null;
}

export function getFrameImageForFrame(canvas: Canvas, frameId: string): FabricObject | null {
  return (
    getFrameImageObjects(canvas).find((img) => getFrameId(img) === frameId) ?? null
  );
}

export function isFrameFilled(canvas: Canvas, frameId: string): boolean {
  return !!getFrameImageForFrame(canvas, frameId);
}

export function hasAnyFilledFrame(canvas: Canvas): boolean {
  return getFrameImageObjects(canvas).length > 0;
}

export function getFirstEmptyFrame(canvas: Canvas): FabricObject | null {
  return getFrameObjects(canvas).find((f) => !isFrameFilled(canvas, getFrameId(f) ?? '')) ?? null;
}

export function getFrameById(canvas: Canvas, frameId: string): FabricObject | null {
  return getFrameObjects(canvas).find((f) => getFrameId(f) === frameId) ?? null;
}

/** Re-apply template lock flags after selection / marquee (frames must never move or resize). */
export function enforceTemplateFrameLocks(canvas: Canvas) {
  getFrameObjects(canvas).forEach((frame) => {
    (frame as FabricObject & { strokeDashArray?: number[] | null }).strokeDashArray = null;
    applyTemplateLock(frame);
    const filled = !!(frame as PbTaggedObject).pbFrameFilled;
    frame.set({
      lockMovementX: true,
      lockMovementY: true,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      hasControls: false,
      hasBorders: false,
      selectable: !filled,
      evented: !filled,
    });
  });
  getFrameImageObjects(canvas).forEach((img) => {
    if ((img as PbTaggedObject).pbFrameAdjustActive) return;
    applyTemplateLock(img);
  });
}

function applyTemplateLock(obj: FabricObject) {
  obj.set({
    lockMovementX: true,
    lockMovementY: true,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
    hasControls: false,
    hasBorders: false,
    selectable: true,
    evented: true,
    hoverCursor: 'pointer',
  });
  applyObjectControlStyle(obj as Parameters<typeof applyObjectControlStyle>[0]);
}

type FrameHitBounds = { left: number; top: number; width: number; height: number };

function setFrameImageHitBounds(img: FabricObject, geom: PbLayoutFrameDef, pad: number) {
  const bounds: FrameHitBounds = {
    left: pad + geom.x,
    top: pad + geom.y,
    width: geom.width,
    height: geom.height,
  };
  (img as PbTaggedObject & { _pbFrameHit?: FrameHitBounds })._pbFrameHit = bounds;
}

/** Scene-space hit test: only the visible frame rect, not the scaled image bleed. */
export function isFrameImageScenePointHit(
  img: FabricObject,
  point: { x: number; y: number },
): boolean {
  const tagged = img as PbTaggedObject & { _pbFrameHit?: FrameHitBounds; pbFrameAdjustActive?: boolean };
  if (tagged.pbFrameAdjustActive) {
    const rect = img.getBoundingRect();
    return (
      point.x >= rect.left &&
      point.x <= rect.left + rect.width &&
      point.y >= rect.top &&
      point.y <= rect.top + rect.height
    );
  }
  const hit = tagged._pbFrameHit;
  if (!hit) {
    const rect = img.getBoundingRect();
    return (
      point.x >= rect.left &&
      point.x <= rect.left + rect.width &&
      point.y >= rect.top &&
      point.y <= rect.top + rect.height
    );
  }
  return (
    point.x >= hit.left &&
    point.x <= hit.left + hit.width &&
    point.y >= hit.top &&
    point.y <= hit.top + hit.height
  );
}

export function attachFrameImageHitBounds(img: FabricObject, geom: PbLayoutFrameDef, pad: number) {
  setFrameImageHitBounds(img, geom, pad);
  img.containsPoint = function containsPointInFrame(this: FabricObject, point: { x: number; y: number }) {
    return isFrameImageScenePointHit(this, point);
  };
}

/**
 * Fabric 7 target finding uses getCoords(), not containsPoint.
 * Patch selection hit-testing so frame images only respond inside their frame rect.
 */
export function installFrameImageTargetHitTest(canvas: Canvas) {
  const selectable = canvas as unknown as {
    _pointIsInObjectSelectionArea: (
      obj: FabricObject,
      point: { x: number; y: number },
    ) => boolean;
  };
  const original = selectable._pointIsInObjectSelectionArea?.bind(canvas);
  if (!original) return;
  selectable._pointIsInObjectSelectionArea = (obj: FabricObject, point: { x: number; y: number }) => {
    if (isFrameImage(obj)) {
      return isFrameImageScenePointHit(obj, point);
    }
    return original(obj, point);
  };
}

export function createImageFrameObject(
  fabric: FabricModule,
  frame: PbLayoutFrameDef,
  layoutId: string,
  pad: number,
  filled = false,
): FabricObject {
  const group = new fabric.Rect({
    left: pad + frame.x,
    top: pad + frame.y,
    width: frame.width,
    height: frame.height,
    originX: 'left',
    originY: 'top',
    fill: filled ? 'transparent' : FRAME_FILL,
    stroke: FRAME_BORDER,
    strokeWidth: 1,
    strokeUniform: true,
    objectCaching: false,
    pbKind: PB_KIND_IMAGE_FRAME,
    frameId: frame.id,
    layoutId,
    isPlaceholder: !filled,
    isTemplateLocked: true,
    pbFrameFilled: filled,
  } as Record<string, unknown>);
  applyTemplateLock(group);
  attachFrameEmptyHintRender(group);
  return group;
}

function getFabricImageNaturalSize(img: FabricObject): { w: number; h: number } {
  const el = (img as FabricObject & { getElement?: () => HTMLImageElement }).getElement?.();
  const w = el?.naturalWidth || (img as FabricObject & { width?: number }).width || 1;
  const h = el?.naturalHeight || (img as FabricObject & { height?: number }).height || 1;
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

function computeRotationAwareCoverScale(
  imgW: number,
  imgH: number,
  frameW: number,
  frameH: number,
  angleDeg = 0,
): number {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return Math.max(
    frameW / imgW,
    frameH / imgH,
    frameW / (imgW * cos + imgH * sin),
    frameH / (imgW * sin + imgH * cos),
  );
}

function computeCoverTransform(
  imgW: number,
  imgH: number,
  frameW: number,
  frameH: number,
  crop: PbFrameCrop,
  frameLeft: number,
  frameTop: number,
  angleDeg = 0,
): { scaleX: number; scaleY: number; left: number; top: number } {
  const baseScale = computeRotationAwareCoverScale(imgW, imgH, frameW, frameH, angleDeg);
  const scale = baseScale * crop.scale;
  const centerX = frameLeft + frameW / 2 + crop.offsetX;
  const centerY = frameTop + frameH / 2 + crop.offsetY;
  return {
    scaleX: scale,
    scaleY: scale,
    left: centerX,
    top: centerY,
  };
}

export function getInsetFrameGeometry(frame: PbLayoutFrameDef, padding: number): PbLayoutFrameDef {
  const maxPad = Math.max(0, Math.floor(Math.min(frame.width, frame.height) / 2) - 1);
  const safePad = Math.max(0, Math.min(padding, maxPad));
  if (safePad <= 0) return frame;
  return {
    id: frame.id,
    x: frame.x + safePad,
    y: frame.y + safePad,
    width: Math.max(1, frame.width - safePad * 2),
    height: Math.max(1, frame.height - safePad * 2),
  };
}

export function createFrameClipPath(
  fabric: FabricModule,
  frame: PbLayoutFrameDef,
  pad: number,
  cornerRadius = 0,
): FabricObject {
  const rx = Math.max(0, cornerRadius);
  return new fabric.Rect({
    left: pad + frame.x,
    top: pad + frame.y,
    width: frame.width,
    height: frame.height,
    originX: 'left',
    originY: 'top',
    absolutePositioned: true,
    rx,
    ry: rx,
  });
}

export async function createFrameImageObject(
  fabric: FabricModule,
  sourceUrl: string,
  frame: PbLayoutFrameDef,
  layoutId: string,
  pad: number,
  crop: PbFrameCrop = defaultFrameCrop(),
): Promise<FabricObject> {
  const img = await fabric.FabricImage.fromURL(sourceUrl, { crossOrigin: 'anonymous' });
  const { w: imgW, h: imgH } = getFabricImageNaturalSize(img);
  const frameLeft = pad + frame.x;
  const frameTop = pad + frame.y;
  const transform = computeCoverTransform(
    imgW,
    imgH,
    frame.width,
    frame.height,
    crop,
    frameLeft,
    frameTop,
    0,
  );

  const clip = createFrameClipPath(fabric, frame, pad, 0);

  img.set({
    left: transform.left,
    top: transform.top,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    originX: 'center',
    originY: 'center',
    clipPath: clip,
    objectCaching: false,
    pbKind: PB_KIND_FRAME_IMAGE,
    frameId: frame.id,
    layoutId,
    sourceUrl,
    crop: { ...crop },
    frameFilter: 'none',
    frameCornerRadius: 0,
    frameBorderEnabled: false,
    stroke: null,
    strokeWidth: 0,
    angle: 0,
  } as Record<string, unknown>);

  applyTemplateLock(img);
  attachFrameImageHitBounds(img, frame, pad);
  return img;
}

export function updateFrameImageCrop(
  fabric: FabricModule,
  img: FabricObject,
  frame: PbLayoutFrameDef,
  pad: number,
  crop: PbFrameCrop,
) {
  const contentFrame = getInsetFrameGeometry(frame, getFrameBorderPadding(img));
  const { w: imgW, h: imgH } = getFabricImageNaturalSize(img);
  const frameLeft = pad + contentFrame.x;
  const frameTop = pad + contentFrame.y;
  const angleDeg = img.angle ?? 0;
  const transform = computeCoverTransform(
    imgW,
    imgH,
    contentFrame.width,
    contentFrame.height,
    crop,
    frameLeft,
    frameTop,
    angleDeg,
  );
  const cornerRadius =
    typeof (img as PbTaggedObject).frameCornerRadius === 'number'
      ? Math.max(0, (img as PbTaggedObject).frameCornerRadius!)
      : 0;
  const clip = createFrameClipPath(fabric, contentFrame, pad, cornerRadius);
  img.set({
    left: transform.left,
    top: transform.top,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    originX: 'center',
    originY: 'center',
    angle: angleDeg,
    clipPath: clip,
    crop: { ...crop },
    pbFrameAdjustActive: false,
  } as Record<string, unknown>);
  attachFrameImageHitBounds(img, frame, pad);
  img.setCoords();
}

export function setFrameFilledState(frame: FabricObject, filled: boolean) {
  const tagged = frame as PbTaggedObject;
  tagged.pbFrameFilled = filled;
  tagged.isPlaceholder = !filled;
  frame.set({
    fill: filled ? 'transparent' : FRAME_FILL,
    evented: !filled,
    selectable: !filled,
  });
  frame.dirty = true;
}

export function highlightFrame(
  frame: FabricObject | null,
  state: FrameHighlightState,
  canvas?: Canvas | null,
) {
  if (!frame || !isImageFrame(frame)) return;
  const tagged = frame as FabricObject & { strokeDashArray?: number[] | null };
  const frameId = getFrameId(frame) ?? '';
  const filled = !!(frame as PbTaggedObject).pbFrameFilled;
  const inTransition = isFrameBorderTransitionActive(canvas, frameId);
  let borderDisabled = false;
  if (filled && canvas) {
    const frameImg = getFrameImageForFrame(canvas, frameId);
    borderDisabled = !!frameImg && !getFrameBorderEnabled(frameImg);
  }

  tagged.strokeDashArray = null;
  if (inTransition) {
    frame.set({
      stroke: 'transparent',
      strokeWidth: 0,
    });
  } else if (state) {
    frame.set({
      stroke: FRAME_HIGHLIGHT,
      strokeWidth: state === 'selected' ? FRAME_HIGHLIGHT_WIDTH_SELECTED : FRAME_HIGHLIGHT_WIDTH_HOVER,
    });
  } else if (borderDisabled) {
    frame.set({
      stroke: 'transparent',
      strokeWidth: 0,
    });
  } else {
    frame.set({
      stroke: FRAME_BORDER,
      strokeWidth: 1,
    });
  }
  frame.dirty = true;
  frame.setCoords();
}

export function isFrameTargetSelected(
  canvas: Canvas,
  frame: FabricObject,
  target: FabricObject | null | undefined,
): boolean {
  if (!target) return false;
  const frameId = getFrameId(frame) ?? '';
  return target === frame || (isFrameImage(target) && getFrameId(target) === frameId);
}

export function syncFrameSelectionHighlight(canvas: Canvas, target: FabricObject | null | undefined) {
  getFrameObjects(canvas).forEach((frame) => highlightFrame(frame, false, canvas));
  if (!target) return;
  const frameId = getFrameId(target);
  if (!frameId) return;
  if (!isImageFrame(target) && !isFrameImage(target)) return;
  const frame = getFrameById(canvas, frameId);
  if (frame) highlightFrame(frame, 'selected', canvas);
}

export function getLayoutHeadlineObjects(canvas: Canvas): FabricObject[] {
  return canvas.getObjects().filter(isLayoutHeadline);
}

export function createLayoutHeadlineObject(
  fabric: FabricModule,
  layoutId: Extract<PbLayoutId, 'text-top' | 'text-bottom'>,
  pad: number,
  page: PbPageDimensions,
  initialText = 'Add headline here...',
): FabricObject {
  const bandH = Math.round(page.heightPx * LAYOUT_HEADLINE_BAND_RATIO);
  const fontSize = resolveLayoutHeadlineFontSize(bandH);
  const centerX = pad + page.widthPx / 2;
  const centerY =
    layoutId === 'text-top'
      ? pad + bandH / 2
      : pad + page.heightPx - bandH / 2;

  const text = new fabric.IText(initialText, {
    left: centerX,
    top: centerY,
    originX: 'center',
    originY: 'center',
    width: Math.max(120, page.widthPx - 48),
    fontSize,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 'bold',
    fill: '#1f2937',
    textAlign: 'center',
    objectCaching: false,
    lineHeight: 1.16,
    pbKind: PB_KIND_LAYOUT_HEADLINE,
    layoutId,
    pbTextPreset: 'caption',
  } as Record<string, unknown>);
  configureNewTextObject(text);
  return text;
}

export function normalizeLayoutHeadlineObject(obj: FabricObject, page: PbPageDimensions): void {
  if (!isLayoutHeadline(obj)) return;
  const bandH = Math.round(page.heightPx * LAYOUT_HEADLINE_BAND_RATIO);
  const fontSize = resolveLayoutHeadlineFontSize(bandH);
  const text = obj as FabricObject & { fontSize?: number; width?: number };
  text.fontSize = fontSize;
  text.width = Math.max(120, page.widthPx - 48);
  refreshTextObjectGeometry(obj);
}

export function normalizeLayoutHeadlineObjects(canvas: Canvas, page: PbPageDimensions): void {
  getLayoutHeadlineObjects(canvas).forEach((obj) => normalizeLayoutHeadlineObject(obj, page));
}

export function removeLayoutObjects(canvas: Canvas) {
  canvas.getObjects().forEach((obj) => {
    if (isLayoutObject(obj)) canvas.remove(obj);
  });
}

export function reorderPageLayers(canvas: Canvas) {
  const objects = canvas.getObjects();
  const bg = objects.find((o) => (o as PbTaggedObject).pbKind === 'page-bg');
  const frames = getFrameObjects(canvas);
  const frameImages = getFrameImageObjects(canvas);
  const layoutHeadlines = getLayoutHeadlineObjects(canvas);
  const userObjects = objects.filter(isUserContent);

  const ordered: FabricObject[] = [];
  if (bg) ordered.push(bg);
  ordered.push(...frameImages, ...frames, ...layoutHeadlines, ...userObjects);

  ordered.forEach((obj, index) => {
    canvas.moveObjectTo(obj, index);
  });
}

export function applyPageLayout(
  canvas: Canvas,
  fabric: FabricModule,
  layout: PbLayoutDefinition,
  pad: number,
  page: PbPageDimensions,
): void {
  removeLayoutObjects(canvas);

  if (layout.kind === 'blank' || layout.frames.length === 0) {
    reorderPageLayers(canvas);
    return;
  }

  const frames = layout.frames.map((f) => createImageFrameObject(fabric, f, layout.id, pad, false));
  frames.forEach((f) => canvas.add(f));

  const headlineLayoutId =
    layout.id === 'cover-title-top'
      ? 'text-top'
      : layout.id === 'cover-title-bottom'
        ? 'text-bottom'
        : layout.id;
  if (headlineLayoutId === 'text-top' || headlineLayoutId === 'text-bottom') {
    canvas.add(createLayoutHeadlineObject(fabric, headlineLayoutId, pad, page));
  }

  reorderPageLayers(canvas);
}

export function updatePageLayoutFrameGeometry(
  canvas: Canvas,
  fabric: FabricModule,
  layout: PbLayoutDefinition,
  pad: number,
): void {
  const frameDefsById = new Map(layout.frames.map((f) => [f.id, f]));

  getFrameObjects(canvas).forEach((frameObj) => {
    const frameId = getFrameId(frameObj) ?? '';
    const def = frameDefsById.get(frameId);
    if (!def) return;

    frameObj.set({
      left: pad + def.x,
      top: pad + def.y,
      width: def.width,
      height: def.height,
    });
    frameObj.setCoords();

    const img = getFrameImageForFrame(canvas, frameId);
    if (img) {
      updateFrameImageCrop(fabric, img, def, pad, getFrameCrop(img));
    }
  });
}

export function applyPageLayoutToCanvas(
  canvas: Canvas,
  fabric: FabricModule,
  layout: PbLayoutDefinition,
  pad: number,
  page: PbPageDimensions,
): void {
  const existingFrames = getFrameObjects(canvas);
  const canUpdateGeometry =
    layout.kind !== 'blank' &&
    layout.frames.length > 0 &&
    existingFrames.length === layout.frames.length &&
    layout.frames.every((def) =>
      existingFrames.some(
        (frameObj) =>
          getFrameId(frameObj) === def.id &&
          (frameObj as PbTaggedObject).layoutId === layout.id,
      ),
    );

  if (canUpdateGeometry) {
    updatePageLayoutFrameGeometry(canvas, fabric, layout, pad);
    reorderPageLayers(canvas);
    return;
  }

  applyPageLayout(canvas, fabric, layout, pad, page);
}

export function getFrameGeometry(
  frame: FabricObject,
  pad: number,
): PbLayoutFrameDef | null {
  if (!isImageFrame(frame)) return null;
  return {
    id: getFrameId(frame) ?? 'f-0',
    x: (frame.left ?? pad) - pad,
    y: (frame.top ?? pad) - pad,
    width: frame.width ?? 0,
    height: frame.height ?? 0,
  };
}

export async function placeImageInFrame(
  canvas: Canvas,
  fabric: FabricModule,
  frame: FabricObject,
  sourceUrl: string,
  pad: number,
  crop?: PbFrameCrop,
): Promise<FabricObject> {
  const geom = getFrameGeometry(frame, pad);
  if (!geom) throw new Error('Invalid frame');
  const layoutId = (frame as PbTaggedObject).layoutId ?? 'single';
  const frameId = getFrameId(frame) ?? geom.id;

  const existing = getFrameImageForFrame(canvas, frameId);
  if (existing) canvas.remove(existing);

  const img = await createFrameImageObject(
    fabric,
    sourceUrl,
    geom,
    layoutId,
    pad,
    crop ?? defaultFrameCrop(),
  );
  canvas.add(img);
  setFrameFilledState(frame, true);
  reorderPageLayers(canvas);
  return img;
}

export async function placeImageInFrameById(
  canvas: Canvas,
  fabric: FabricModule,
  frameId: string,
  sourceUrl: string,
  pad: number,
  crop?: PbFrameCrop,
): Promise<FabricObject | null> {
  const frame = getFrameById(canvas, frameId);
  if (!frame) return null;
  return placeImageInFrame(canvas, fabric, frame, sourceUrl, pad, crop);
}

export function restoreFrameImagesAfterLoad(
  canvas: Canvas,
  fabric: FabricModule,
  pad: number,
  page?: PbPageDimensions,
): void {
  getFrameObjects(canvas).forEach((frame) => {
    const frameId = getFrameId(frame) ?? '';
    const filled = isFrameFilled(canvas, frameId);
    setFrameFilledState(frame, filled);
    attachFrameEmptyHintRender(frame);
  });
  ensureFrameEmptyHintRender(canvas);
  if (page) {
    normalizeLayoutHeadlineObjects(canvas, page);
  }

  void (async () => {
    const images = getFrameImageObjects(canvas);
    for (const img of images) {
      const geom = getFrameGeometry(
        getFrameObjects(canvas).find((f) => getFrameId(f) === getFrameId(img)) ?? img,
        pad,
      );
      if (!geom) continue;
      const sourceUrl = (img as PbTaggedObject).sourceUrl;
      if (!sourceUrl) continue;
      try {
        const oldTagged = img as PbTaggedObject;
        const fresh = await createFrameImageObject(
          fabric,
          sourceUrl,
          geom,
          oldTagged.layoutId ?? 'single',
          pad,
          getFrameCrop(img),
        );
        fresh.set({
          angle: img.angle ?? 0,
          frameFilter: oldTagged.frameFilter ?? 'none',
          frameCornerRadius: oldTagged.frameCornerRadius ?? 0,
          frameBorderEnabled: oldTagged.frameBorderEnabled === true,
          frameBorderPadding: oldTagged.frameBorderPadding ?? 0,
          frameBorderColor: oldTagged.frameBorderColor,
          frameBorderWeight: oldTagged.frameBorderWeight,
        } as Record<string, unknown>);
        const idx = canvas.getObjects().indexOf(img);
        canvas.remove(img);
        canvas.insertAt(idx, fresh);
        const { syncFrameImageVisualStyle } = await import('./frameImageStyle');
        await syncFrameImageVisualStyle(fabric, fresh, pad, canvas);
      } catch {
        attachFrameImageHitBounds(img, geom, pad);
        updateFrameImageCrop(fabric, img, geom, pad, getFrameCrop(img));
      }
    }
    reorderPageLayers(canvas);
    getFrameObjects(canvas).forEach((frame) => highlightFrame(frame, false, canvas));

    const { syncFrameImageVisualStyle } = await import('./frameImageStyle');
    for (const obj of canvas.getObjects()) {
      if ((obj as PbTaggedObject).pbKind === 'image') {
        await syncFrameImageVisualStyle(fabric, obj, pad, canvas);
      }
    }

    canvas.requestRenderAll();
  })();
}

export { computeCoverTransform, computeRotationAwareCoverScale, FRAME_BORDER, FRAME_FILL, FRAME_HIGHLIGHT, getFabricImageNaturalSize };
export { ensureFrameEmptyHintRender, setFrameEmptyHintVisible, setFrameEmptyHintsVisible, restoreAllEmptyFrameHints } from './frameEmptyHintRender';
