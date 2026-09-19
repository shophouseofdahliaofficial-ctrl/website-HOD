import type { Canvas, FabricObject } from './types';
import { isChromeObject } from './chrome';
import { PB_CROP_OVERLAY_NAME } from './constants';

export function isDrawCanvasObject(obj: FabricObject): boolean {
  return (obj as FabricObject & { pbKind?: string }).pbKind === 'draw';
}

export function eraserHitsDrawObject(
  obj: FabricObject,
  point: { x: number; y: number },
  radius: number,
): boolean {
  if (typeof obj.containsPoint === 'function') {
    try {
      if (obj.containsPoint(point as Parameters<typeof obj.containsPoint>[0])) {
        return true;
      }
    } catch {
      // Fall through to bbox distance test.
    }
  }

  const rect = obj.getBoundingRect();
  const closestX = Math.max(rect.left, Math.min(point.x, rect.left + rect.width));
  const closestY = Math.max(rect.top, Math.min(point.y, rect.top + rect.height));
  const dx = point.x - closestX;
  const dy = point.y - closestY;
  const hitRadius = radius + Math.max(2, (obj as FabricObject & { strokeWidth?: number }).strokeWidth ?? 0) / 2;
  return dx * dx + dy * dy <= hitRadius * hitRadius;
}

/** Remove every drawing stroke touched by the eraser circle. */
export function eraseDrawObjectsAtPoint(
  canvas: Canvas,
  point: { x: number; y: number },
  radius: number,
): FabricObject[] {
  const removed: FabricObject[] = [];
  canvas.getObjects().forEach((obj) => {
    if (isChromeObject(obj)) return;
    if ((obj as FabricObject & { name?: string }).name === PB_CROP_OVERLAY_NAME) return;
    if (!isDrawCanvasObject(obj)) return;
    if (!eraserHitsDrawObject(obj, point, radius)) return;
    canvas.remove(obj);
    removed.push(obj);
  });
  return removed;
}
