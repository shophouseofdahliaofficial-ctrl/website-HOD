/* eslint-disable react/display-name */
import type { Canvas, FabricObject } from './types';
import { PB_PAGE_SIZE_PX } from './constants';
import { resolveActivePbFabricCanvas } from './pbFabricCanvasRegistry';

export type PageBgGeometrySnapshot = {
  label: string;
  ts: number;
  found: boolean;
  pageBgCount: number;
  canvas: {
    width: number;
    height: number;
    clipPath: boolean;
    viewportTransform: number[];
    backgroundColor: string;
  };
  pageBg: null | {
    visible: boolean;
    fill: string;
    left: number;
    top: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    angle: number;
    skewX: number;
    skewY: number;
    originX: string;
    originY: string;
    dirty: boolean;
    objectCaching: boolean;
    hasClipPath: boolean;
    clipPathType: string;
    stackIndex: number;
    getBoundingRect: { left: number; top: number; width: number; height: number };
    aCoords: Record<string, { x: number; y: number }> | null;
    oCoords: Record<string, { x: number; y: number }> | null;
    calcTransformMatrix: number[] | null;
    coversFullPage: boolean;
    partialPageWarning: string | null;
  };
};

const milestoneSnapshots = new Map<string, PageBgGeometrySnapshot>();

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

function roundCoords(
  coords: Record<string, { x: number; y: number }> | undefined | null,
): Record<string, { x: number; y: number }> | null {
  if (!coords) return null;
  const out: Record<string, { x: number; y: number }> = {};
  for (const [k, v] of Object.entries(coords)) {
    out[k] = { x: round(v.x), y: round(v.y) };
  }
  return out;
}

function fillOf(obj: FabricObject): string {
  const f = (obj as FabricObject & { fill?: unknown }).fill;
  if (typeof f === 'string') return f;
  return f != null ? String(f) : '';
}

function findPageBgObjects(canvas: Canvas): FabricObject[] {
  return canvas
    .getObjects()
    .filter((o) => (o as FabricObject & { pbKind?: string }).pbKind === 'page-bg');
}

export function isPageBgGeomLogEnabled(): boolean {
  return !!(
    typeof globalThis !== 'undefined' &&
    (globalThis as typeof globalThis & { __PB_PAGE_BG_GEOM_LOG__?: boolean }).__PB_PAGE_BG_GEOM_LOG__
  );
}

export function snapshotPageBgGeometry(canvas: Canvas, label = 'snapshot'): PageBgGeometrySnapshot {
  const pageBgs = findPageBgObjects(canvas);
  const bg = pageBgs[0] ?? null;

  if (bg) {
    bg.setCoords();
  }

  const vt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
  const snap: PageBgGeometrySnapshot = {
    label,
    ts: Date.now(),
    found: !!bg,
    pageBgCount: pageBgs.length,
    canvas: {
      width: canvas.width ?? 0,
      height: canvas.height ?? 0,
      clipPath: !!canvas.clipPath,
      viewportTransform: vt.map(round),
      backgroundColor: String(canvas.backgroundColor ?? ''),
    },
    pageBg: null,
  };

  if (!bg) return snap;

  const b = bg.getBoundingRect();
  const tagged = bg as FabricObject & {
    aCoords?: Record<string, { x: number; y: number }>;
    oCoords?: Record<string, { x: number; y: number }>;
    calcTransformMatrix?: () => number[];
    clipPath?: { type?: string };
  };

  let matrix: number[] | null = null;
  try {
    matrix = tagged.calcTransformMatrix?.().map(round) ?? null;
  } catch {
    matrix = null;
  }

  const coversFullPage =
    round(b.left) <= 0 &&
    round(b.top) <= 0 &&
    round(b.left + b.width) >= PB_PAGE_SIZE_PX &&
    round(b.top + b.height) >= PB_PAGE_SIZE_PX;

  let partialPageWarning: string | null = null;
  if (pageBgs.length > 1) partialPageWarning = `multiple page-bg (${pageBgs.length})`;
  else if (b.width < PB_PAGE_SIZE_PX - 0.5 || b.height < PB_PAGE_SIZE_PX - 0.5) {
    partialPageWarning = `bounding rect smaller than page (${round(b.width)}×${round(b.height)})`;
  } else if (b.left > 0.5 || b.top > 0.5) {
    partialPageWarning = `bounding rect offset (${round(b.left)},${round(b.top)})`;
  } else if (bg.scaleX !== 1 || bg.scaleY !== 1) {
    partialPageWarning = `non-unity scale (${bg.scaleX},${bg.scaleY})`;
  } else if (bg.clipPath) {
    partialPageWarning = 'page-bg has clipPath';
  } else if (canvas.clipPath) {
    partialPageWarning = 'canvas has clipPath';
  }

  const stackIndex = canvas.getObjects().indexOf(bg);

  snap.pageBg = {
    visible: bg.visible !== false,
    fill: fillOf(bg),
    left: round(bg.left ?? 0),
    top: round(bg.top ?? 0),
    width: round(bg.width ?? 0),
    height: round(bg.height ?? 0),
    scaleX: round(bg.scaleX ?? 1),
    scaleY: round(bg.scaleY ?? 1),
    angle: round(bg.angle ?? 0),
    skewX: round(bg.skewX ?? 0),
    skewY: round(bg.skewY ?? 0),
    originX: String(bg.originX ?? 'left'),
    originY: String(bg.originY ?? 'top'),
    dirty: !!bg.dirty,
    objectCaching: !!(bg as FabricObject & { objectCaching?: boolean }).objectCaching,
    hasClipPath: !!bg.clipPath,
    clipPathType: bg.clipPath ? String(tagged.clipPath?.type ?? 'yes') : '',
    stackIndex,
    getBoundingRect: {
      left: round(b.left),
      top: round(b.top),
      width: round(b.width),
      height: round(b.height),
    },
    aCoords: roundCoords(tagged.aCoords),
    oCoords: roundCoords(tagged.oCoords),
    calcTransformMatrix: matrix,
    coversFullPage,
    partialPageWarning,
  };

  return snap;
}

export function diffPageBgSnapshots(
  a: PageBgGeometrySnapshot,
  b: PageBgGeometrySnapshot,
): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  if (a.pageBgCount !== b.pageBgCount) diff.pageBgCount = { from: a.pageBgCount, to: b.pageBgCount };
  if (a.canvas.width !== b.canvas.width) diff['canvas.width'] = { from: a.canvas.width, to: b.canvas.width };
  if (a.canvas.height !== b.canvas.height) diff['canvas.height'] = { from: a.canvas.height, to: b.canvas.height };
  if (JSON.stringify(a.canvas.viewportTransform) !== JSON.stringify(b.canvas.viewportTransform)) {
    diff.viewportTransform = { from: a.canvas.viewportTransform, to: b.canvas.viewportTransform };
  }
  if (!!a.canvas.clipPath !== !!b.canvas.clipPath) {
    diff['canvas.clipPath'] = { from: a.canvas.clipPath, to: b.canvas.clipPath };
  }

  if (!a.pageBg && b.pageBg) diff.pageBg = 'appeared';
  if (a.pageBg && !b.pageBg) diff.pageBg = 'removed';
  if (!a.pageBg || !b.pageBg) return diff;

  const keys: Array<keyof NonNullable<PageBgGeometrySnapshot['pageBg']>> = [
    'visible',
    'fill',
    'left',
    'top',
    'width',
    'height',
    'scaleX',
    'scaleY',
    'angle',
    'skewX',
    'skewY',
    'stackIndex',
    'hasClipPath',
    'dirty',
    'objectCaching',
    'coversFullPage',
  ];
  for (const k of keys) {
    if (a.pageBg[k] !== b.pageBg[k]) diff[`pageBg.${k}`] = { from: a.pageBg[k], to: b.pageBg[k] };
  }
  if (JSON.stringify(a.pageBg.getBoundingRect) !== JSON.stringify(b.pageBg.getBoundingRect)) {
    diff.getBoundingRect = { from: a.pageBg.getBoundingRect, to: b.pageBg.getBoundingRect };
  }
  if (JSON.stringify(a.pageBg.calcTransformMatrix) !== JSON.stringify(b.pageBg.calcTransformMatrix)) {
    diff.calcTransformMatrix = { from: a.pageBg.calcTransformMatrix, to: b.pageBg.calcTransformMatrix };
  }
  if (JSON.stringify(a.pageBg.aCoords) !== JSON.stringify(b.pageBg.aCoords)) {
    diff.aCoords = { from: a.pageBg.aCoords, to: b.pageBg.aCoords };
  }
  return diff;
}

export function logPageBgGeometry(canvas: Canvas, label: string) {
  const snap = snapshotPageBgGeometry(canvas, label);
  milestoneSnapshots.set(label.replace(/\s*\(.*\)$/, ''), snap);

  console.group(`[page-bg geom] ${label}`);
  console.log('pageBgCount:', snap.pageBgCount, 'found:', snap.found);
  console.log('canvas:', snap.canvas);
  if (snap.pageBg) {
    console.log('page-bg:', snap.pageBg);
    if (snap.pageBg.partialPageWarning) {
      console.warn('partial-page:', snap.pageBg.partialPageWarning);
    }
  } else {
    console.warn('no page-bg on canvas');
  }
  console.groupEnd();
  return snap;
}

export function comparePageBgMilestones(
  fromLabel: string,
  toLabel: string,
): Record<string, unknown> | null {
  const a = milestoneSnapshots.get(fromLabel);
  const b = milestoneSnapshots.get(toLabel);
  if (!a || !b) {
    console.warn('[page-bg geom] missing milestone', { fromLabel, toLabel, have: [...milestoneSnapshots.keys()] });
    return null;
  }
  const diff = diffPageBgSnapshots(a, b);
  console.log(`[page-bg geom] diff ${fromLabel} → ${toLabel}`, diff);
  return diff;
}

export function setPageBgVisible(canvas: Canvas, visible: boolean): boolean {
  const bgs = findPageBgObjects(canvas);
  if (!bgs.length) {
    console.warn('[page-bg geom] no page-bg to toggle');
    return false;
  }
  bgs.forEach((bg) => {
    bg.visible = visible;
    bg.dirty = true;
  });
  canvas.requestRenderAll();
  canvas.renderAll();
  console.log(`[page-bg geom] page-bg visible=${visible} (${bgs.length} object(s))`);
  return true;
}

declare global {
  // eslint-disable-next-line no-var
  var __PB_PAGE_BG_GEOM_LOG__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __PB_PAGE_BG_GEOM__: ((label?: string) => PageBgGeometrySnapshot | null) | undefined;
  // eslint-disable-next-line no-var
  var __PB_HIDE_PAGE_BG__: (() => boolean) | undefined;
  // eslint-disable-next-line no-var
  var __PB_SHOW_PAGE_BG__: (() => boolean) | undefined;
  // eslint-disable-next-line no-var
  var __PB_PAGE_BG_GEOM_DIFF__: ((from: string, to: string) => Record<string, unknown> | null) | undefined;
  // eslint-disable-next-line no-var
  var __PB_PAGE_BG_GEOM_MILESTONES__: (() => string[]) | undefined;
}

export function installPageBgGeometryGlobals() {
  if (typeof globalThis === 'undefined') return;

  globalThis.__PB_PAGE_BG_GEOM__ = (label = 'manual') => {
    const canvas = resolveActivePbFabricCanvas();
    if (!canvas) {
      console.warn('[page-bg geom] no active canvas — set __PB_PROBE_PAGE_ID__ or focus a page');
      return null;
    }
    return logPageBgGeometry(canvas, label);
  };

  globalThis.__PB_HIDE_PAGE_BG__ = () => {
    const canvas = resolveActivePbFabricCanvas();
    if (!canvas) return false;
    return setPageBgVisible(canvas, false);
  };

  globalThis.__PB_SHOW_PAGE_BG__ = () => {
    const canvas = resolveActivePbFabricCanvas();
    if (!canvas) return false;
    return setPageBgVisible(canvas, true);
  };

  globalThis.__PB_PAGE_BG_GEOM_DIFF__ = comparePageBgMilestones;
  globalThis.__PB_PAGE_BG_GEOM_MILESTONES__ = () => [...milestoneSnapshots.keys()];
}

installPageBgGeometryGlobals();
