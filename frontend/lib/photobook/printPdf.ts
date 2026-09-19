import type { PbCanvasSerialized } from '@/components/photobook/canvas';
import { exportPageForPrint, type PrintPageSpec } from '@/lib/photobook/canvasExport';

const CM_PER_INCH = 2.54;
const PRINT_DPI = 400;

function cmToMm(cm: number): number {
  return (cm / CM_PER_INCH) * 25.4;
}

export async function generatePhotobookPrintPdf(
  pages: PrintPageSpec[],
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');

  if (pages.length === 0) {
    throw new Error('No pages to print');
  }

  const first = pages[0];
  const widthMm = cmToMm(first.widthCm);
  const heightMm = cmToMm(first.heightCm);
  const landscape = widthMm > heightMm;

  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: false,
  });

  for (let i = 0; i < pages.length; i += 1) {
    const spec = pages[i];
    const pageWidthMm = cmToMm(spec.widthCm);
    const pageHeightMm = cmToMm(spec.heightCm);
    const pageLandscape = pageWidthMm > pageHeightMm;

    if (i > 0) {
      doc.addPage([pageWidthMm, pageHeightMm], pageLandscape ? 'landscape' : 'portrait');
    }

    const blob = await exportPageForPrint(spec);
    if (!blob) continue;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read page image'));
      reader.readAsDataURL(blob);
    });

    doc.addImage(dataUrl, 'JPEG', 0, 0, pageWidthMm, pageHeightMm, undefined, 'SLOW');
  }

  doc.setProperties({
    title: 'Photobook Print',
    subject: `Print-ready ${PRINT_DPI} DPI`,
  });

  return doc.output('blob');
}

export function walkAndReplaceUrls(
  value: unknown,
  replace: (url: string) => string,
): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('blob:') || value.startsWith('data:')) {
      return replace(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => walkAndReplaceUrls(item, replace));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = walkAndReplaceUrls(v, replace);
    }
    return out;
  }
  return value;
}

export function cloneFabricJson(data: PbCanvasSerialized): PbCanvasSerialized {
  return JSON.parse(JSON.stringify(data)) as PbCanvasSerialized;
}
