import type { Canvas, FabricObject } from './types';
import { isChromeObject } from './chrome';

export type PbObjectGeomSnapshot = {
  type: string;
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  originX?: string;
  originY?: string;
};

export function isPbZoomProbeEnabled(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    !!(globalThis as typeof globalThis & { __PB_ZOOM_PROBE__?: boolean }).__PB_ZOOM_PROBE__
  );
}

export function snapshotUserObjectGeometry(canvas: Canvas): PbObjectGeomSnapshot[] {
  return canvas
    .getObjects()
    .filter((obj) => !isChromeObject(obj))
    .map((obj) => {
      const o = obj as FabricObject;
      return {
        type: String(o.type ?? 'unknown'),
        left: o.left ?? 0,
        top: o.top ?? 0,
        scaleX: o.scaleX ?? 1,
        scaleY: o.scaleY ?? 1,
        angle: o.angle ?? 0,
        originX: (o as FabricObject & { originX?: string }).originX,
        originY: (o as FabricObject & { originY?: string }).originY,
      };
    });
}

export function logPbZoomProbe(
  canvas: Canvas,
  phase: 'before' | 'after',
  meta: { layoutScale: number; cssPx: number; hostW: number; zoom: number },
) {
  if (!isPbZoomProbeEnabled()) return;
  const active = canvas.getActiveObject() as FabricObject | undefined;
  const vpt = canvas.viewportTransform;
  console.groupCollapsed(
    `[pb-zoom-probe] ${phase} sync | hostW=${meta.hostW} layoutScale=${meta.layoutScale.toFixed(4)} cssPx=${meta.cssPx} canvas.getZoom()=${meta.zoom.toFixed(4)}`,
  );
  if (active && !isChromeObject(active)) {
    console.log('active object', {
      left: active.left,
      top: active.top,
      scaleX: active.scaleX,
      scaleY: active.scaleY,
      angle: active.angle,
      originX: (active as FabricObject & { originX?: string }).originX,
      originY: (active as FabricObject & { originY?: string }).originY,
    });
    const bound = active.getBoundingRect();
    console.log('active getBoundingRect() (canvas space)', bound);
  } else {
    console.log('no active user object');
  }
  console.log('viewportTransform', vpt ? [...vpt] : null);
  if (phase === 'after' && Math.abs(meta.zoom - 1) > 0.001) {
    console.warn('[pb-zoom-probe] expected canvas.getZoom() === 1 (DOM-only zoom)');
  }
  console.table(snapshotUserObjectGeometry(canvas));
  console.groupEnd();
}
