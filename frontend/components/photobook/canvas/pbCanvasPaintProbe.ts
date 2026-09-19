import type { Canvas, FabricObject } from './types';
import { resolveActivePbCanvasZoomHost } from './pbCanvasDomDiagnostics';

type QuadrantId = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export type PbQuadrantPaintStats = {
  quadrant: QuadrantId;
  sampleW: number;
  sampleH: number;
  opaquePct: number;
  whitePct: number;
  nearWhitePct: number;
  meanR: number;
  meanG: number;
  meanB: number;
  meanA: number;
};

export type PbCanvasPaintLayerReport = {
  lower: PbQuadrantPaintStats[];
  upper: PbQuadrantPaintStats[];
  upperMinusLower: {
    quadrant: QuadrantId;
    extraWhitePixels: number;
    extraOpaquePixels: number;
  }[];
  verdict: string[];
};

export type PbEditingOverlayReport = {
  fabricCanvas: boolean;
  contextTop: {
    exists: boolean;
    width: number;
    height: number;
    matchesUpperAttr: boolean;
  };
  contextTopDirty: boolean | null;
  activeObject: {
    type: string;
    isEditing: boolean;
    hiddenTextareaInDom: boolean;
  } | null;
  fabricTextareas: Array<{
    display: string;
    visibility: string;
    opacity: string;
    rect: { w: number; h: number; x: number; y: number };
    valuePreview: string;
  }>;
  selectionOnUpper: string;
};

import {
  registerPbFabricCanvas,
  resolveFabricCanvas,
  unregisterPbFabricCanvas,
} from './pbFabricCanvasRegistry';

export { resolveFabricCanvas, logAllPbFabricInstances, listAllPbFabricInstances } from './pbFabricCanvasRegistry';

const upperDisplayRestore = new WeakMap<HTMLElement, string>();

/** @deprecated Use registerPbFabricCanvas(pageId, canvas) */
export function registerPbFabricCanvasForProbe(canvas: Canvas | null, pageId?: string) {
  if (canvas && pageId) registerPbFabricCanvas(pageId, canvas);
  else if (pageId) unregisterPbFabricCanvas(pageId);
}

function quadrantBounds(
  w: number,
  h: number,
  q: QuadrantId,
): { x0: number; y0: number; x1: number; y1: number } {
  const mx = Math.floor(w / 2);
  const my = Math.floor(h / 2);
  if (q === 'topLeft') return { x0: 0, y0: 0, x1: mx, y1: my };
  if (q === 'topRight') return { x0: mx, y0: 0, x1: w, y1: my };
  if (q === 'bottomLeft') return { x0: 0, y0: my, x1: mx, y1: h };
  return { x0: mx, y0: my, x1: w, y1: h };
}

function sampleQuadrant(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  q: QuadrantId,
): PbQuadrantPaintStats {
  const { x0, y0, x1, y1 } = quadrantBounds(w, h, q);
  const sw = Math.max(1, x1 - x0);
  const sh = Math.max(1, y1 - y0);
  let data: ImageData;
  try {
    data = ctx.getImageData(x0, y0, sw, sh);
  } catch {
    return {
      quadrant: q,
      sampleW: 0,
      sampleH: 0,
      opaquePct: 0,
      whitePct: 0,
      nearWhitePct: 0,
      meanR: 0,
      meanG: 0,
      meanB: 0,
      meanA: 0,
    };
  }
  const px = data.data;
  const n = px.length / 4;
  let opaque = 0;
  let white = 0;
  let nearWhite = 0;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let aSum = 0;

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const a = px[i + 3];
    rSum += r;
    gSum += g;
    bSum += b;
    aSum += a;
    if (a > 12) {
      opaque += 1;
      if (r > 245 && g > 245 && b > 245) white += 1;
      if (r > 220 && g > 220 && b > 220) nearWhite += 1;
    }
  }

  return {
    quadrant: q,
    sampleW: sw,
    sampleH: sh,
    opaquePct: Math.round((opaque / n) * 1000) / 10,
    whitePct: Math.round((white / n) * 1000) / 10,
    nearWhitePct: Math.round((nearWhite / n) * 1000) / 10,
    meanR: Math.round(rSum / n),
    meanG: Math.round(gSum / n),
    meanB: Math.round(bSum / n),
    meanA: Math.round(aSum / n),
  };
}

function sampleCanvasElement(el: HTMLCanvasElement | null): PbQuadrantPaintStats[] {
  if (!el) return [];
  const ctx = el.getContext('2d');
  if (!ctx) return [];
  const w = el.width;
  const h = el.height;
  const quads: QuadrantId[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
  return quads.map((q) => sampleQuadrant(ctx, w, h, q));
}

function diffUpperLower(
  lower: PbQuadrantPaintStats[],
  upper: PbQuadrantPaintStats[],
): PbCanvasPaintLayerReport['upperMinusLower'] {
  return lower.map((l, i) => {
    const u = upper[i];
    if (!u) return { quadrant: l.quadrant, extraWhitePixels: 0, extraOpaquePixels: 0 };
    const extraWhite = Math.max(0, u.whitePct - l.whitePct);
    const extraOpaque = Math.max(0, u.opaquePct - l.opaquePct);
    return {
      quadrant: l.quadrant,
      extraWhitePixels: Math.round(extraWhite * 10) / 10,
      extraOpaquePixels: Math.round(extraOpaque * 10) / 10,
    };
  });
}

export function probeCanvasPaintLayers(zoomHost?: HTMLElement | null): PbCanvasPaintLayerReport {
  const host = zoomHost ?? resolveActivePbCanvasZoomHost();
  if (!host) {
    return { lower: [], upper: [], upperMinusLower: [], verdict: ['No zoom host'] };
  }

  const lowerEl = host.querySelector<HTMLCanvasElement>('.lower-canvas');
  const upperEl = host.querySelector<HTMLCanvasElement>('.upper-canvas');
  const lower = sampleCanvasElement(lowerEl);
  const upper = sampleCanvasElement(upperEl);
  const upperMinusLower = diffUpperLower(lower, upper);
  const verdict: string[] = [];

  const tl = upperMinusLower.find((d) => d.quadrant === 'topLeft');
  const upperTl = upper.find((q) => q.quadrant === 'topLeft');
  const lowerTl = lower.find((q) => q.quadrant === 'topLeft');

  if (tl && tl.extraWhitePixels > 5) {
    verdict.push(
      `top-left: upper-canvas/contextTop has ~${tl.extraWhitePixels}% more white pixels than lower-canvas → artifact likely on UPPER (contextTop)`,
    );
  } else if (lowerTl && lowerTl.whitePct > 15 && (!upperTl || upperTl.whitePct <= lowerTl.whitePct + 2)) {
    verdict.push(
      `top-left: white region is on lower-canvas (${lowerTl.whitePct}% white) — artifact on LOWER paint`,
    );
  } else if (upperTl && upperTl.whitePct > 15 && lowerTl && lowerTl.whitePct > 15) {
    verdict.push('top-left: white on BOTH layers (page bg or shared content)');
  } else {
    verdict.push('top-left: no strong white-pixel skew between layers in backstore sample');
  }

  if (upperTl && upperTl.opaquePct > 10 && lowerTl && lowerTl.opaquePct < 2) {
    verdict.push('top-left: opaque paint on upper only → selection/edit overlay on contextTop');
  }

  return { lower, upper, upperMinusLower, verdict };
}

export function inspectFabricEditingOverlays(): PbEditingOverlayReport {
  const canvas = resolveFabricCanvas();
  if (!canvas) {
    return {
      fabricCanvas: false,
      contextTop: { exists: false, width: 0, height: 0, matchesUpperAttr: false },
      contextTopDirty: null,
      activeObject: null,
      fabricTextareas: [],
      selectionOnUpper: 'no fabric canvas registered',
    };
  }

  const upper = canvas.upperCanvasEl;
  const topCtx = canvas.contextTop;
  const active = canvas.getActiveObject() as
    | (FabricObject & { isEditing?: boolean; hiddenTextarea?: HTMLTextAreaElement | null })
    | undefined;

  const textareas = Array.from(
    document.querySelectorAll<HTMLTextAreaElement>('textarea[data-fabric="textarea"]'),
  ).map((ta) => {
    const r = ta.getBoundingClientRect();
    const cs = getComputedStyle(ta);
    return {
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      rect: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
      valuePreview: ta.value.slice(0, 30),
    };
  });

  let selectionOnUpper = 'unknown';
  if (!topCtx) selectionOnUpper = 'contextTop missing';
  else if (canvas.getActiveObject())
    selectionOnUpper = 'active object present (controls drawn on upper/contextTop)';
  else selectionOnUpper = 'no active object';

  return {
    fabricCanvas: true,
    contextTop: {
      exists: !!topCtx,
      width: topCtx?.canvas.width ?? 0,
      height: topCtx?.canvas.height ?? 0,
      matchesUpperAttr: !!topCtx && topCtx.canvas.width === upper?.width && topCtx.canvas.height === upper?.height,
    },
    contextTopDirty: (canvas as Canvas & { contextTopDirty?: boolean }).contextTopDirty ?? null,
    activeObject: active
      ? {
          type: String(active.type ?? 'unknown'),
          isEditing: !!active.isEditing,
          hiddenTextareaInDom: textareas.length > 0,
        }
      : null,
    fabricTextareas: textareas,
    selectionOnUpper,
  };
}

/** Match user manual test: display:none on upper only. */
export function hideUpperCanvasDisplayNone(zoomHost?: HTMLElement | null): boolean {
  const host = zoomHost ?? resolveActivePbCanvasZoomHost();
  const upper = host?.querySelector<HTMLElement>('.upper-canvas');
  if (!upper) return false;
  if (!upperDisplayRestore.has(upper)) {
    upperDisplayRestore.set(upper, upper.style.display);
  }
  upper.style.display = 'none';
  console.log('[pb-paint] upper-canvas display:none — if white artifact disappears, it is drawn on upper/contextTop');
  return true;
}

export function restoreUpperCanvasDisplay(zoomHost?: HTMLElement | null) {
  const host = zoomHost ?? resolveActivePbCanvasZoomHost();
  const upper = host?.querySelector<HTMLElement>('.upper-canvas');
  if (!upper) return;
  const prev = upperDisplayRestore.get(upper);
  upper.style.display = prev ?? '';
  upperDisplayRestore.delete(upper);
  console.log('[pb-paint] upper-canvas display restored');
}

export function logPbCanvasPaintProbe(zoomHost?: HTMLElement | null) {
  const paint = probeCanvasPaintLayers(zoomHost);
  const editing = inspectFabricEditingOverlays();

  console.group('[pb-paint] layer paint probe');
  console.log('Tip: hide upper only → __PB_HIDE_UPPER__() then restore → __PB_RESTORE_UPPER__()');

  console.group('lower-canvas backstore (quadrants)');
  console.table(paint.lower);
  console.groupEnd();

  console.group('upper-canvas / contextTop backstore (quadrants)');
  console.table(paint.upper);
  console.groupEnd();

  console.group('upper − lower (white/opaque delta %)');
  console.table(paint.upperMinusLower);
  console.groupEnd();

  console.log('Verdict:', paint.verdict);

  console.group('Fabric editing / contextTop');
  console.log(editing);
  console.groupEnd();

  console.groupEnd();

  return { paint, editing };
}

declare global {
  // eslint-disable-next-line no-var
  var __PB_PAINT_PROBE__: typeof logPbCanvasPaintProbe | undefined;
  // eslint-disable-next-line no-var
  var __PB_HIDE_UPPER__: typeof hideUpperCanvasDisplayNone | undefined;
  // eslint-disable-next-line no-var
  var __PB_RESTORE_UPPER__: typeof restoreUpperCanvasDisplay | undefined;
  // eslint-disable-next-line no-var
  var __PB_FABRIC_CANVAS__: Canvas | null | undefined;
}

export function installPbCanvasPaintProbeGlobals() {
  if (typeof globalThis === 'undefined') return;
  globalThis.__PB_PAINT_PROBE__ = logPbCanvasPaintProbe;
  globalThis.__PB_HIDE_UPPER__ = hideUpperCanvasDisplayNone;
  globalThis.__PB_RESTORE_UPPER__ = restoreUpperCanvasDisplay;
}

installPbCanvasPaintProbeGlobals();
