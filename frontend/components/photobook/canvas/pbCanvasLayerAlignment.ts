import type { Canvas } from './types';
import { PB_PAGE_SIZE_PX } from './constants';
import { resolveActivePbCanvasZoomHost } from './pbCanvasDomDiagnostics';

export type PbLayerRectRow = {
  layer: string;
  found: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  cssWidth: string;
  cssHeight: string;
  attrW: number | null;
  attrH: number | null;
  position: string;
  transform: string;
};

export type PbLayerAlignmentReport = {
  zoomHostLabel: string;
  stackZoom: string;
  hostClientW: number;
  hostClientH: number;
  expectedCssPx: number;
  fabricReportedCss: { width: string; height: string } | null;
  rows: PbLayerRectRow[];
  lowerVsUpper: {
    samePosition: boolean;
    sameSize: boolean;
    deltaW: number;
    deltaH: number;
    deltaX: number;
    deltaY: number;
  } | null;
  lowerVsHost: {
    coversHost: boolean;
    widthRatio: number;
    heightRatio: number;
    deltaW: number;
    deltaH: number;
  } | null;
  backstoreVsCss: {
    lowerAttrW: number;
    lowerAttrH: number;
    lowerCssW: number;
    scaleRatio: number;
  } | null;
  warnings: string[];
};

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function readRow(el: Element | null, layer: string): PbLayerRectRow {
  if (!el || !(el instanceof HTMLElement)) {
    return {
      layer,
      found: false,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      cssWidth: '',
      cssHeight: '',
      attrW: null,
      attrH: null,
      position: '',
      transform: '',
    };
  }
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    layer,
    found: true,
    x: round(r.x),
    y: round(r.y),
    width: round(r.width),
    height: round(r.height),
    cssWidth: el.style.width || cs.width,
    cssHeight: el.style.height || cs.height,
    attrW: el instanceof HTMLCanvasElement ? el.width : null,
    attrH: el instanceof HTMLCanvasElement ? el.height : null,
    position: cs.position,
    transform: cs.transform === 'none' ? '' : cs.transform,
  };
}

export function scanPbCanvasLayerAlignment(
  zoomHost?: HTMLElement | null,
  fabricCanvas?: Canvas | null,
): PbLayerAlignmentReport {
  const host = zoomHost ?? resolveActivePbCanvasZoomHost();
  const warnings: string[] = [];
  if (!host) {
    return {
      zoomHostLabel: '',
      stackZoom: '',
      hostClientW: 0,
      hostClientH: 0,
      expectedCssPx: 0,
      fabricReportedCss: null,
      rows: [],
      lowerVsUpper: null,
      lowerVsHost: null,
      backstoreVsCss: null,
      warnings: ['No pbCanvasPageZoomHost found'],
    };
  }

  const unit = host.closest<HTMLElement>('[class*="pbCanvasPageUnit"]');
  const stackZoom = unit
    ? getComputedStyle(unit).getPropertyValue('--pb-stack-zoom').trim() || '1'
    : '?';
  const hostClientW = host.clientWidth;
  const hostClientH = host.clientHeight;
  const stackZoomNum = parseFloat(stackZoom) || 1;
  const expectedCssPx = Math.round(PB_PAGE_SIZE_PX * (hostClientW > 0 ? hostClientW / PB_PAGE_SIZE_PX : stackZoomNum));

  const zoomSurface = host.querySelector('[class*="pbCanvasZoomSurface"]');
  const fabricHost = host.querySelector('[class*="pbFabricCanvasHost"]');
  const container = host.querySelector('.canvas-container');
  const lower = host.querySelector('.lower-canvas');
  const upper = host.querySelector('.upper-canvas');

  const rows = [
    readRow(host, 'pbCanvasPageZoomHost (page bg)'),
    readRow(zoomSurface, 'pbCanvasZoomSurface'),
    readRow(fabricHost, 'pbFabricCanvasHost'),
    readRow(container, 'canvas-container'),
    readRow(lower, 'lower-canvas'),
    readRow(upper, 'upper-canvas'),
  ];

  const lowerRow = rows.find((r) => r.layer === 'lower-canvas');
  const upperRow = rows.find((r) => r.layer === 'upper-canvas');
  const hostRow = rows[0];

  let lowerVsUpper: PbLayerAlignmentReport['lowerVsUpper'] = null;
  if (lowerRow?.found && upperRow?.found) {
    const samePosition = lowerRow.x === upperRow.x && lowerRow.y === upperRow.y;
    const sameSize = lowerRow.width === upperRow.width && lowerRow.height === upperRow.height;
    lowerVsUpper = {
      samePosition,
      sameSize,
      deltaW: round(lowerRow.width - upperRow.width),
      deltaH: round(lowerRow.height - upperRow.height),
      deltaX: round(lowerRow.x - upperRow.x),
      deltaY: round(lowerRow.y - upperRow.y),
    };
    if (!samePosition) warnings.push('lower-canvas and upper-canvas positions differ');
    if (!sameSize) warnings.push('lower-canvas and upper-canvas sizes differ');
  }

  let lowerVsHost: PbLayerAlignmentReport['lowerVsHost'] = null;
  if (lowerRow?.found && hostRow.found) {
    const widthRatio = hostRow.width > 0 ? lowerRow.width / hostRow.width : 0;
    const heightRatio = hostRow.height > 0 ? lowerRow.height / hostRow.height : 0;
    const coversHost =
      Math.abs(lowerRow.width - hostRow.width) < 2 && Math.abs(lowerRow.height - hostRow.height) < 2;
    lowerVsHost = {
      coversHost,
      widthRatio: round(widthRatio),
      heightRatio: round(heightRatio),
      deltaW: round(lowerRow.width - hostRow.width),
      deltaH: round(lowerRow.height - hostRow.height),
    };
    if (!coversHost) {
      warnings.push(
        `lower-canvas does not cover zoom host (${round(widthRatio * 100)}% × ${round(heightRatio * 100)}%)`,
      );
    }
    if (widthRatio > 0 && widthRatio < 0.85) {
      warnings.push('lower-canvas may be stale/quarter-sized relative to page host');
    }
  }

  let backstoreVsCss: PbLayerAlignmentReport['backstoreVsCss'] = null;
  if (lowerRow?.found && lowerRow.attrW != null && lowerRow.attrH != null && lowerRow.width > 0) {
    const scaleRatio = round(lowerRow.attrW / lowerRow.width);
    backstoreVsCss = {
      lowerAttrW: lowerRow.attrW,
      lowerAttrH: lowerRow.attrH!,
      lowerCssW: lowerRow.width,
      scaleRatio,
    };
    if (Math.abs(scaleRatio - (window.devicePixelRatio || 1) * (hostClientW / PB_PAGE_SIZE_PX)) > 1.5) {
      warnings.push(`backstore/CSS scale ratio unusual: ${scaleRatio}`);
    }
  }

  const fabricReportedCss = fabricCanvas
    ? {
        width: String(fabricCanvas.width ?? ''),
        height: String(fabricCanvas.height ?? ''),
      }
    : null;

  const inlineCssPx = lowerRow?.cssWidth?.endsWith('px') ? parseFloat(lowerRow.cssWidth) : null;
  if (inlineCssPx != null && Math.abs(inlineCssPx - expectedCssPx) > 2) {
    warnings.push(
      `lower inline width ${inlineCssPx}px ≠ expected ${expectedCssPx}px from host clientWidth`,
    );
  }

  return {
    zoomHostLabel: host.getAttribute('aria-label') ?? '',
    stackZoom,
    hostClientW,
    hostClientH,
    expectedCssPx,
    fabricReportedCss,
    rows,
    lowerVsUpper,
    lowerVsHost,
    backstoreVsCss,
    warnings,
  };
}

export function logPbCanvasLayerAlignment(
  zoomHost?: HTMLElement | null,
  fabricCanvas?: Canvas | null,
) {
  const report = scanPbCanvasLayerAlignment(zoomHost, fabricCanvas);

  console.group(`[pb-align] ${report.zoomHostLabel || 'layer alignment'}`);
  console.log('stack --pb-stack-zoom:', report.stackZoom);
  console.log('host client:', report.hostClientW, '×', report.hostClientH, '| expected cssPx:', report.expectedCssPx);
  if (report.fabricReportedCss) console.log('fabric canvas.width/height (css):', report.fabricReportedCss);

  console.table(report.rows);

  if (report.lowerVsUpper) {
    console.log('lower vs upper:', report.lowerVsUpper);
  }
  if (report.lowerVsHost) {
    console.log('lower vs zoom host:', report.lowerVsHost);
  }
  if (report.backstoreVsCss) {
    console.log('lower backstore vs CSS rect:', report.backstoreVsCss);
  }
  if (report.warnings.length) {
    console.warn('WARNINGS:', report.warnings);
  } else {
    console.log('No alignment warnings.');
  }
  console.groupEnd();

  return report;
}

declare global {
  // eslint-disable-next-line no-var
  var __PB_ALIGN_DIAG__: typeof logPbCanvasLayerAlignment | undefined;
  // eslint-disable-next-line no-var
  var __PB_ALIGN_PROBE__: boolean | undefined;
}

export function installPbCanvasLayerAlignmentGlobals() {
  if (typeof globalThis === 'undefined') return;
  globalThis.__PB_ALIGN_DIAG__ = logPbCanvasLayerAlignment;
}

installPbCanvasLayerAlignmentGlobals();
