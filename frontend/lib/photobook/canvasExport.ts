import { getPbFabricCanvas } from '@/components/photobook/canvas/pbFabricCanvasRegistry';
import { PB_VIEW_PAD_PX } from '@/components/photobook/canvas/constants';
import { isChromeObject } from '@/components/photobook/canvas/chrome';
import type { PbCanvasSerialized } from '@/components/photobook/canvas';
import type { PbPageMeta } from '@/lib/photobook/projectTypes';
import {
  renderBlankPrintPageToDataUrl,
  renderPageToDataUrl,
} from '@/lib/photobook/offscreenPrint';

const PREVIEW_MAX_PX = 600;
const PRINT_DPI = 400;
const CM_PER_INCH = 2.54;

export function cmToPrintPx(cm: number): number {
  return Math.round((cm / CM_PER_INCH) * PRINT_DPI);
}

export function computePrintMultiplier(editorPagePx: number, pageSizeCm: number): number {
  const printPx = cmToPrintPx(pageSizeCm);
  return printPx / Math.max(1, editorPagePx);
}

function loadDataUrlIntoImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load export image'));
    img.src = dataUrl;
  });
}

/** JPEG has no alpha — flatten PNG export onto the page color so transparent PNGs don't turn black. */
export async function flattenDataUrlToJpegDataUrl(
  pngDataUrl: string,
  backgroundColor: string,
  quality = 1,
): Promise<string> {
  const img = await loadDataUrlIntoImage(pngDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.fillStyle = backgroundColor || '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}

export type FabricCanvasRegionExportOpts = {
  left: number;
  top: number;
  width: number;
  height: number;
  multiplier: number;
  backgroundColor: string;
  quality?: number;
};

export async function exportFabricCanvasRegionAsJpeg(
  canvas: import('fabric').Canvas,
  opts: FabricCanvasRegionExportOpts,
): Promise<string> {
  const pngDataUrl = canvas.toDataURL({
    format: 'png',
    multiplier: opts.multiplier,
    left: opts.left,
    top: opts.top,
    width: opts.width,
    height: opts.height,
  });
  return flattenDataUrlToJpegDataUrl(pngDataUrl, opts.backgroundColor, opts.quality ?? 1);
}

function hideTransientObjects(canvas: import('fabric').Canvas) {
  const hidden: Array<{ obj: import('fabric').FabricObject; visible: boolean }> = [];
  canvas.getObjects().forEach((obj) => {
    const name = (obj as { name?: string }).name;
    if (isChromeObject(obj) || name === 'pb-gallery-preview' || name === 'pb-crop-overlay') {
      hidden.push({ obj, visible: obj.visible !== false });
      obj.set({ visible: false });
    }
  });
  return hidden;
}

function restoreTransientObjects(hidden: Array<{ obj: import('fabric').FabricObject; visible: boolean }>) {
  hidden.forEach(({ obj, visible }) => obj.set({ visible }));
}

export async function exportPageCanvasToBlob(
  pageId: string,
  opts?: {
    multiplier?: number;
    format?: 'jpeg' | 'png';
    quality?: number;
    backgroundColor?: string;
  },
): Promise<Blob | null> {
  const canvas = getPbFabricCanvas(pageId);
  if (!canvas) return null;

  const hidden = hideTransientObjects(canvas);
  canvas.requestRenderAll();

  try {
    const pad = PB_VIEW_PAD_PX;
    const region = {
      multiplier: opts?.multiplier ?? 1,
      left: pad,
      top: pad,
      width: (canvas.width ?? 0) - pad * 2,
      height: (canvas.height ?? 0) - pad * 2,
    };

    if (opts?.format === 'png') {
      const dataUrl = canvas.toDataURL({ format: 'png', ...region });
      const res = await fetch(dataUrl);
      return await res.blob();
    }

    const pngDataUrl = canvas.toDataURL({ format: 'png', ...region });
    const jpegDataUrl = await flattenDataUrlToJpegDataUrl(
      pngDataUrl,
      opts?.backgroundColor ?? '#ffffff',
      opts?.quality ?? 0.92,
    );
    const res = await fetch(jpegDataUrl);
    return await res.blob();
  } finally {
    restoreTransientObjects(hidden);
    canvas.requestRenderAll();
  }
}

const FLIPBOOK_PREVIEW_MAX_PX = 1200;
const MANDATORY_BLANK_PAGE_LABEL = 'This page must be left blank';

function dataUrlToObjectUrl(dataUrl: string): string {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch?.[1] ?? 'image/jpeg';
  const binary = atob(parts[1] ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

export async function renderMandatoryBlankPageToDataUrl(
  editorPageWidthPx: number,
  editorPageHeightPx: number,
  previewMultiplier?: number,
): Promise<string> {
  const multiplier = previewMultiplier ?? 1;
  const width = Math.max(1, Math.round(editorPageWidthPx * multiplier));
  const height = Math.max(1, Math.round(editorPageHeightPx * multiplier));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const fontSize = Math.max(12, Math.round(Math.min(width, height) * 0.045));
  ctx.fillStyle = '#6b7280';
  ctx.font = `500 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(MANDATORY_BLANK_PAGE_LABEL, width / 2, height / 2);

  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function exportPhotobookPagesForFlipbookPreview(
  pages: PbPageMeta[],
  fabricByPageId: Record<string, PbCanvasSerialized | undefined>,
  editorPageWidthPx: number,
  editorPageHeightPx: number,
  pageSizeCm: { width: number; height: number },
): Promise<string[]> {
  const multiplier = Math.min(2, FLIPBOOK_PREVIEW_MAX_PX / Math.max(1, editorPageWidthPx));

  const exportPageToObjectUrl = async (page: PbPageMeta): Promise<string | null> => {
    const pageBg = page.id === 'bc' ? '#ffffff' : (page.bg || '#ffffff');
    const liveBlob = await exportPageCanvasToBlob(page.id, {
      multiplier,
      format: 'jpeg',
      quality: 0.92,
      backgroundColor: pageBg,
    });

    if (liveBlob) {
      return URL.createObjectURL(liveBlob);
    }

    let dataUrl: string | null = null;

    if (page.id === 'bc') {
      dataUrl = await renderBlankPrintPageToDataUrl(
        editorPageWidthPx,
        editorPageHeightPx,
        pageSizeCm.width,
        pageSizeCm.height,
      );
    } else {
      const fabricData = fabricByPageId[page.id];
      if (fabricData) {
        dataUrl = await renderPageToDataUrl(
          fabricData,
          editorPageWidthPx,
          editorPageHeightPx,
          pageSizeCm.width,
          pageSizeCm.height,
          page.bg || '#ffffff',
          page,
        );
      } else {
        dataUrl = await renderBlankPrintPageToDataUrl(
          editorPageWidthPx,
          editorPageHeightPx,
          pageSizeCm.width,
          pageSizeCm.height,
        );
      }
    }

    if (!dataUrl) return null;
    return dataUrlToObjectUrl(dataUrl);
  };

  const exportMandatoryBlankPage = async (): Promise<string> => {
    const dataUrl = await renderMandatoryBlankPageToDataUrl(
      editorPageWidthPx,
      editorPageHeightPx,
      multiplier,
    );
    return dataUrlToObjectUrl(dataUrl);
  };

  const frontCover = pages.find((page) => page.id === 'fc');
  const backCover = pages.find((page) => page.id === 'bc');
  const innerPages = pages.filter((page) => page.id !== 'fc' && page.id !== 'bc');
  const objectUrls: string[] = [];

  // Photobook reading order: front cover → blank inside front → inner pages → blank inside back → back cover.
  if (frontCover) {
    const frontUrl = await exportPageToObjectUrl(frontCover);
    if (frontUrl) objectUrls.push(frontUrl);
    objectUrls.push(await exportMandatoryBlankPage());
  }

  for (const page of innerPages) {
    const url = await exportPageToObjectUrl(page);
    if (url) objectUrls.push(url);
  }

  if (backCover) {
    objectUrls.push(await exportMandatoryBlankPage());
    const backUrl = await exportPageToObjectUrl(backCover);
    if (backUrl) objectUrls.push(backUrl);
  }

  if (objectUrls.length > 0) {
    return objectUrls;
  }

  for (const page of pages) {
    const url = await exportPageToObjectUrl(page);
    if (url) objectUrls.push(url);
  }

  return objectUrls;
}

export async function generateProjectPreviewBlob(pageIds: string[]): Promise<Blob | null> {
  const preferred = pageIds.find((id) => id === 'fc') || pageIds[0];
  if (!preferred) return null;

  const canvas = getPbFabricCanvas(preferred);
  if (!canvas) return null;

  const pageW = (canvas.width ?? 380) - PB_VIEW_PAD_PX * 2;
  const multiplier = Math.min(2, PREVIEW_MAX_PX / Math.max(1, pageW));

  return exportPageCanvasToBlob(preferred, { multiplier, format: 'jpeg', quality: 0.85 });
}

export type PrintPageSpec = {
  pageId: string;
  widthCm: number;
  heightCm: number;
  editorWidthPx: number;
  editorHeightPx: number;
};

export async function exportPageForPrint(spec: PrintPageSpec): Promise<Blob | null> {
  const multW = computePrintMultiplier(spec.editorWidthPx, spec.widthCm);
  const multH = computePrintMultiplier(spec.editorHeightPx, spec.heightCm);
  const multiplier = Math.max(multW, multH);
  return exportPageCanvasToBlob(spec.pageId, { multiplier, format: 'jpeg', quality: 1 });
}

export function collectRemoteImageUrlsFromFabric(data?: PbCanvasSerialized): string[] {
  const urls = new Set<string>();
  const objects = (data as { objects?: Array<{ type?: string; src?: string; sourceUrl?: string }> })?.objects;
  if (!Array.isArray(objects)) return [];

  for (const obj of objects) {
    if (obj.type !== 'Image' && obj.type !== 'image') continue;
    for (const url of [obj.sourceUrl, obj.src]) {
      if (!url || typeof url !== 'string') continue;
      if (url.startsWith('blob:') || url.startsWith('data:')) continue;
      if (url.includes('res.cloudinary.com')) continue;
      urls.add(url);
    }
  }
  return [...urls];
}

export function isLocalImageUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.startsWith('blob:') || url.startsWith('data:');
}

export function isCloudinaryStickerUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.includes('res.cloudinary.com');
}
