import type { Canvas, FabricObject } from './types';
import type { PbCanvasPageApi } from './api';
import {
  clearRebakeTrace,
  reportRebakeTrace,
  type PbRebakeTraceReport,
} from './pbRebakeTrace';
import { refreshTextObjectGeometry } from './textLayout';
import { isTextObject } from './textStyle';

export type PbLockProbeObjectSnapshot = {
  left: number | undefined;
  top: number | undefined;
  width: number | undefined;
  height: number | undefined;
  scaleX: number | undefined;
  scaleY: number | undefined;
  objectCaching: boolean | undefined;
  dirty: boolean | undefined;
  isEditing: boolean | undefined;
  clipPath: boolean;
  cacheCanvasW: number | null;
  cacheCanvasH: number | null;
  boundW: number;
  boundH: number;
};

export type PbLockProbeRunResult = {
  report: Pick<
    PbRebakeTraceReport,
    'executed' | 'notExecuted' | 'lockCycles' | 'renderAllRan' | 'renderAllCallCount'
  >;
  broken: PbLockProbeObjectSnapshot | null;
  fixed: PbLockProbeObjectSnapshot | null;
  firstDiff: Record<string, { broken: unknown; fixed: unknown }>;
  error?: string;
};

export function snapshotProbeObject(obj: FabricObject | null | undefined): PbLockProbeObjectSnapshot | null {
  if (!obj) return null;
  const text = obj as FabricObject & { isEditing?: boolean; _cacheCanvas?: HTMLCanvasElement };
  const bound = obj.getBoundingRect();
  return {
    left: obj.left,
    top: obj.top,
    width: obj.width,
    height: obj.height,
    scaleX: obj.scaleX,
    scaleY: obj.scaleY,
    objectCaching: obj.objectCaching,
    dirty: obj.dirty,
    isEditing: text.isEditing ?? false,
    clipPath: !!obj.clipPath,
    cacheCanvasW: text._cacheCanvas?.width ?? null,
    cacheCanvasH: text._cacheCanvas?.height ?? null,
    boundW: Math.round(bound.width * 1000) / 1000,
    boundH: Math.round(bound.height * 1000) / 1000,
  };
}

function diffSnapshots(
  a: PbLockProbeObjectSnapshot,
  b: PbLockProbeObjectSnapshot,
): Record<string, { broken: unknown; fixed: unknown }> {
  const out: Record<string, { broken: unknown; fixed: unknown }> = {};
  for (const k of Object.keys(a) as (keyof PbLockProbeObjectSnapshot)[]) {
    if (a[k] !== b[k]) out[k] = { broken: a[k], fixed: b[k] };
  }
  return out;
}

function waitFrames(n = 2): Promise<void> {
  return new Promise((resolve) => {
    let left = n;
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export async function runLockRebakeProbe(
  api: PbCanvasPageApi,
  getCanvas: () => Canvas | null,
): Promise<PbLockProbeRunResult> {
  const canvas = getCanvas();
  if (!canvas) return { report: emptyReport(), broken: null, fixed: null, firstDiff: {}, error: 'no canvas' };

  globalThis.__PB_REBAKE_TRACE__ = true;
  clearRebakeTrace();

  await api.addTextPreset('heading');
  await waitFrames(3);

  const lockedOk = api.toggleLockActiveObject();
  if (!lockedOk) {
    return {
      report: emptyReport(),
      broken: null,
      fixed: null,
      firstDiff: {},
      error: 'toggleLock lock failed',
    };
  }
  await waitFrames(2);

  const unlockedOk = api.toggleLockActiveObject();
  if (!unlockedOk) {
    return {
      report: emptyReport(),
      broken: null,
      fixed: null,
      firstDiff: {},
      error: 'toggleLock unlock failed',
    };
  }
  await waitFrames(2);

  const broken = snapshotProbeObject(canvas.getActiveObject());
  const fullReport = reportRebakeTrace();
  const report = {
    executed: fullReport.executed,
    notExecuted: fullReport.notExecuted,
    lockCycles: fullReport.lockCycles,
    renderAllRan: fullReport.renderAllRan,
    renderAllCallCount: fullReport.renderAllCallCount,
  };

  const active = canvas.getActiveObject();
  if (active) {
    active.set({ left: (active.left ?? 0) + 1 });
    active.setCoords();
    if (isTextObject(active)) refreshTextObjectGeometry(active);
    canvas.fire('object:modified', { target: active });
    canvas.requestRenderAll();
    canvas.renderAll();
  }
  await waitFrames(2);

  const fixed = snapshotProbeObject(canvas.getActiveObject());
  const firstDiff =
    broken && fixed ? diffSnapshots(broken, fixed) : {};

  return { report, broken, fixed, firstDiff };
}

function emptyReport(): PbLockProbeRunResult['report'] {
  return {
    executed: [],
    notExecuted: [],
    lockCycles: [],
    renderAllRan: false,
    renderAllCallCount: 0,
  };
}
