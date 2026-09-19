import type { Canvas, FabricModule, FabricObject } from './types';
import { isChromeObject, sendPageBackgroundToBack, syncPageChrome, type PbPageDimensions } from './chrome';
import { syncCanvasDisplayScale } from './displayScale';
import { isPageBgGeomLogEnabled, logPageBgGeometry } from './pbPageBgGeometry';
import { refreshTextObjectGeometry } from './textLayout';
import { isTextObject } from './textStyle';

export function isSelectionStackLogEnabled(): boolean {
  return !!(
    typeof globalThis !== 'undefined' &&
    (globalThis as typeof globalThis & { __PB_SELECTION_STACK_LOG__?: boolean })
      .__PB_SELECTION_STACK_LOG__
  );
}

function fillOf(obj: FabricObject | undefined): string {
  if (!obj) return '';
  const f = (obj as FabricObject & { fill?: unknown }).fill;
  if (typeof f === 'string') return f;
  return f != null ? String(f) : '';
}

/** Log stack order, active object, page-bg bounds/fill, clipPath (enable with __PB_SELECTION_STACK_LOG__). */
export function logSelectionCanvasState(canvas: Canvas, label: string) {
  if (!isSelectionStackLogEnabled()) return;

  const objects = canvas.getObjects();
  const order = objects.map((o, i) => {
    const t = o as FabricObject & { pbKind?: string };
    return `${i}:${t.type}:${t.pbKind ?? '-'}`;
  });
  const bg = objects.find((o) => (o as FabricObject & { pbKind?: string }).pbKind === 'page-bg');
  const active = canvas.getActiveObject();
  const b = bg?.getBoundingRect();

  console.group(`[pb-selection] ${label}`);
  console.log('getObjects order:', order.join(' | '));
  console.log(
    'activeObject:',
    active
      ? `${active.type} pbKind=${(active as FabricObject & { pbKind?: string }).pbKind ?? '-'}`
      : null,
  );
  if (bg) {
    console.log('page-bg', {
      fill: fillOf(bg),
      left: bg.left,
      top: bg.top,
      width: bg.width,
      height: bg.height,
      bound: b ? { left: b.left, top: b.top, w: b.width, h: b.height } : null,
      clipPath: !!bg.clipPath,
      dirty: bg.dirty,
    });
  }
  console.log('canvas.clipPath:', !!canvas.clipPath);
  objects.forEach((o, i) => {
    if ((o as FabricObject & { pbKind?: string }).pbKind === 'page-bg') return;
    console.log(`  [${i}] clipPath=${!!o.clipPath} dirty=${o.dirty} visible=${o.visible}`);
  });
  console.groupEnd();
}

/**
 * Full lower-canvas repaint after selection / lock chrome changes.
 * Marks all objects dirty, keeps page-bg at back, syncs fill, then synchronous renderAll.
 */
function pageBgGeomLabel(logLabel?: string, phase: 'before' | 'after' = 'before'): string | null {
  if (!logLabel) return null;
  // before-lock is logged in toggleLockActive before applyLockToObject runs.
  if (logLabel === 'lock') return phase === 'after' ? 'after-lock' : null;
  if (logLabel === 'unlock') return phase === 'after' ? 'after-unlock' : null;
  if (logLabel === 'selection:cleared') {
    return phase === 'before' ? 'before-deselect' : 'after-deselect';
  }
  return `${logLabel} (${phase} flush)`;
}

export type PbSelectionFlushOptions = {
  hostEl?: HTMLElement | null;
  displayScale?: number;
  rebakeText?: boolean;
  logLabel?: string;
};

function clearFabricOverlayContexts(canvas: Canvas) {
  const lowerCtx = canvas.getContext();
  if (lowerCtx) canvas.clearContext(lowerCtx);
  if (canvas.contextTop) {
    canvas.clearContext(canvas.contextTop);
    const top = canvas as Canvas & { contextTopDirty?: boolean };
    if (top.contextTopDirty !== undefined) top.contextTopDirty = true;
  }
}

export function flushCanvasAfterSelectionChange(
  canvas: Canvas,
  fabric: FabricModule,
  pageBackgroundColor: string,
  pad: number,
  page: PbPageDimensions,
  opts?: PbSelectionFlushOptions,
) {
  const logLabel = opts?.logLabel;
  const displayScale = opts?.displayScale ?? 1;
  const hostEl = opts?.hostEl;

  if (logLabel) logSelectionCanvasState(canvas, `${logLabel} (before flush)`);
  if (isPageBgGeomLogEnabled()) {
    const geomLabel = pageBgGeomLabel(logLabel, 'before');
    if (geomLabel) logPageBgGeometry(canvas, geomLabel);
  }

  if (hostEl) {
    syncCanvasDisplayScale(canvas, displayScale, hostEl, pad, page);
  }

  syncPageChrome(canvas, fabric, pageBackgroundColor, pad, page);
  sendPageBackgroundToBack(canvas);

  canvas.getObjects().forEach((obj) => {
    if (opts?.rebakeText && isTextObject(obj)) {
      refreshTextObjectGeometry(obj);
    }
    obj.dirty = true;
  });

  canvas.calcOffset();
  clearFabricOverlayContexts(canvas);
  canvas.requestRenderAll();
  canvas.renderAll();

  if (hostEl) {
    syncCanvasDisplayScale(canvas, displayScale, hostEl, pad, page);
  }

  if (logLabel) logSelectionCanvasState(canvas, `${logLabel} (after flush)`);
  if (isPageBgGeomLogEnabled()) {
    const geomLabel = pageBgGeomLabel(logLabel, 'after');
    if (geomLabel) logPageBgGeometry(canvas, geomLabel);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __PB_SELECTION_STACK_LOG__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __PB_FLUSH_SELECTION_CANVAS__: typeof flushCanvasAfterSelectionChange | undefined;
}

export function installSelectionRenderGlobals() {
  if (typeof globalThis === 'undefined') return;
  globalThis.__PB_FLUSH_SELECTION_CANVAS__ = flushCanvasAfterSelectionChange;
}

installSelectionRenderGlobals();
