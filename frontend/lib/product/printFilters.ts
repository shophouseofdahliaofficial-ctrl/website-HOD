export type PrintCaptureFilter = {
  id: string;
  name: string;
  filterCss: string;
};

export const PRINT_CAPTURE_FILTERS: PrintCaptureFilter[] = [
  { id: 'original', name: 'Original', filterCss: 'none' },
  { id: 'bw', name: 'B&W', filterCss: 'grayscale(100%)' },
  { id: 'warm', name: 'Warm', filterCss: 'sepia(35%) saturate(120%) brightness(102%)' },
  { id: 'cool', name: 'Cool', filterCss: 'hue-rotate(180deg) saturate(90%)' },
  { id: 'vintage', name: 'Vintage', filterCss: 'sepia(50%) contrast(90%) brightness(95%)' },
  { id: 'dramatic', name: 'Dramatic', filterCss: 'contrast(140%) saturate(120%)' },
  { id: 'fade', name: 'Fade', filterCss: 'brightness(105%) contrast(85%)' },
];

export const FILTER_PREVIEW_SAMPLE_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%23f3ece7"/><circle cx="40" cy="35" r="16" fill="%23d8c1b5"/><path d="M20 70 C24 52 56 52 60 70 Z" fill="%23b89e92"/></svg>';

export function getCaptureFilterCss(filterId: string): string {
  const f = PRINT_CAPTURE_FILTERS.find((item) => item.id === filterId);
  return f ? f.filterCss : 'none';
}

const FRAME_LABELS = [
  'Classic White',
  'Matte Black',
  'Warm Cream',
  'Blush Rose',
  'Pastel Sky',
  'Sage Leaf',
  'Soft Lilac',
  'Warm Sand',
  'Midnight Navy',
];

export function getFramePreviewLabel(frameIndex: number): string {
  return FRAME_LABELS[frameIndex] || `Style ${frameIndex + 1}`;
}

export function getFramePreviewClassName(frameIndex: number, cssModule?: Record<string, string>): string {
  if (cssModule) {
    return cssModule[`frameColor_${frameIndex}`] || cssModule.frameColor_0 || '';
  }
  return `frameColor_${frameIndex}`;
}

export function getPolaroidFrameClassName(frameIndex: number, cssModule?: Record<string, string>): string {
  if (cssModule) {
    return cssModule[`polaroidBorder_${frameIndex}`] || cssModule.polaroidBorder_0 || '';
  }
  return `polaroidBorder_${frameIndex}`;
}

export async function applyCaptureFilterToDataUrl(dataUrl: string, filterId: string): Promise<string> {
  if (!filterId || filterId === 'original') return dataUrl;
  const filterCss = getCaptureFilterCss(filterId);
  if (filterCss === 'none') return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.filter = filterCss;
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
