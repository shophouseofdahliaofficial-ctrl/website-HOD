import type { FabricObject } from './types';
import { PB_PAGE_SIZE_PX } from './constants';
import type { PbPageDimensions } from './chrome';

export const PB_ALIGN_SNAP_THRESHOLD_PX = 5;

export type PbAlignGuideVisibility = {
  vertical: boolean;
  horizontal: boolean;
};

export type PbAlignSnapResult = PbAlignGuideVisibility & {
  deltaX: number;
  deltaY: number;
};

export function getPageCenter(
  pad: number,
  page: PbPageDimensions = { widthPx: PB_PAGE_SIZE_PX, heightPx: PB_PAGE_SIZE_PX },
) {
  return {
    x: pad + page.widthPx / 2,
    y: pad + page.heightPx / 2,
  };
}

export function computeCenterAlignSnap(
  obj: FabricObject,
  pad: number,
  page: PbPageDimensions = { widthPx: PB_PAGE_SIZE_PX, heightPx: PB_PAGE_SIZE_PX },
): PbAlignSnapResult {
  const centerPoint = getPageCenter(pad, page);
  const rect = obj.getBoundingRect();
  const center = obj.getCenterPoint();
  const rectRight = rect.left + rect.width;
  const rectBottom = rect.top + rect.height;

  const dCenterX = centerPoint.x - center.x;
  const dLeftX = centerPoint.x - rect.left;
  const dRightX = centerPoint.x - rectRight;
  const dCenterY = centerPoint.y - center.y;
  const dTopY = centerPoint.y - rect.top;
  const dBottomY = centerPoint.y - rectBottom;

  let vertical = false;
  let deltaX = 0;
  if (Math.abs(dCenterX) < PB_ALIGN_SNAP_THRESHOLD_PX) {
    vertical = true;
    deltaX = dCenterX;
  } else if (Math.abs(dLeftX) < PB_ALIGN_SNAP_THRESHOLD_PX) {
    vertical = true;
    deltaX = dLeftX;
  } else if (Math.abs(dRightX) < PB_ALIGN_SNAP_THRESHOLD_PX) {
    vertical = true;
    deltaX = dRightX;
  }

  let horizontal = false;
  let deltaY = 0;
  if (Math.abs(dCenterY) < PB_ALIGN_SNAP_THRESHOLD_PX) {
    horizontal = true;
    deltaY = dCenterY;
  } else if (Math.abs(dTopY) < PB_ALIGN_SNAP_THRESHOLD_PX) {
    horizontal = true;
    deltaY = dTopY;
  } else if (Math.abs(dBottomY) < PB_ALIGN_SNAP_THRESHOLD_PX) {
    horizontal = true;
    deltaY = dBottomY;
  }

  return {
    vertical,
    horizontal,
    deltaX: vertical ? deltaX : 0,
    deltaY: horizontal ? deltaY : 0,
  };
}

export function applyCenterAlignSnap(obj: FabricObject, snap: PbAlignSnapResult) {
  if (!snap.deltaX && !snap.deltaY) return;
  obj.set({
    left: (obj.left ?? 0) + snap.deltaX,
    top: (obj.top ?? 0) + snap.deltaY,
  });
  obj.setCoords();
}

export function drawCenterAlignGuides(
  ctx: CanvasRenderingContext2D,
  pad: number,
  visibility: PbAlignGuideVisibility,
  page: PbPageDimensions = { widthPx: PB_PAGE_SIZE_PX, heightPx: PB_PAGE_SIZE_PX },
) {
  if (!visibility.vertical && !visibility.horizontal) return;
  const cx = pad + page.widthPx / 2;
  const cy = pad + page.heightPx / 2;
  const left = pad;
  const top = pad;
  const right = pad + page.widthPx;
  const bottom = pad + page.heightPx;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 30, 104, 0.95)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 7]);

  if (visibility.vertical) {
    ctx.beginPath();
    ctx.moveTo(cx + 0.5, top);
    ctx.lineTo(cx + 0.5, bottom);
    ctx.stroke();
  }
  if (visibility.horizontal) {
    ctx.beginPath();
    ctx.moveTo(left, cy + 0.5);
    ctx.lineTo(right, cy + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}
