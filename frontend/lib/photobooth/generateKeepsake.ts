import { contentApi } from '@/lib/api';
import {
  applyClassicUFilter,
  applyInstCFilter,
  applyInstSQFilter,
  applyInstSQCFilter,
  CLASSIC_U_CSS_PREVIEW,
  INST_C_CSS_PREVIEW,
  INST_SQ_CSS_PREVIEW,
  INST_SQC_CSS_PREVIEW,
} from '@/lib/photobooth/film';

export const PHOTOBOOTH_FILTERS = [
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

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new window.Image();
    if (src.startsWith('http://') || src.startsWith('https://')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const drawImageInColor = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) => {
  ctx.save();
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const oCtx = offscreen.getContext('2d');
  if (oCtx) {
    oCtx.drawImage(img, 0, 0, width, height);
    oCtx.globalCompositeOperation = 'source-in';
    oCtx.fillStyle = color;
    oCtx.fillRect(0, 0, width, height);
    ctx.drawImage(offscreen, x, y);
  } else {
    ctx.drawImage(img, x, y, width, height);
  }
  ctx.restore();
};

function getImageSourceSize(source: CanvasImageSource): { width: number; height: number } {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height };
  }
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth || source.width, height: source.videoHeight || source.height };
  }
  if (source instanceof HTMLCanvasElement) return { width: source.width, height: source.height };
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return { width: source.width, height: source.height };
  }
  return { width: 0, height: 0 };
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  dx: number,
  dy: number,
  dWidth: number,
  dHeight: number,
): void {
  const { width: srcW, height: srcH } = getImageSourceSize(source);
  if (srcW <= 0 || srcH <= 0) {
    ctx.drawImage(source, dx, dy, dWidth, dHeight);
    return;
  }
  const srcAspect = srcW / srcH;
  const dstAspect = dWidth / dHeight;
  let sx = 0;
  let sy = 0;
  let sWidth = srcW;
  let sHeight = srcH;
  if (srcAspect > dstAspect) {
    sWidth = srcH * dstAspect;
    sx = (srcW - sWidth) / 2;
  } else if (srcAspect < dstAspect) {
    sHeight = srcW / dstAspect;
    sy = (srcH - sHeight) / 2;
  }
  ctx.drawImage(source, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
}

function drawTransformedImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number, // container X
  cy: number, // container Y
  cw: number, // container width
  ch: number, // container height
  transform?: { x?: number; y?: number; scale?: number; naturalWidth?: number; naturalHeight?: number; containerWidth?: number; containerHeight?: number }
) {
  if (!transform || (!transform.x && !transform.y && transform.scale === 1 && !transform.naturalWidth)) {
    drawImageCover(ctx, img, cx, cy, cw, ch);
    return;
  }

  const hasDims = transform.naturalWidth && transform.naturalHeight;
  const isPortrait = hasDims ? transform.naturalHeight! >= transform.naturalWidth! : true;

  if (!hasDims) {
    // Fallback if dimensions missing
    drawImageCover(ctx, img, cx, cy, cw, ch);
    return;
  }

  // Calculate equivalent offset for the high-res export canvas
  // If the user panned 50px in a 300px wide DOM container, they panned 1/6th of the width.
  // We apply that same 1/6th to the canvas container width (cw).
  const scaleRatioX = transform.containerWidth ? cw / transform.containerWidth : 1;
  const scaleRatioY = transform.containerHeight ? ch / transform.containerHeight : 1;
  
  const tx = (transform.x ?? 0) * scaleRatioX;
  const ty = (transform.y ?? 0) * scaleRatioY;
  const scale = transform.scale ?? 1;

  let imgW = 0;
  let imgH = 0;

  if (isPortrait) {
    imgW = cw;
    imgH = transform.naturalHeight! * (cw / transform.naturalWidth!);
  } else {
    imgH = ch;
    imgW = transform.naturalWidth! * (ch / transform.naturalHeight!);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(cx, cy, cw, ch);
  ctx.clip(); // Ensure we don't draw outside the frame bounds

  // Move to the center of the container
  ctx.translate(cx + cw / 2, cy + ch / 2);
  
  // Apply user transformations
  ctx.translate(tx, ty);
  ctx.scale(scale, scale);

  // Draw image centered at (0,0)
  ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH);

  ctx.restore();
}

const drawKeepsakePhotoWithShadow = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  filterCss?: string,
  transform?: any
) => {
  ctx.save();
  ctx.fillStyle = '#f3f1eb';
  ctx.fillRect(x, y, size, size);
  if (img) {
    if (filterCss === INST_C_CSS_PREVIEW) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = size;
      tempCanvas.height = size;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        drawTransformedImageCover(tempCtx, img, 0, 0, size, size, transform);
        applyInstCFilter(tempCanvas);
        ctx.drawImage(tempCanvas, x, y);
      } else drawTransformedImageCover(ctx, img, x, y, size, size, transform);
    } else if (filterCss === INST_SQ_CSS_PREVIEW) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = size;
      tempCanvas.height = size;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        drawTransformedImageCover(tempCtx, img, 0, 0, size, size, transform);
        applyInstSQFilter(tempCanvas);
        ctx.drawImage(tempCanvas, x, y);
      } else drawTransformedImageCover(ctx, img, x, y, size, size, transform);
    } else if (filterCss === INST_SQC_CSS_PREVIEW) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = size;
      tempCanvas.height = size;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        drawTransformedImageCover(tempCtx, img, 0, 0, size, size, transform);
        applyInstSQCFilter(tempCanvas);
        ctx.drawImage(tempCanvas, x, y);
      } else drawTransformedImageCover(ctx, img, x, y, size, size, transform);
    } else if (filterCss === CLASSIC_U_CSS_PREVIEW) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = size;
      tempCanvas.height = size;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        drawTransformedImageCover(tempCtx, img, 0, 0, size, size, transform);
        applyClassicUFilter(tempCanvas);
        ctx.drawImage(tempCanvas, x, y);
      } else drawTransformedImageCover(ctx, img, x, y, size, size, transform);
    } else {
      if (filterCss && filterCss !== 'none') ctx.filter = filterCss;
      drawTransformedImageCover(ctx, img, x, y, size, size, transform);
    }
  }
  ctx.filter = 'none';
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.shadowColor = '#1a1814';
  ctx.shadowBlur = 5;
  ctx.strokeStyle = '#1a1814';
  ctx.lineWidth = 4;
  ctx.strokeRect(x - 2, y - 2, size + 4, size + 4);
  ctx.restore();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(26, 24, 20, 0.12)';
  ctx.strokeRect(x, y, size, size);
  ctx.restore();
};

const drawKeepsakePhotoRectWithShadow = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  filterCss?: string,
  transform?: any
) => {
  ctx.save();
  ctx.fillStyle = '#f3f1eb';
  ctx.fillRect(x, y, w, h);
  if (img) {
    if (filterCss === INST_C_CSS_PREVIEW) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        drawTransformedImageCover(tempCtx, img, 0, 0, w, h, transform);
        applyInstCFilter(tempCanvas);
        ctx.drawImage(tempCanvas, x, y);
      } else drawTransformedImageCover(ctx, img, x, y, w, h, transform);
    } else if (filterCss === INST_SQ_CSS_PREVIEW) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        drawTransformedImageCover(tempCtx, img, 0, 0, w, h, transform);
        applyInstSQFilter(tempCanvas);
        ctx.drawImage(tempCanvas, x, y);
      } else drawTransformedImageCover(ctx, img, x, y, w, h, transform);
    } else if (filterCss === INST_SQC_CSS_PREVIEW) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        drawTransformedImageCover(tempCtx, img, 0, 0, w, h, transform);
        applyInstSQCFilter(tempCanvas);
        ctx.drawImage(tempCanvas, x, y);
      } else drawTransformedImageCover(ctx, img, x, y, w, h, transform);
    } else if (filterCss === CLASSIC_U_CSS_PREVIEW) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        drawTransformedImageCover(tempCtx, img, 0, 0, w, h, transform);
        applyClassicUFilter(tempCanvas);
        ctx.drawImage(tempCanvas, x, y);
      } else drawTransformedImageCover(ctx, img, x, y, w, h, transform);
    } else {
      if (filterCss && filterCss !== 'none') ctx.filter = filterCss;
      drawTransformedImageCover(ctx, img, x, y, w, h, transform);
    }
  }
  ctx.restore();
};

/** Same scale used by Download Now — purchase PDF uses this for identical polaroid rendering. */
export const KEEPSAKE_DOWNLOAD_SCALE = 1.5;

export const KEEPSAKE_POLAROID_EXPORT_PX = {
  width: Math.round(1000 * KEEPSAKE_DOWNLOAD_SCALE),
  height: Math.round(1200 * KEEPSAKE_DOWNLOAD_SCALE),
};

/** Matches on-site photostrip frame (82×215) at download scale. */
const STRIP_FRAME_W = 82;
const STRIP_FRAME_H = 215;
/** Tighter than on-screen CSS so export matches perceived strip proportions. */
const STRIP_PADDING = { top: 3, right: 3, bottom: 18, left: 3 };
const STRIP_SLOT_GAP = 3;

export const KEEPSAKE_STRIP_EXPORT_PX = {
  width: Math.round(600 * KEEPSAKE_DOWNLOAD_SCALE),
  height: Math.round(600 * KEEPSAKE_DOWNLOAD_SCALE * (STRIP_FRAME_H / STRIP_FRAME_W)),
};

export type KeepsakeRenderOptions = {
  /** Defaults to KEEPSAKE_DOWNLOAD_SCALE (1.5) — matches Download Now quality. */
  scale?: number;
};

export async function generateKeepsakeDataUrl(
  photo: { 
    url: string; 
    filterId: string; 
    frameId?: number; 
    stripSlotUrls?: [string, string, string];
    x?: number;
    y?: number;
    scale?: number;
    naturalWidth?: number;
    naturalHeight?: number;
    containerWidth?: number;
    containerHeight?: number;
    stripSlotTransforms?: any[];
  },
  vibeId: string,
  vibeImages: string[],
  selectedFrame: number,
  options?: KeepsakeRenderOptions,
): Promise<string> {
  const SCALE = options?.scale ?? KEEPSAKE_DOWNLOAD_SCALE;
  const frameId = typeof photo.frameId === 'number' ? photo.frameId : selectedFrame;
  const filterObj = PHOTOBOOTH_FILTERS.find((f) => f.id === photo.filterId) || PHOTOBOOTH_FILTERS[0];
  const placeholderFilterCss =
    filterObj.id === 'retro' ? INST_C_CSS_PREVIEW
      : filterObj.id === 'inst-sq' ? INST_SQ_CSS_PREVIEW
        : filterObj.id === 'film' ? INST_SQC_CSS_PREVIEW
          : filterObj.id === 'autumn' ? CLASSIC_U_CSS_PREVIEW
            : filterObj.filterCss;
  const capturedPhotoFilterCss = 'none';

  let textureImg: HTMLImageElement | null = null;
  try {
    textureImg = await loadImage('/paper_texture.png');
  } catch {
    /* optional */
  }

  let framePatternImg: HTMLImageElement | null = null;
  const frameAssets: Record<number, string> = {
    1: '/frame1%20blob.png',
    2: '/Sticker%20Pop.png',
    3: '/Comic%20Blast.png',
    4: '/Candy%20Pink.png',
    5: '/Sweet%20Kiss.png',
    6: '/Starlight.png',
    7: '/Bluebell.png',
    8: '/Pixel%20Paint.png',
  };
  if (frameAssets[frameId]) {
    try {
      framePatternImg = await loadImage(frameAssets[frameId]);
    } catch {
      /* optional */
    }
  }

  let logoUrl: string | null = null;
  let logoText = 'Scribble Studios';
  try {
    const c = await contentApi.getByType('logo');
    const url = c?.metadata?.imageUrl;
    if (typeof url === 'string' && url) logoUrl = url;
    const txt = c?.metadata?.fallbackText || c?.title;
    if (typeof txt === 'string' && txt) logoText = txt;
  } catch {
    /* optional */
  }

  let logoImg: HTMLImageElement | null = null;
  if (logoUrl) {
    try {
      logoImg = await loadImage(logoUrl);
    } catch {
      /* optional */
    }
  }

  if (vibeId === 'polaroid') {
    const W = 1000 * SCALE;
    const H = 1200 * SCALE;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return photo.url;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (frameId >= 1 && frameId <= 8 && framePatternImg) {
      drawImageCover(ctx, framePatternImg, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
    }

    if (textureImg) {
      ctx.save();
      if (frameId >= 1 && frameId <= 8) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.85;
      }
      const pattern = ctx.createPattern(textureImg, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    }

    let img: HTMLImageElement | null = null;
    try {
      img = await loadImage(photo.url);
    } catch {
      /* keep null */
    }

    if (frameId === 8) {
      drawKeepsakePhotoRectWithShadow(
        ctx, img, W * 0.259755, H * 0.137272, W * 0.6693, H * 0.710909, capturedPhotoFilterCss, photo
      );
    } else {
      drawKeepsakePhotoWithShadow(ctx, img, 60 * SCALE, 60 * SCALE, 880 * SCALE, capturedPhotoFilterCss, photo);
    }

    ctx.save();
    ctx.globalAlpha = 0.8;
    if (logoImg) {
      const logoHeight = 35 * SCALE;
      const logoWidth = logoHeight * (logoImg.width / logoImg.height);
      drawImageInColor(ctx, logoImg, 60 * SCALE, 1125 * SCALE, logoWidth, logoHeight, '#1a1814');
    } else {
      ctx.font = `italic 500 ${32 * SCALE}px "Instrument Serif", serif`;
      ctx.fillStyle = '#1a1814';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(logoText, 60 * SCALE, 1142 * SCALE);
    }
    ctx.restore();

    return canvas.toDataURL('image/png');
  }

  const W = KEEPSAKE_STRIP_EXPORT_PX.width * (SCALE / KEEPSAKE_DOWNLOAD_SCALE);
  const H = KEEPSAKE_STRIP_EXPORT_PX.height * (SCALE / KEEPSAKE_DOWNLOAD_SCALE);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return photo.url;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (frameId >= 1 && frameId <= 8 && framePatternImg) {
    drawImageCover(ctx, framePatternImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
  }

  if (textureImg) {
    ctx.save();
    if (frameId >= 1 && frameId <= 8) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.85;
    }
    const pattern = ctx.createPattern(textureImg, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  const scaleX = W / STRIP_FRAME_W;
  const scaleY = H / STRIP_FRAME_H;
  const padL = STRIP_PADDING.left * scaleX;
  const padT = STRIP_PADDING.top * scaleY;
  const padR = STRIP_PADDING.right * scaleX;
  const padB = STRIP_PADDING.bottom * scaleY;
  const gap = STRIP_SLOT_GAP * scaleY;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const slotW = innerW;
  const slotH = (innerH - gap * 2) / 3;
  const slotX = padL;

  const sources = photo.stripSlotUrls ?? [
    photo.url,
    vibeImages[1] || 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1000&q=90',
    vibeImages[2] || 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1000&q=90',
  ];

  for (let i = 0; i < 3; i++) {
    let img: HTMLImageElement | null = null;
    try {
      if (sources[i]) img = await loadImage(sources[i]);
    } catch {
      /* optional */
    }
    const filterCss = photo.stripSlotUrls ? capturedPhotoFilterCss : (i > 0 ? placeholderFilterCss : capturedPhotoFilterCss);
    const slotY = padT + i * (slotH + gap);
    
    // Fall back to the main photo transform for the first slot if stripSlotTransforms isn't provided
    const transform = photo.stripSlotTransforms ? photo.stripSlotTransforms[i] : (i === 0 ? photo : undefined);
    
    drawKeepsakePhotoRectWithShadow(ctx, img, slotX, slotY, slotW, slotH, filterCss, transform);
  }

  ctx.save();
  ctx.globalAlpha = 0.8;
  const logoHeight = 24 * SCALE;
  const logoY = H - padB + (padB - logoHeight) * 0.58;
  if (logoImg) {
    const logoWidth = logoHeight * (logoImg.width / logoImg.height);
    drawImageInColor(ctx, logoImg, padL, logoY, logoWidth, logoHeight, '#1a1814');
  } else {
    ctx.font = `italic 500 ${32 * SCALE}px "Instrument Serif", serif`;
    ctx.fillStyle = '#1a1814';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(logoText, padL, logoY + logoHeight / 2);
  }
  ctx.restore();

  return canvas.toDataURL('image/png');
}
