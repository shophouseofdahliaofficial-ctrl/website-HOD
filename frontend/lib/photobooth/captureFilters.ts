import {
  applyCanvasBakedFilter,
  captureCanvasBakedStill,
  CLASSIC_U_CSS_PREVIEW,
  INST_C_CSS_PREVIEW,
  INST_SQ_CSS_PREVIEW,
  INST_SQC_CSS_PREVIEW,
  isCanvasBakedFilter,
} from '@/lib/photobooth/film';

export type CaptureFilter = {
  id: string;
  name: string;
  filterCss: string;
};

export const PHOTOBOOTH_CAPTURE_FILTERS: CaptureFilter[] = [
  { id: 'original', name: 'Original', filterCss: 'none' },
  { id: 'retro', name: 'Inst C', filterCss: INST_C_CSS_PREVIEW },
  { id: 'inst-sq', name: 'Inst SQ', filterCss: INST_SQ_CSS_PREVIEW },
  { id: 'film', name: 'Inst SQC', filterCss: INST_SQC_CSS_PREVIEW },
  { id: 'flash', name: 'CT2F', filterCss: 'brightness(1.25) contrast(1.1) saturate(1.15)' },
  { id: 'sunkissed', name: 'GR F', filterCss: 'sepia(0.4) saturate(1.35) hue-rotate(-10deg) brightness(1.05)' },
  { id: 'autumn', name: 'Classic U', filterCss: CLASSIC_U_CSS_PREVIEW },
  { id: 'noir', name: 'D3D', filterCss: 'saturate(1.55) contrast(1.2) brightness(0.95)' },
  { id: 'lomo', name: 'Leica M11 M', filterCss: 'grayscale(1) contrast(1.4) brightness(0.9)' },
];

/** User-facing photobooth filter labels (matches Photobooth capture UI). */
export const PHOTOBOOTH_UI_FILTERS: Array<{ id: Exclude<CaptureFilter['id'], 'original'>; label: string }> = [
  { id: 'retro', label: 'Retro' },
  { id: 'inst-sq', label: 'Vivid' },
  { id: 'film', label: 'Film' },
  { id: 'flash', label: 'Bright' },
  { id: 'sunkissed', label: 'Warm' },
  { id: 'autumn', label: 'Autumn' },
  { id: 'noir', label: 'Pop' },
  { id: 'lomo', label: 'Noir' },
];

export const PHOTOBOOTH_FILTER_IDS = new Set(PHOTOBOOTH_CAPTURE_FILTERS.map((f) => f.id));

export function isPhotoboothFilterId(filterId: string): boolean {
  return PHOTOBOOTH_FILTER_IDS.has(filterId);
}

export function getCaptureFilterById(filterId: string): CaptureFilter {
  return PHOTOBOOTH_CAPTURE_FILTERS.find((f) => f.id === filterId) ?? PHOTOBOOTH_CAPTURE_FILTERS[0];
}

export function getCaptureFilterCss(filterId: string): string {
  const filter = getCaptureFilterById(filterId);
  return isCanvasBakedFilter(filterId) ? 'none' : filter.filterCss;
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export async function applyCaptureFilterToDataUrl(
  dataUrl: string,
  filterId: string,
): Promise<string> {
  const img = await loadImageElement(dataUrl);
  const width = img.naturalWidth || 640;
  const height = img.naturalHeight || 640;

  if (isCanvasBakedFilter(filterId)) {
    const baked = captureCanvasBakedStill(img, width, height, filterId, false);
    if (baked) return baked;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  const filter = getCaptureFilterById(filterId);
  ctx.filter = filter.filterCss;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export function getPolaroidFrameClassName(
  frameId: number,
  styles: Record<string, string>,
): string {
  switch (frameId) {
    case 1:
      return styles.polaroidFrameBlobPattern ?? '';
    case 2:
      return styles.polaroidFrameStickerPopPattern ?? '';
    case 3:
      return styles.polaroidFrameComicBlastPattern ?? '';
    case 4:
      return styles.polaroidFrameCandyPinkPattern ?? '';
    case 5:
      return styles.polaroidFrameSweetKissPattern ?? '';
    case 6:
      return styles.polaroidFrameStarlightPattern ?? '';
    case 7:
      return styles.polaroidFrameBluebellPattern ?? '';
    case 8:
      return styles.polaroidFramePixelPaintPattern ?? '';
    default:
      return '';
  }
}

export const FILTER_PREVIEW_SAMPLE_IMAGE =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80';

export function getFramePreviewClassName(
  frameId: number,
  styles: Record<string, string>,
): string {
  switch (frameId) {
    case 1:
      return styles.framePreviewBlob ?? styles.framePreviewWhite ?? '';
    case 2:
      return styles.framePreviewStickerPop ?? styles.framePreviewWhite ?? '';
    case 3:
      return styles.framePreviewComicBlast ?? styles.framePreviewWhite ?? '';
    case 4:
      return styles.framePreviewCandyPink ?? styles.framePreviewWhite ?? '';
    case 5:
      return styles.framePreviewSweetKiss ?? styles.framePreviewWhite ?? '';
    case 6:
      return styles.framePreviewStarlight ?? styles.framePreviewWhite ?? '';
    case 7:
      return styles.framePreviewBluebell ?? styles.framePreviewWhite ?? '';
    case 8:
      return styles.framePreviewPixelPaint ?? styles.framePreviewWhite ?? '';
    default:
      return styles.framePreviewWhite ?? '';
  }
}

export function getFramePreviewLabel(frameId: number): string {
  switch (frameId) {
    case 0:
      return 'Classic White';
    case 1:
      return 'Splatter Blob';
    case 2:
      return 'Sticker Pop';
    case 3:
      return 'Comic Blast';
    case 4:
      return 'Candy Pink';
    case 5:
      return 'Sweet Kiss';
    case 6:
      return 'Starlight';
    case 7:
      return 'Bluebell';
    case 8:
      return 'Pixel Paint';
    default:
      return 'Classic White';
  }
}
