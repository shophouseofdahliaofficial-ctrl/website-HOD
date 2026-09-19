import type { PbCanvasSerialized } from '@/components/photobook/canvas';
import { PB_VIEW_PAD_PX } from '@/components/photobook/canvas/constants';
import { syncPageChrome } from '@/components/photobook/canvas/chrome';
import { deserializePageCanvas, innerPageHasPrintableContent } from '@/components/photobook/canvas/document';
import { loadFabric } from '@/components/photobook/canvas/fabricLoader';
import { syncAllPlacedImageStylesForExport, preparePhotobookCanvasForPrintExport } from '@/components/photobook/canvas/frameImageStyle';
import { applyPageLayoutToCanvas } from '@/components/photobook/canvas/frames';
import {
  getPbLayoutDefinition,
  normalizeLayoutId,
  resolveLayoutInnerGap,
} from '@/components/photobook/canvas/layouts';
import { cmToPrintPx, exportFabricCanvasRegionAsJpeg } from '@/lib/photobook/canvasExport';
import type { PbPageMeta, PhotobookProjectJson } from '@/lib/photobook/projectTypes';

const DEFAULT_PAGE_BG = '#ffffff';
const BACK_COVER_PAGE_ID = 'bc';

function getPrintPageBackground(page: { id: string; bg?: string }): string {
  if (page.id === BACK_COVER_PAGE_ID) return DEFAULT_PAGE_BG;
  return page.bg || DEFAULT_PAGE_BG;
}

export async function renderBlankPrintPageToDataUrl(
  editorWidthPx: number,
  editorHeightPx: number,
  widthCm: number,
  heightCm: number,
): Promise<string> {
  const fabric = await loadFabric();
  const pad = PB_VIEW_PAD_PX;
  const canvasEl = document.createElement('canvas');
  const canvas = new fabric.Canvas(canvasEl, {
    width: editorWidthPx + pad * 2,
    height: editorHeightPx + pad * 2,
    selection: false,
    renderOnAddRemove: false,
    backgroundColor: DEFAULT_PAGE_BG,
  });

  try {
    syncPageChrome(canvas, fabric, DEFAULT_PAGE_BG, pad, {
      widthPx: editorWidthPx,
      heightPx: editorHeightPx,
    });
    canvas.requestRenderAll();

    const multW = cmToPrintPx(widthCm) / Math.max(1, editorWidthPx);
    const multH = cmToPrintPx(heightCm) / Math.max(1, editorHeightPx);
    const multiplier = Math.max(multW, multH);

    return canvas.toDataURL({
      format: 'jpeg',
      quality: 1,
      multiplier,
      left: pad,
      top: pad,
      width: editorWidthPx,
      height: editorHeightPx,
    });
  } finally {
    canvas.dispose();
  }
}

export async function renderPageToDataUrl(
  fabricData: PbCanvasSerialized,
  editorWidthPx: number,
  editorHeightPx: number,
  widthCm: number,
  heightCm: number,
  pageBackgroundColor: string,
  pageMeta?: PbPageMeta,
): Promise<string> {
  const fabric = await loadFabric();
  const pad = PB_VIEW_PAD_PX;
  const canvasEl = document.createElement('canvas');
  const canvas = new fabric.Canvas(canvasEl, {
    width: editorWidthPx + pad * 2,
    height: editorHeightPx + pad * 2,
    selection: false,
    renderOnAddRemove: false,
    backgroundColor: pageBackgroundColor,
  });

  try {
    await deserializePageCanvas(canvas, fabricData, pad, fabric);

    if (pageMeta?.layout) {
      const layoutId = normalizeLayoutId(pageMeta.layout);
      if (layoutId !== 'blank') {
        const innerGap = resolveLayoutInnerGap(pageMeta.layoutFrameGapEnabled !== false);
        const layout = getPbLayoutDefinition(
          layoutId,
          editorWidthPx,
          editorHeightPx,
          innerGap,
        );
        applyPageLayoutToCanvas(canvas, fabric, layout, pad, {
          widthPx: editorWidthPx,
          heightPx: editorHeightPx,
        });
      }
    }

    await syncAllPlacedImageStylesForExport(fabric, canvas, pad);
    syncPageChrome(canvas, fabric, pageBackgroundColor, pad, {
      widthPx: editorWidthPx,
      heightPx: editorHeightPx,
    });
    canvas.backgroundColor = pageBackgroundColor;
    preparePhotobookCanvasForPrintExport(canvas);
    canvas.requestRenderAll();

    const multW = cmToPrintPx(widthCm) / Math.max(1, editorWidthPx);
    const multH = cmToPrintPx(heightCm) / Math.max(1, editorHeightPx);
    const multiplier = Math.max(multW, multH);

    return exportFabricCanvasRegionAsJpeg(canvas, {
      left: pad,
      top: pad,
      width: editorWidthPx,
      height: editorHeightPx,
      multiplier,
      backgroundColor: pageBackgroundColor,
      quality: 1,
    });
  } finally {
    canvas.dispose();
  }
}

export async function generatePhotobookPrintPdfFromProjectJson(
  projectJson: PhotobookProjectJson,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pageSizeCm = projectJson.pageSizeCm || { width: 5, height: 5 };
  const pageSizePx = projectJson.pageSizePx || { widthPx: 380, heightPx: 380 };
  const pages = projectJson.pages || [];

  if (pages.length === 0) throw new Error('Project has no pages');

  const pagesToPrint = pages.filter((page) =>
    innerPageHasPrintableContent(page, projectJson.fabricByPageId?.[page.id]),
  );

  if (pagesToPrint.length === 0) throw new Error('Project has no pages');

  const widthMm = (pageSizeCm.width / 2.54) * 25.4;
  const heightMm = (pageSizeCm.height / 2.54) * 25.4;
  const landscape = widthMm > heightMm;

  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: false,
  });

  for (let i = 0; i < pagesToPrint.length; i += 1) {
    const page = pagesToPrint[i];
    if (i > 0) {
      doc.addPage([widthMm, heightMm], landscape ? 'landscape' : 'portrait');
    }

    if (page.id === BACK_COVER_PAGE_ID) {
      const dataUrl = await renderBlankPrintPageToDataUrl(
        pageSizePx.widthPx,
        pageSizePx.heightPx,
        pageSizeCm.width,
        pageSizeCm.height,
      );
      doc.addImage(dataUrl, 'JPEG', 0, 0, widthMm, heightMm, undefined, 'SLOW');
      continue;
    }

    const fabricData = projectJson.fabricByPageId?.[page.id];
    if (!fabricData) continue;

    const dataUrl = await renderPageToDataUrl(
      fabricData,
      pageSizePx.widthPx,
      pageSizePx.heightPx,
      pageSizeCm.width,
      pageSizeCm.height,
      getPrintPageBackground(page),
      page,
    );
    doc.addImage(dataUrl, 'JPEG', 0, 0, widthMm, heightMm, undefined, 'SLOW');
  }

  return doc.output('blob');
}
