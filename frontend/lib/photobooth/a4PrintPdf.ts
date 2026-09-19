import {
  KEEPSAKE_POLAROID_EXPORT_PX,
  KEEPSAKE_STRIP_EXPORT_PX,
} from '@/lib/photobooth/generateKeepsake';

const GRID_COLS = 3;
const GRID_ROWS = 3;
const POLAROIDS_PER_PAGE = GRID_COLS * GRID_ROWS;
const STRIPS_PER_PAGE = 4;
const STRIP_GRID_COLS = STRIPS_PER_PAGE;
const BASE_PRINT_DPI = 300;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_LANDSCAPE_WIDTH_MM = 297;
const A4_LANDSCAPE_HEIGHT_MM = 210;
const MARGIN_MM = 4;
const COL_GAP_MM = 4;
const MIN_ROW_GAP_MM = 4;

type GridLayoutMm = {
  marginMm: number;
  colGapMm: number;
  rowGapMm: number;
  polaroidWMm: number;
  polaroidHMm: number;
  offsetXMm: number;
  offsetYMm: number;
};

function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}

/**
 * Maximize polaroid size on A4: tight side margins, fixed column gaps,
 * row gaps expand to use leftover vertical space (polaroid aspect is shorter than square cells).
 */
export function computeGridLayout(aspect: number): GridLayoutMm {
  const margin = MARGIN_MM;
  const colGap = COL_GAP_MM;
  const availableW = A4_WIDTH_MM - margin * 2;
  const availableH = A4_HEIGHT_MM - margin * 2;

  let polaroidW = (availableW - (GRID_COLS - 1) * colGap) / GRID_COLS;
  let polaroidH = polaroidW / aspect;

  let gridH = GRID_ROWS * polaroidH + (GRID_ROWS - 1) * MIN_ROW_GAP_MM;

  if (gridH > availableH) {
    polaroidH = (availableH - (GRID_ROWS - 1) * MIN_ROW_GAP_MM) / GRID_ROWS;
    polaroidW = polaroidH * aspect;

    let gridW = GRID_COLS * polaroidW + (GRID_COLS - 1) * colGap;
    if (gridW > availableW) {
      polaroidW = (availableW - (GRID_COLS - 1) * colGap) / GRID_COLS;
      polaroidH = polaroidW / aspect;
      gridW = GRID_COLS * polaroidW + (GRID_COLS - 1) * colGap;
    }

    gridH = GRID_ROWS * polaroidH + (GRID_ROWS - 1) * MIN_ROW_GAP_MM;

    return {
      marginMm: margin,
      colGapMm: colGap,
      rowGapMm: MIN_ROW_GAP_MM,
      polaroidWMm: polaroidW,
      polaroidHMm: polaroidH,
      offsetXMm: margin + (availableW - gridW) / 2,
      offsetYMm: margin + (availableH - gridH) / 2,
    };
  }

  const rowGap = (availableH - GRID_ROWS * polaroidH) / (GRID_ROWS - 1);
  const gridW = GRID_COLS * polaroidW + (GRID_COLS - 1) * colGap;

  return {
    marginMm: margin,
    colGapMm: colGap,
    rowGapMm: rowGap,
    polaroidWMm: polaroidW,
    polaroidHMm: polaroidH,
    offsetXMm: margin + (availableW - gridW) / 2,
    offsetYMm: margin,
  };
}

/**
 * Raise composition DPI so PDF polaroids stay sharp at the larger on-page size.
 */
export function computePrintCompositionDpi(exportWidthPx: number, aspect: number): number {
  const layout = computeGridLayout(aspect);
  const polaroidWidthPxAt300 = mmToPx(layout.polaroidWMm, BASE_PRINT_DPI);
  const needed = Math.ceil((exportWidthPx / polaroidWidthPxAt300) * BASE_PRINT_DPI);
  return Math.min(720, Math.max(BASE_PRINT_DPI, needed));
}

/** Up to three photostrips across one A4 landscape page (one per column). */
export function computeStripLandscapeLayout(aspect: number): GridLayoutMm {
  const margin = MARGIN_MM;
  const colGap = COL_GAP_MM;
  const availableW = A4_LANDSCAPE_WIDTH_MM - margin * 2;
  const availableH = A4_LANDSCAPE_HEIGHT_MM - margin * 2;

  let stripW = (availableW - (STRIP_GRID_COLS - 1) * colGap) / STRIP_GRID_COLS;
  let stripH = stripW / aspect;

  const MAX_STRIP_HEIGHT_MM = 150;
  if (stripH > MAX_STRIP_HEIGHT_MM) {
    stripH = MAX_STRIP_HEIGHT_MM;
    stripW = stripH * aspect;
  } else if (stripH > availableH) {
    stripH = availableH;
    stripW = stripH * aspect;
  }

  const gridW = STRIP_GRID_COLS * stripW + (STRIP_GRID_COLS - 1) * colGap;

  return {
    marginMm: margin,
    colGapMm: colGap,
    rowGapMm: 0,
    polaroidWMm: stripW,
    polaroidHMm: stripH,
    offsetXMm: margin + (availableW - gridW) / 2,
    offsetYMm: margin + (availableH - stripH) / 2,
  };
}

function computeStripPrintCompositionDpi(exportWidthPx: number, aspect: number): number {
  const layout = computeStripLandscapeLayout(aspect);
  const stripWidthPxAt300 = mmToPx(layout.polaroidWMm, BASE_PRINT_DPI);
  const needed = Math.ceil((exportWidthPx / stripWidthPxAt300) * BASE_PRINT_DPI);
  return Math.min(720, Math.max(BASE_PRINT_DPI, needed));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderA4PageCanvas(
  polaroidDataUrls: string[],
  startIndex: number,
  compositionDpi: number,
  layout: GridLayoutMm,
): Promise<HTMLCanvasElement> {
  const pageW = mmToPx(A4_WIDTH_MM, compositionDpi);
  const pageH = mmToPx(A4_HEIGHT_MM, compositionDpi);

  const canvas = document.createElement('canvas');
  canvas.width = pageW;
  canvas.height = pageH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pageW, pageH);

  const polaroidW = mmToPx(layout.polaroidWMm, compositionDpi);
  const polaroidH = mmToPx(layout.polaroidHMm, compositionDpi);
  const colGap = mmToPx(layout.colGapMm, compositionDpi);
  const rowGap = mmToPx(layout.rowGapMm, compositionDpi);
  const offsetX = mmToPx(layout.offsetXMm, compositionDpi);
  const offsetY = mmToPx(layout.offsetYMm, compositionDpi);

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const idx = startIndex + row * GRID_COLS + col;
      if (idx >= polaroidDataUrls.length) continue;

      const img = await loadImage(polaroidDataUrls[idx]);
      const aspect = img.width / img.height;

      let drawW = polaroidW;
      let drawH = drawW / aspect;
      if (drawH > polaroidH) {
        drawH = polaroidH;
        drawW = polaroidH * aspect;
      }

      const slotX = offsetX + col * (polaroidW + colGap);
      const slotY = offsetY + row * (polaroidH + rowGap);
      const drawX = Math.round(slotX + (polaroidW - drawW) / 2);
      const drawY = Math.round(slotY + (polaroidH - drawH) / 2);
      const drawWi = Math.round(drawW);
      const drawHi = Math.round(drawH);

      const scaleX = drawWi / img.width;
      const scaleY = drawHi / img.height;
      const needsSmoothing = scaleX < 0.99 || scaleY < 0.99;

      ctx.imageSmoothingEnabled = needsSmoothing;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, drawX, drawY, drawWi, drawHi);
    }
  }

  return canvas;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dWidth: number,
  dHeight: number,
): void {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (srcW <= 0 || srcH <= 0) {
    ctx.drawImage(img, dx, dy, dWidth, dHeight);
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

  const scaleX = dWidth / sWidth;
  const scaleY = dHeight / sHeight;
  const needsSmoothing = scaleX < 0.99 || scaleY < 0.99;

  ctx.imageSmoothingEnabled = needsSmoothing;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
}

function drawKeepsakeInSlot(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  slotX: number,
  slotY: number,
  slotW: number,
  slotH: number,
): void {
  const aspect = img.width / img.height;

  let drawW = slotW;
  let drawH = drawW / aspect;
  if (drawH > slotH) {
    drawH = slotH;
    drawW = slotH * aspect;
  }

  const drawX = Math.round(slotX + (slotW - drawW) / 2);
  const drawY = Math.round(slotY + (slotH - drawH) / 2);
  const drawWi = Math.round(drawW);
  const drawHi = Math.round(drawH);

  const scaleX = drawWi / img.width;
  const scaleY = drawHi / img.height;
  const needsSmoothing = scaleX < 0.99 || scaleY < 0.99;

  ctx.imageSmoothingEnabled = needsSmoothing;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, drawX, drawY, drawWi, drawHi);
}

/** Fill the PDF column exactly — pre-composited strips share the layout aspect ratio. */
function drawStripInSlot(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  slotX: number,
  slotY: number,
  slotW: number,
  slotH: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(slotX, slotY, slotW, slotH);
  ctx.clip();
  drawImageCover(ctx, img, slotX, slotY, slotW, slotH);
  ctx.restore();
}

/** One landscape A4 page with up to three unique photostrips (one per column). */
async function renderA4StripPageCanvas(
  stripDataUrls: string[],
  startIndex: number,
  compositionDpi: number,
  layout: GridLayoutMm,
): Promise<HTMLCanvasElement> {
  const pageW = mmToPx(A4_LANDSCAPE_WIDTH_MM, compositionDpi);
  const pageH = mmToPx(A4_LANDSCAPE_HEIGHT_MM, compositionDpi);

  const canvas = document.createElement('canvas');
  canvas.width = pageW;
  canvas.height = pageH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pageW, pageH);

  const stripW = mmToPx(layout.polaroidWMm, compositionDpi);
  const stripH = mmToPx(layout.polaroidHMm, compositionDpi);
  const colGap = mmToPx(layout.colGapMm, compositionDpi);
  const offsetY = mmToPx(layout.offsetYMm, compositionDpi);

  const offsetX = mmToPx(layout.offsetXMm, compositionDpi);
  const countOnPage = Math.min(STRIPS_PER_PAGE, stripDataUrls.length - startIndex);

  for (let col = 0; col < countOnPage; col += 1) {
    const idx = startIndex + col;
    const img = await loadImage(stripDataUrls[idx]);
    const slotX = offsetX + col * (stripW + colGap);
    drawStripInSlot(ctx, img, slotX, offsetY, stripW, stripH);
  }

  return canvas;
}

async function generateA4StripPrintPdf(stripPngDataUrls: string[]): Promise<Blob> {
  const aspect = KEEPSAKE_STRIP_EXPORT_PX.width / KEEPSAKE_STRIP_EXPORT_PX.height;
  const layout = computeStripLandscapeLayout(aspect);
  const compositionDpi = computeStripPrintCompositionDpi(KEEPSAKE_STRIP_EXPORT_PX.width, aspect);

  const { jsPDF } = await import('jspdf');
  const pageCount = Math.ceil(stripPngDataUrls.length / STRIPS_PER_PAGE);
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: false,
    precision: 16,
  });

  for (let page = 0; page < pageCount; page += 1) {
    if (page > 0) {
      pdf.addPage('a4', 'landscape');
    }
    const canvas = await renderA4StripPageCanvas(
      stripPngDataUrls,
      page * STRIPS_PER_PAGE,
      compositionDpi,
      layout,
    );
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(
      imgData,
      'PNG',
      0,
      0,
      A4_LANDSCAPE_WIDTH_MM,
      A4_LANDSCAPE_HEIGHT_MM,
      undefined,
      'SLOW',
    );
  }

  return pdf.output('blob');
}

/**
 * Build a print-ready A4 PDF.
 * Polaroids: portrait, up to 9 per page.
 * Photostrips: landscape, up to 3 unique strips per page (one per column).
 */
export async function generateA4PrintPdf(
  polaroidPngDataUrls: string[],
  vibeId: 'polaroid' | 'strip' = 'polaroid',
): Promise<Blob> {
  if (polaroidPngDataUrls.length === 0) {
    throw new Error('No polaroids to print');
  }

  if (vibeId === 'strip') {
    return generateA4StripPrintPdf(polaroidPngDataUrls);
  }

  const exportPx = KEEPSAKE_POLAROID_EXPORT_PX;
  const aspect = exportPx.width / exportPx.height;
  const layout = computeGridLayout(aspect);
  const compositionDpi = computePrintCompositionDpi(exportPx.width, aspect);

  const { jsPDF } = await import('jspdf');
  const pageCount = Math.ceil(polaroidPngDataUrls.length / POLAROIDS_PER_PAGE);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: false,
    precision: 16,
  });

  for (let page = 0; page < pageCount; page++) {
    if (page > 0) pdf.addPage();
    const canvas = await renderA4PageCanvas(
      polaroidPngDataUrls,
      page * POLAROIDS_PER_PAGE,
      compositionDpi,
      layout,
    );
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, 'SLOW');
  }

  return pdf.output('blob');
}

export function getA4PageCount(itemCount: number, vibeId: 'polaroid' | 'strip' = 'polaroid'): number {
  if (itemCount <= 0) return 0;
  if (vibeId === 'strip') return Math.ceil(itemCount / STRIPS_PER_PAGE);
  return Math.ceil(itemCount / POLAROIDS_PER_PAGE);
}
