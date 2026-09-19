import type { Canvas, FabricObject } from './types';
import { PB_PAGE_SIZE_PX } from './constants';
import { isChromeObject } from './chrome';
import { isObjectLocked } from './interaction';
import {
  listAllPbFabricInstances,
  logAllPbFabricInstances,
  resolveFabricCanvas,
} from './pbFabricCanvasRegistry';

export type PbFabricObjectRow = {
  index: number;
  type: string;
  name: string;
  pbKind: string;
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  fill: string;
  stroke: string;
  opacity: number;
  visible: boolean;
  selectable: boolean;
  evented: boolean;
  objectLocked: boolean;
  hasClipPath: boolean;
  objectCaching: boolean;
  boundLeft: number;
  boundTop: number;
  boundW: number;
  boundH: number;
  coversTopLeftQuadrant: boolean;
  likelyWhitePaint: boolean;
  flags: string[];
};

export type PbCanvasObjectProbeReport = {
  objectCount: number;
  drawOrder: Array<{ index: number; type: string; name: string; pbKind: string }>;
  rows: PbFabricObjectRow[];
  topLeftCandidates: PbFabricObjectRow[];
  chromeObjects: PbFabricObjectRow[];
  userObjects: PbFabricObjectRow[];
  verdict: string[];
};

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

function fillSummary(obj: FabricObject): string {
  const o = obj as FabricObject & { fill?: string | { toString?: () => string } };
  const f = o.fill;
  if (f == null) return '';
  if (typeof f === 'string') return f;
  if (typeof f === 'object' && f && 'toString' in f) return String(f);
  return String(f);
}

function isLikelyWhiteFill(fill: string): boolean {
  const s = fill.toLowerCase().replace(/\s/g, '');
  if (!s) return false;
  return (
    s === '#fff' ||
    s === '#ffffff' ||
    s === 'white' ||
    s === 'rgb(255,255,255)' ||
    s.startsWith('rgba(255,255,255')
  );
}

/** Canvas-space top-left quadrant (380 design space). */
function boundCoversTopLeft(obj: FabricObject): boolean {
  const b = obj.getBoundingRect();
  const mx = PB_PAGE_SIZE_PX / 2;
  const my = PB_PAGE_SIZE_PX / 2;
  return b.left < mx && b.top < my && b.left + b.width > 0 && b.top + b.height > 0;
}

export function snapshotFabricObject(obj: FabricObject, index: number): PbFabricObjectRow {
  const tagged = obj as FabricObject & { pbKind?: string; name?: string };
  const b = obj.getBoundingRect();
  const fill = fillSummary(obj);
  const stroke = String((obj as FabricObject & { stroke?: string }).stroke ?? '');
  const flags: string[] = [];

  if (tagged.pbKind === 'page-bg') flags.push('page-bg');
  if (isChromeObject(obj)) flags.push('chrome');
  if (tagged.name === 'pb-crop-overlay') flags.push('crop-overlay');
  if (isObjectLocked(obj)) flags.push('object-locked');
  if (obj.clipPath) flags.push('has-clipPath');
  if (!obj.visible) flags.push('invisible');
  if (!obj.selectable && !isChromeObject(obj)) flags.push('non-selectable');
  if (isLikelyWhiteFill(fill)) flags.push('white-fill');
  if (obj.type === 'rect' && !tagged.pbKind) flags.push('anonymous-rect');

  const coversTopLeftQuadrant = boundCoversTopLeft(obj);
  if (coversTopLeftQuadrant && isLikelyWhiteFill(fill)) flags.push('TL-white-candidate');

  return {
    index,
    type: String(obj.type ?? 'unknown'),
    name: String(tagged.name ?? ''),
    pbKind: String(tagged.pbKind ?? ''),
    left: round(obj.left ?? 0),
    top: round(obj.top ?? 0),
    width: round(obj.width ?? 0),
    height: round(obj.height ?? 0),
    scaleX: round(obj.scaleX ?? 1),
    scaleY: round(obj.scaleY ?? 1),
    angle: round(obj.angle ?? 0),
    fill,
    stroke,
    opacity: round(obj.opacity ?? 1),
    visible: obj.visible !== false,
    selectable: obj.selectable !== false,
    evented: obj.evented !== false,
    objectLocked: isObjectLocked(obj),
    hasClipPath: !!obj.clipPath,
    objectCaching: !!obj.objectCaching,
    boundLeft: round(b.left),
    boundTop: round(b.top),
    boundW: round(b.width),
    boundH: round(b.height),
    coversTopLeftQuadrant,
    likelyWhitePaint: isLikelyWhiteFill(fill) || tagged.pbKind === 'page-bg',
    flags,
  };
}

export function probeCanvasObjects(canvas?: Canvas | null): PbCanvasObjectProbeReport {
  const c = canvas ?? resolveFabricCanvas();
  if (!c) {
    const instances = listAllPbFabricInstances();
    return {
      objectCount: 0,
      drawOrder: [],
      rows: [],
      topLeftCandidates: [],
      chromeObjects: [],
      userObjects: [],
      verdict: [
        'No active Fabric canvas resolved — run __PB_LOG_FABRIC_INSTANCES__()',
        `Registered instances: ${instances.length}`,
      ],
    };
  }

  const objects = c.getObjects();
  const rows = objects.map((o, i) => snapshotFabricObject(o, i));
  const drawOrder = rows.map((r) => ({
    index: r.index,
    type: r.type,
    name: r.name,
    pbKind: r.pbKind,
  }));

  const chromeObjects = rows.filter((r) => r.flags.includes('chrome') || r.flags.includes('page-bg'));
  const userObjects = rows.filter((r) => !r.flags.includes('chrome'));
  const topLeftCandidates = rows.filter(
    (r) => r.coversTopLeftQuadrant && (r.likelyWhitePaint || r.type === 'i-text' || r.type === 'textbox'),
  );

  const verdict: string[] = [];
  const pageBg = rows.find((r) => r.pbKind === 'page-bg');
  if (pageBg) {
    verdict.push(
      `page-bg: bound ${pageBg.boundW}×${pageBg.boundH} at (${pageBg.boundLeft},${pageBg.boundTop}) fill=${pageBg.fill}`,
    );
    if (pageBg.boundW < PB_PAGE_SIZE_PX * 0.9 || pageBg.boundH < PB_PAGE_SIZE_PX * 0.9) {
      verdict.push('WARN: page-bg smaller than full page — may expose wrong regions');
    }
  } else {
    verdict.push('WARN: no page-bg object on canvas');
  }

  const whiteRects = rows.filter(
    (r) => r.type === 'rect' && r.likelyWhitePaint && r.pbKind !== 'page-bg',
  );
  if (whiteRects.length) {
    verdict.push(`Found ${whiteRects.length} non-page-bg white rect(s) — likely artifact source`);
  }

  const tlWhite = rows.filter((r) => r.flags.includes('TL-white-candidate'));
  if (tlWhite.length) {
    verdict.push(`Top-left white paint candidates: indexes ${tlWhite.map((r) => r.index).join(', ')}`);
  }

  const itext = rows.filter((r) => r.type === 'i-text' || r.type === 'textbox');
  for (const t of itext) {
    const extra = c.getObjects()[t.index] as FabricObject & {
      selectionBackgroundColor?: string;
      backgroundColor?: string;
      textBackgroundColor?: string;
    };
    const selBg = extra.selectionBackgroundColor ?? '';
    const bg = extra.backgroundColor ?? extra.textBackgroundColor ?? '';
    if (selBg || bg) {
      verdict.push(
        `text[${t.index}]: selectionBackgroundColor=${selBg || '-'} backgroundColor=${bg || '-'}`,
      );
    }
  }

  if (topLeftCandidates.length === 1) {
    const o = topLeftCandidates[0];
    verdict.push(`Primary TL suspect: index ${o.index} ${o.type} pbKind=${o.pbKind || '-'}`);
  }

  return {
    objectCount: objects.length,
    drawOrder,
    rows,
    topLeftCandidates,
    chromeObjects,
    userObjects,
    verdict,
  };
}

export function logCanvasDrawOrder(canvas?: Canvas | null) {
  const c = canvas ?? resolveFabricCanvas();
  if (!c) {
    console.warn('[pb-objects] no canvas');
    return;
  }
  console.group('[pb-objects] draw order (back → front)');
  c.getObjects().forEach((o, i) => {
    const t = o as FabricObject & { pbKind?: string; name?: string };
    console.log(i, t.type, t.name || '-', t.pbKind || '-');
  });
  console.groupEnd();
}

export function logPbCanvasObjectProbe(canvas?: Canvas | null) {
  logAllPbFabricInstances();
  const report = probeCanvasObjects(canvas);
  const pageId = (canvas ?? resolveFabricCanvas() ?? null) as Canvas & { __pbPageId?: string } | null;

  console.group('[pb-objects] Fabric object probe');
  console.log('Inspecting pageId:', pageId?.__pbPageId ?? '(unknown)');
  logCanvasDrawOrder(canvas);

  console.log('User snippet (basic):');
  console.table(
    report.rows.map((r) => ({
      index: r.index,
      type: r.type,
      name: r.name,
      pbKind: r.pbKind,
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      scaleX: r.scaleX,
      scaleY: r.scaleY,
      selectable: r.selectable,
      visible: r.visible,
      evented: r.evented,
    })),
  );

  console.log('Full probe (bounds, fill, flags):');
  console.table(report.rows);

  if (report.topLeftCandidates.length) {
    console.log('Top-left quadrant candidates:');
    console.table(report.topLeftCandidates);
  }

  console.log('Chrome / page-bg:');
  console.table(report.chromeObjects);

  console.log('Verdict:', report.verdict);
  console.groupEnd();

  return report;
}

/** Hide one object by index to see if white artifact disappears (restore with restorePbObjectVisibility). */
const visibilityRestore = new WeakMap<FabricObject, boolean>();

export function hideFabricObjectAt(index: number, canvas?: Canvas | null) {
  const c = canvas ?? resolveFabricCanvas();
  if (!c) return false;
  const obj = c.getObjects()[index];
  if (!obj) return false;
  if (!visibilityRestore.has(obj)) visibilityRestore.set(obj, obj.visible !== false);
  obj.visible = false;
  c.requestRenderAll();
  console.log(`[pb-objects] hidden index ${index}`, snapshotFabricObject(obj, index));
  return true;
}

export function restorePbObjectVisibility(canvas?: Canvas | null) {
  const c = canvas ?? resolveFabricCanvas();
  if (!c) return;
  c.getObjects().forEach((obj) => {
    if (visibilityRestore.has(obj)) {
      obj.visible = visibilityRestore.get(obj)!;
      visibilityRestore.delete(obj);
    }
  });
  c.requestRenderAll();
  console.log('[pb-objects] visibility restored');
}

declare global {
  // eslint-disable-next-line no-var
  var __PB_OBJECT_PROBE__: typeof logPbCanvasObjectProbe | undefined;
  // eslint-disable-next-line no-var
  var __PB_OBJECT_DRAW_ORDER__: typeof logCanvasDrawOrder | undefined;
  // eslint-disable-next-line no-var
  var __PB_HIDE_OBJECT_AT__: typeof hideFabricObjectAt | undefined;
  // eslint-disable-next-line no-var
  var __PB_RESTORE_OBJECT_VISIBILITY__: typeof restorePbObjectVisibility | undefined;
}

export function installPbCanvasObjectProbeGlobals() {
  if (typeof globalThis === 'undefined') return;
  globalThis.__PB_OBJECT_PROBE__ = logPbCanvasObjectProbe;
  globalThis.__PB_OBJECT_DRAW_ORDER__ = logCanvasDrawOrder;
  globalThis.__PB_HIDE_OBJECT_AT__ = hideFabricObjectAt;
  globalThis.__PB_RESTORE_OBJECT_VISIBILITY__ = restorePbObjectVisibility;
}

installPbCanvasObjectProbeGlobals();
