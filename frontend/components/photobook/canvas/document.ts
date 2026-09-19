import type { Canvas, FabricObject } from './types';
import type { PbCanvasSerialized } from './types';
import { PB_SERIALIZE_PROPS, PB_CHROME_KINDS, PB_CROP_OVERLAY_NAME } from './constants';
import { isChromeObject, sendPageBackgroundToBack } from './chrome';
import {
  isFrameEmptyHint,
  isGalleryPreview,
  PB_KIND_FRAME_ADJUST_GHOST,
  PB_KIND_FRAME_EMPTY_HINT,
  PB_KIND_FRAME_IMAGE,
  PB_KIND_GALLERY_PREVIEW,
  PB_KIND_IMAGE_FRAME,
  PB_KIND_LAYOUT_HEADLINE,
} from './frameMeta';
import { normalizeSerializedImageSources, reviveSvgFabricImages } from './imageLoad';
import type { FabricModule } from './types';

type JsonPayload = { objects?: Array<{ type?: string; pbKind?: string; text?: string }> };

const DEFAULT_PAGE_BG = '#ffffff';
const DEFAULT_LAYOUT_HEADLINE = 'Add headline here...';

const PRINT_LAYOUT_CHROME_KINDS = new Set([
  ...PB_CHROME_KINDS,
  PB_KIND_IMAGE_FRAME,
  PB_KIND_FRAME_EMPTY_HINT,
  PB_KIND_GALLERY_PREVIEW,
  PB_KIND_FRAME_ADJUST_GHOST,
]);

export function canvasHasUserContent(data?: PbCanvasSerialized): boolean {
  const objects = (data as JsonPayload | undefined)?.objects;
  if (!Array.isArray(objects)) return false;
  return objects.some((o) => {
    if (!o?.type) return false;
    if (o.pbKind && PB_CHROME_KINDS.has(o.pbKind)) return false;
    return true;
  });
}

/** True when an inner page has photos, text, stickers, drawings, etc. — not just empty layout frames. */
export function pageSerializedHasPrintableContent(data?: PbCanvasSerialized): boolean {
  const objects = (data as JsonPayload | undefined)?.objects;
  if (!Array.isArray(objects) || objects.length === 0) return false;

  return objects.some((obj) => {
    if (!obj?.type) return false;
    const kind = obj.pbKind;
    if (kind && PRINT_LAYOUT_CHROME_KINDS.has(kind)) return false;

    if (kind === PB_KIND_LAYOUT_HEADLINE || kind === 'text') {
      const text = String(obj.text ?? '').trim();
      return text.length > 0 && text !== DEFAULT_LAYOUT_HEADLINE;
    }

    if (
      kind === PB_KIND_FRAME_IMAGE ||
      kind === 'image' ||
      kind === 'emoji' ||
      kind === 'draw' ||
      kind === 'line' ||
      kind === 'shape'
    ) {
      return true;
    }

    if (kind) return false;

    const type = String(obj.type).toLowerCase();
    if (type === 'image') return true;
    if (type === 'i-text' || type === 'text' || type === 'textbox' || type === 'itext') {
      const text = String(obj.text ?? '').trim();
      return text.length > 0 && text !== DEFAULT_LAYOUT_HEADLINE;
    }
    if (
      type === 'path' ||
      type === 'line' ||
      type === 'rect' ||
      type === 'circle' ||
      type === 'ellipse' ||
      type === 'triangle' ||
      type === 'polygon' ||
      type === 'group'
    ) {
      return true;
    }

    return false;
  });
}

export function innerPageHasPrintableContent(
  page: { id: string; bg?: string },
  fabricData?: PbCanvasSerialized,
): boolean {
  if (page.id === 'fc' || page.id === 'bc') return true;
  const bg = (page.bg || DEFAULT_PAGE_BG).trim().toLowerCase();
  if (bg !== DEFAULT_PAGE_BG) return true;
  return pageSerializedHasPrintableContent(fabricData);
}

export function shiftAllObjects(canvas: Canvas, dx: number, dy: number) {
  canvas.getObjects().forEach((obj) => {
    if ((obj as FabricObject & { name?: string }).name === PB_CROP_OVERLAY_NAME) return;
    if (isChromeObject(obj)) return;
    obj.set({
      left: (obj.left ?? 0) + dx,
      top: (obj.top ?? 0) + dy,
    });
    obj.setCoords();
  });
}

export function serializePageCanvas(canvas: Canvas, pad: number): PbCanvasSerialized {
  const chrome = canvas.getObjects().filter(isChromeObject);
  const crop = canvas.getObjects().filter((o) => {
    if (isGalleryPreview(o) || isFrameEmptyHint(o)) return true;
    const name = (o as FabricObject & { name?: string }).name;
    return name === PB_CROP_OVERLAY_NAME;
  });

  chrome.forEach((o) => canvas.remove(o));
  crop.forEach((o) => canvas.remove(o));
  if (pad) shiftAllObjects(canvas, -pad, -pad);

  const savedClipPath = canvas.clipPath;
  canvas.clipPath = undefined;

  const json = canvas.toObject([...PB_SERIALIZE_PROPS]) as PbCanvasSerialized;
  normalizeSerializedImageSources(json);

  canvas.clipPath = savedClipPath;

  if (pad) shiftAllObjects(canvas, pad, pad);
  chrome.forEach((o) => canvas.add(o));
  crop.forEach((o) => canvas.add(o));
  sendPageBackgroundToBack(canvas);

  return json;
}

export async function deserializePageCanvas(
  canvas: Canvas,
  data: PbCanvasSerialized | undefined,
  pad: number,
  fabric?: FabricModule,
): Promise<void> {
  if (!data || !Array.isArray((data as JsonPayload).objects) || (data as JsonPayload).objects!.length === 0) {
    canvas.clear();
    canvas.backgroundColor = 'transparent';
    canvas.requestRenderAll();
    return;
  }

  await canvas.loadFromJSON(data);
  if (fabric) {
    await reviveSvgFabricImages(canvas, fabric);
  }
  if (pad) shiftAllObjects(canvas, pad, pad);
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}
