import type { Canvas, FabricObject } from './types';
import { isChromeObject } from './chrome';
import { PB_CROP_OVERLAY_NAME } from './constants';
import { drawPbLineHoverOutline, isPbLineObject } from './customLines';

export const PB_HOVER_STROKE = 'rgba(255, 30, 104, 0.55)';
export const PB_HOVER_WIDTH = 1.5;

type Hoverable = FabricObject & {
  _pbHoverSaved?: { stroke?: string | null; strokeWidth?: number };
};

/** Remove legacy hover that mutated object stroke (caused IText ghost boxes). */
export function clearLegacyHoverStroke(obj: FabricObject) {
  const target = obj as Hoverable;
  const saved = target._pbHoverSaved;
  if (!saved) return;
  target.set({
    stroke: saved.stroke,
    strokeWidth: saved.strokeWidth,
  });
  delete target._pbHoverSaved;
}

export function canShowHoverOutline(obj: FabricObject): boolean {
  if (isChromeObject(obj)) return false;
  if ((obj as FabricObject & { name?: string }).name === PB_CROP_OVERLAY_NAME) return false;
  return true;
}

type ObjectCornerCoords = {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  br: { x: number; y: number };
  bl: { x: number; y: number };
};

function getObjectCornerCoords(obj: FabricObject): ObjectCornerCoords | null {
  obj.setCoords();
  const coords = (obj as FabricObject & { oCoords?: ObjectCornerCoords }).oCoords;
  if (!coords?.tl || !coords.tr || !coords.br || !coords.bl) return null;
  return coords;
}

/**
 * Thin Canva-style hover outline on the main canvas (after:render ctx).
 * Must not use contextTop — Fabric clears it outside renderTop().
 * Uses oriented corners (oCoords) so rotated objects match the selection box.
 */
export function drawHoverOutline(ctx: CanvasRenderingContext2D, obj: FabricObject) {
  if (isPbLineObject(obj)) {
    drawPbLineHoverOutline(ctx, obj);
    return;
  }

  const coords = getObjectCornerCoords(obj);
  ctx.save();
  ctx.strokeStyle = PB_HOVER_STROKE;
  ctx.lineWidth = PB_HOVER_WIDTH;
  ctx.setLineDash([]);

  if (coords) {
    ctx.beginPath();
    ctx.moveTo(coords.tl.x, coords.tl.y);
    ctx.lineTo(coords.tr.x, coords.tr.y);
    ctx.lineTo(coords.br.x, coords.br.y);
    ctx.lineTo(coords.bl.x, coords.bl.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    return;
  }

  const bound = obj.getBoundingRect();
  ctx.strokeRect(bound.left + 0.5, bound.top + 0.5, Math.max(0, bound.width - 1), Math.max(0, bound.height - 1));
  ctx.restore();
}

export function resolveHoverTarget(
  canvas: Canvas,
  e: Parameters<Canvas['findTarget']>[0],
): FabricObject | null {
  if (canvas.skipTargetFind) return null;
  const found = canvas.findTarget(e);
  const target = found?.target;
  if (!target || !canShowHoverOutline(target)) return null;
  if (canvas.getActiveObject() === target) return null;
  return target;
}
