import { config } from 'fabric';
import type { Canvas } from './types';
import { PB_PAGE_SIZE_PX } from './constants';
import { logPbZoomProbe } from './pbCanvasZoomProbe';
import type { PbPageDimensions } from './chrome';

export type SyncCanvasDisplayScaleOptions = {
  /** CSS resize + coords only; skip DPR/backstore refresh to avoid flicker while wheel-zooming. */
  cssOnly?: boolean;
};

let lastConfiguredDpi = -1;

/** Retina multiplier for backstore: device DPR × DOM artboard zoom (not Fabric viewport zoom). */
export function getCanvasDisplayPixelRatio(domZoom: number): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return dpr * Math.max(domZoom, 0.25);
}

/** Keep Fabric in design space; viewport zoom is always identity. */
export function resetCanvasDesignViewport(canvas: Canvas) {
  canvas.setZoom(1);
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
}

/**
 * Sync canvas CSS + backstore to the DOM zoom host size.
 * DOM (--pb-stack-zoom) is the only zoom source; Fabric coords stay in design space.
 */
export function syncCanvasDisplayScale(
  canvas: Canvas,
  domZoom: number,
  hostEl?: HTMLElement | null,
  pad: number = 0,
  page: PbPageDimensions = { widthPx: PB_PAGE_SIZE_PX, heightPx: PB_PAGE_SIZE_PX },
  opts?: SyncCanvasDisplayScaleOptions,
) {
  const designW = page.widthPx + pad * 2;
  const designH = page.heightPx + pad * 2;

  let layoutScale: number;
  if (pad > 0) {
    layoutScale = Math.max(domZoom, 0.25);
    if (hostEl) {
      hostEl.style.setProperty('--pb-fabric-select-pad', `${pad * layoutScale}px`);
      hostEl.style.setProperty('--pb-page-width-px', `${page.widthPx * layoutScale}px`);
      hostEl.style.setProperty('--pb-page-height-px', `${page.heightPx * layoutScale}px`);
      hostEl.style.setProperty('--pb-page-size-px', `${Math.max(page.widthPx, page.heightPx) * layoutScale}px`);
    }
  } else if (hostEl) {
    layoutScale =
      hostEl.clientWidth > 0
        ? hostEl.clientWidth / page.widthPx
        : Math.max(domZoom, 0.25);
    hostEl.style.setProperty('--pb-page-width-px', `${page.widthPx * layoutScale}px`);
    hostEl.style.setProperty('--pb-page-height-px', `${page.heightPx * layoutScale}px`);
    hostEl.style.setProperty('--pb-page-size-px', `${Math.max(page.widthPx, page.heightPx) * layoutScale}px`);
  } else {
    layoutScale = Math.max(domZoom, 0.25);
  }

  const cssW = Math.round(designW * layoutScale);
  const cssH = Math.round(designH * layoutScale);
  const hostW = hostEl?.clientWidth ?? 0;

  const cssOnly = !!opts?.cssOnly;

  logPbZoomProbe(canvas, 'before', {
    layoutScale,
    cssPx: cssW,
    hostW,
    zoom: canvas.getZoom(),
  });

  const targetDpi = getCanvasDisplayPixelRatio(layoutScale);
  if (!cssOnly) {
    if (lastConfiguredDpi !== targetDpi) {
      config.configure({ devicePixelRatio: targetDpi });
      lastConfiguredDpi = targetDpi;
    }
    resetCanvasDesignViewport(canvas);
    canvas.setDimensions({ width: designW, height: designH });
  }

  canvas.setDimensions({ width: `${cssW}px`, height: `${cssH}px` }, { cssOnly: true });

  const cssWpx = `${cssW}px`;
  const cssHpx = `${cssH}px`;

  // Keep upper-canvas + container in lockstep with lower (misalignment reads as top-left clip).
  const upper = canvas.upperCanvasEl;
  const container = canvas.lowerCanvasEl?.parentElement;
  if (upper && canvas.lowerCanvasEl) {
    canvas.lowerCanvasEl.style.width = cssWpx;
    canvas.lowerCanvasEl.style.height = cssHpx;
    upper.style.width = cssWpx;
    upper.style.height = cssHpx;
    if (container) {
      container.style.width = cssWpx;
      container.style.height = cssHpx;
      container.style.top = '0';
      container.style.left = '0';
      container.style.position = 'absolute';
      container.style.margin = '0';
      container.style.padding = '0';
    }
    upper.style.top = '0';
    upper.style.left = '0';
    upper.style.margin = '0';
    canvas.lowerCanvasEl.style.top = '0';
    canvas.lowerCanvasEl.style.left = '0';
    canvas.lowerCanvasEl.style.margin = '0';
  }

  canvas.calcOffset();
  canvas.forEachObject((obj) => {
    obj.setCoords();
  });
  canvas.requestRenderAll();

  if (cssOnly) {
    logPbZoomProbe(canvas, 'after', {
      layoutScale,
      cssPx: cssW,
      hostW,
      zoom: canvas.getZoom(),
    });
    return;
  }

  // Debug hitbox and dimensions logging
  const host = canvas.upperCanvasEl?.closest('[class*="pbFabricCanvasHostExtended"]');
  const canvasContainer = canvas.upperCanvasEl?.closest('.canvas-container');
  const pageZoomHost = canvas.upperCanvasEl?.closest('[class*="pbCanvasPageZoomHost"]')
    || document.querySelector('[class*="pbCanvasPageZoomHost"]');

  console.log('[EXTENDED HITBOX RECTS]', {
    upper: canvas.upperCanvasEl?.getBoundingClientRect(),
    lower: canvas.lowerCanvasEl?.getBoundingClientRect(),
    canvasContainer: canvasContainer?.getBoundingClientRect(),
    host: host?.getBoundingClientRect(),
    page: pageZoomHost?.getBoundingClientRect(),
  });

  console.log('[FABRIC DIMENSIONS]', {
    fabricWidth: canvas.getWidth(),
    fabricHeight: canvas.getHeight(),
    upperAttrWidth: canvas.upperCanvasEl?.width,
    upperAttrHeight: canvas.upperCanvasEl?.height,
    upperCssWidth: canvas.upperCanvasEl?.style.width,
    upperCssHeight: canvas.upperCanvasEl?.style.height,
  });

  logPbZoomProbe(canvas, 'after', {
    layoutScale,
    cssPx: cssW,
    hostW,
    zoom: canvas.getZoom(),
  });
}
