import type { FabricModule, FabricObject } from './types';

const DEFAULT_SVG_SIZE = 72;
const MIN_RASTER_PX = 216;
const MAX_RASTER_PX = 1024;

export type FabricImageLoadOptions = {
  /** Target display size in scene px; used to pick a sharp raster resolution. */
  displayScenePx?: number;
};

function isSvgUrl(url: string): boolean {
  return /\.svg($|[?#])/i.test(url);
}

function isCloudinaryUrl(url: string): boolean {
  return url.includes('res.cloudinary.com') && url.includes('/image/upload/');
}

/** Pick a raster size large enough to stay sharp when scaled down on canvas. */
export function computeFabricImageRasterPx(displayScenePx = DEFAULT_SVG_SIZE): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 2;
  return Math.min(MAX_RASTER_PX, Math.max(MIN_RASTER_PX, Math.round(displayScenePx * dpr * 2.5)));
}

/** Cloudinary raster delivery for Fabric canvas (SVG <img> works in DOM; canvas drawImage needs pixels). */
export function toCloudinaryPngUrl(url: string, rasterPx = MIN_RASTER_PX): string {
  if (!isCloudinaryUrl(url) || url.includes('/image/upload/f_')) return url;
  const px = Math.max(DEFAULT_SVG_SIZE, Math.min(MAX_RASTER_PX, Math.round(rasterPx)));
  return url.replace('/image/upload/', `/image/upload/f_png,w_${px},h_${px},c_fit,q_100/`);
}

function loadHtmlImage(src: string, crossOrigin?: 'anonymous'): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    if (crossOrigin) el.crossOrigin = crossOrigin;
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    el.src = src;
  });
}

async function rasterizeSvgTextToImageElement(
  svgText: string,
  rasterPx: number,
): Promise<HTMLImageElement> {
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  try {
    const probe = await loadHtmlImage(blobUrl);
    const sourceW = probe.naturalWidth || DEFAULT_SVG_SIZE;
    const sourceH = probe.naturalHeight || DEFAULT_SVG_SIZE;
    const scale = rasterPx / Math.max(sourceW, sourceH);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceW * scale));
    canvas.height = Math.max(1, Math.round(sourceH * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    ctx.drawImage(probe, 0, 0, canvas.width, canvas.height);
    return loadHtmlImage(canvas.toDataURL('image/png'));
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function ensureFabricImageDimensions(img: FabricObject & { getOriginalSize?: () => { width: number; height: number } }) {
  const size = img.getOriginalSize?.() ?? { width: 0, height: 0 };
  const width = size.width || DEFAULT_SVG_SIZE;
  const height = size.height || DEFAULT_SVG_SIZE;
  if (!size.width || !size.height) {
    img.set({ width, height });
  }
}

/** Load a raster or SVG URL into a Fabric image that paints reliably on canvas. */
export async function loadFabricImageFromUrl(
  fabric: FabricModule,
  url: string,
  options?: FabricImageLoadOptions,
): Promise<FabricObject> {
  const remoteUrl = url.trim();
  const rasterPx = computeFabricImageRasterPx(options?.displayScenePx);

  if (isSvgUrl(remoteUrl) && isCloudinaryUrl(remoteUrl)) {
    const deliveryUrl = toCloudinaryPngUrl(remoteUrl, rasterPx);
    const img = await fabric.FabricImage.fromURL(deliveryUrl, { crossOrigin: 'anonymous' });
    ensureFabricImageDimensions(img);
    img.set({
      objectCaching: false,
      imageSmoothing: false,
      sourceUrl: remoteUrl,
    });
    img.setCoords();
    return img;
  }

  if (isSvgUrl(remoteUrl)) {
    const response = await fetch(remoteUrl, { mode: 'cors', cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load SVG (${response.status})`);
    }
    const element = await rasterizeSvgTextToImageElement(await response.text(), rasterPx);
    const img = new fabric.FabricImage(element, {
      objectCaching: false,
      imageSmoothing: false,
      sourceUrl: remoteUrl,
    });
    ensureFabricImageDimensions(img);
    img.setCoords();
    return img;
  }

  const img = await fabric.FabricImage.fromURL(remoteUrl, { crossOrigin: 'anonymous' });
  ensureFabricImageDimensions(img);
  img.set({ objectCaching: false, sourceUrl: remoteUrl });
  img.setCoords();
  return img;
}

export async function reviveSvgFabricImages(
  canvas: import('./types').Canvas,
  fabric: FabricModule,
): Promise<void> {
  const imageObjects = canvas.getObjects().filter((obj) => obj.type === 'image');
  if (!imageObjects.length) return;

  for (const obj of imageObjects) {
    const tagged = obj as FabricObject & { sourceUrl?: string; getSrc?: () => string };
    const remoteUrl = tagged.sourceUrl || tagged.getSrc?.() || '';
    if (!isSvgUrl(remoteUrl)) continue;

    const displayScenePx = Math.max(
      DEFAULT_SVG_SIZE,
      Math.max(obj.width ?? DEFAULT_SVG_SIZE, obj.height ?? DEFAULT_SVG_SIZE) *
        Math.max(obj.scaleX ?? 1, obj.scaleY ?? 1),
    );
    const replacement = await loadFabricImageFromUrl(fabric, remoteUrl, { displayScenePx });
    replacement.set({
      left: obj.left,
      top: obj.top,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      angle: obj.angle,
      originX: obj.originX,
      originY: obj.originY,
      flipX: obj.flipX,
      flipY: obj.flipY,
      opacity: obj.opacity,
      skewX: obj.skewX,
      skewY: obj.skewY,
      pbKind: (obj as FabricObject & { pbKind?: string }).pbKind,
      selectable: obj.selectable,
      evented: obj.evented,
      cropX: (obj as FabricObject & { cropX?: number }).cropX,
      cropY: (obj as FabricObject & { cropY?: number }).cropY,
      width: obj.width,
      height: obj.height,
      sourceUrl: remoteUrl,
      imageSmoothing: false,
    });
    replacement.setCoords();
    const index = canvas.getObjects().indexOf(obj);
    canvas.remove(obj);
    canvas.insertAt(index, replacement);
  }
}

export function normalizeSerializedImageSources(data: import('./types').PbCanvasSerialized): void {
  const objects = (data as { objects?: Array<{ type?: string; src?: string; sourceUrl?: string }> }).objects;
  if (!Array.isArray(objects)) return;
  for (const object of objects) {
    if (object.type !== 'Image' && object.type !== 'image') continue;
    if (object.sourceUrl && isSvgUrl(object.sourceUrl)) {
      object.src = object.sourceUrl;
    }
  }
}
