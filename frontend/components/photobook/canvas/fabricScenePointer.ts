import type { Canvas } from './types';

export type ScenePoint = { x: number; y: number };

type PointerLike = Event | { clientX: number; clientY: number };

/** Fabric scene coordinates for object selection only. */
export function getFabricScenePointer(canvas: Canvas, event: PointerLike): ScenePoint {
  canvas.calcOffset();
  const pt = canvas.getScenePoint(event as Parameters<Canvas['getScenePoint']>[0]);
  return { x: pt.x, y: pt.y };
}

export function normalizeSceneRect(start: ScenePoint, current: ScenePoint) {
  const left = Math.min(start.x, current.x);
  const top = Math.min(start.y, current.y);
  return {
    left,
    top,
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}
