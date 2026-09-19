import { ActiveSelection } from 'fabric';
import { isChromeObject } from './chrome';
import { PB_CROP_OVERLAY_NAME, PB_VIEW_PAD_PX } from './constants';
import { isFrameImage, isImageFrame } from './frameMeta';
import type { Canvas, FabricObject } from './types';
import { applyActiveSelectionChrome } from './controls';
import { normalizeSceneRect, type ScenePoint } from './fabricScenePointer';

export type SceneRect = { left: number; top: number; width: number; height: number };

function isCropOverlay(obj: FabricObject): boolean {
  return (obj as FabricObject & { name?: string }).name === PB_CROP_OVERLAY_NAME;
}

function isSelectableUserObject(obj: FabricObject): boolean {
  if (isChromeObject(obj) || isCropOverlay(obj)) return false;
  // Template layout frames and their photos stay out of marquee / multi-select moves.
  if (isImageFrame(obj) || isFrameImage(obj)) return false;
  return true;
}

export function getPageContentSceneBounds(canvas: Canvas): SceneRect {
  const designW = canvas.getWidth();
  const designH = canvas.getHeight();
  const pad = PB_VIEW_PAD_PX;
  return {
    left: pad,
    top: pad,
    width: Math.max(0, designW - pad * 2),
    height: Math.max(0, designH - pad * 2),
  };
}

function intersectSceneRects(a: SceneRect, b: SceneRect): SceneRect | null {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  const width = right - left;
  const height = bottom - top;
  if (width < 1 || height < 1) return null;
  return { left, top, width, height };
}

function collectObjectsInSceneRect(canvas: Canvas, sceneRect: SceneRect): FabricObject[] {
  if (sceneRect.width < 1 && sceneRect.height < 1) return [];
  return canvas
    .collectObjects(sceneRect, { includeIntersecting: true })
    .filter((obj) => isSelectableUserObject(obj as FabricObject)) as FabricObject[];
}

export function selectObjectsInSceneRect(canvas: Canvas, dragRect: SceneRect) {
  const pageBounds = getPageContentSceneBounds(canvas);
  const testRect = intersectSceneRects(dragRect, pageBounds);

  canvas.discardActiveObject();

  if (!testRect) {
    canvas.requestRenderAll();
    return;
  }

  const selected = collectObjectsInSceneRect(canvas, testRect);

  if (selected.length === 1) {
    canvas.setActiveObject(selected[0]);
  } else if (selected.length > 1) {
    const activeSelection = new ActiveSelection(selected, { canvas });
    applyActiveSelectionChrome(activeSelection);
    canvas.setActiveObject(activeSelection);
  }
  canvas.requestRenderAll();
}

export function finishFabricSelection(
  canvas: Canvas,
  sceneStart: ScenePoint,
  sceneEnd: ScenePoint,
) {
  selectObjectsInSceneRect(canvas, normalizeSceneRect(sceneStart, sceneEnd));
}

const marqueeDragState = {
  activePageId: null as string | null,
  previewObjects: new Set<FabricObject>(),
};

export function isMarqueeDragActive(): boolean {
  return marqueeDragState.activePageId !== null;
}

export function getMarqueeDragPageId(): string | null {
  return marqueeDragState.activePageId;
}

export function getMarqueeDragPreviewObjects(): ReadonlySet<FabricObject> {
  return marqueeDragState.previewObjects;
}

export function beginMarqueeDrag(pageId: string, canvas: Canvas) {
  canvas.calcOffset();
  marqueeDragState.activePageId = pageId;
  marqueeDragState.previewObjects.clear();
  canvas.requestRenderAll();
}

export function updateMarqueeDragPreview(
  pageId: string,
  canvas: Canvas,
  sceneStart: ScenePoint,
  sceneCurrent: ScenePoint,
) {
  marqueeDragState.activePageId = pageId;

  const dragRect = normalizeSceneRect(sceneStart, sceneCurrent);
  if (dragRect.width < 2 && dragRect.height < 2) {
    if (marqueeDragState.previewObjects.size > 0) {
      marqueeDragState.previewObjects.clear();
      canvas.requestRenderAll();
    }
    return;
  }

  const pageBounds = getPageContentSceneBounds(canvas);
  const testRect = intersectSceneRects(dragRect, pageBounds);
  marqueeDragState.previewObjects = testRect
    ? new Set(collectObjectsInSceneRect(canvas, testRect))
    : new Set();
  canvas.requestRenderAll();
}

export function clearMarqueeDragPreview(canvas?: Canvas | null) {
  marqueeDragState.activePageId = null;
  marqueeDragState.previewObjects.clear();
  canvas?.requestRenderAll();
}

function resolveFindTarget(
  canvas: Canvas,
  e: Parameters<Canvas['findTarget']>[0],
): FabricObject | undefined {
  const found = canvas.findTarget(e) as FabricObject | { target?: FabricObject } | null | undefined;
  if (!found) return undefined;
  if (typeof found === 'object' && 'target' in found) {
    return found.target ?? undefined;
  }
  return found as FabricObject;
}

export function horizontalDistanceToRect(clientX: number, rect: DOMRect): number {
  if (clientX < rect.left) return rect.left - clientX;
  if (clientX > rect.right) return clientX - rect.right;
  return 0;
}

export function verticalDistanceToRect(clientY: number, rect: DOMRect): number {
  if (clientY < rect.top) return rect.top - clientY;
  if (clientY > rect.bottom) return clientY - rect.bottom;
  return 0;
}

export type PageCanvasCandidate = { pageId: string; canvas: Canvas };

export function findNearestPageCanvas(
  clientX: number,
  clientY: number,
  candidates: PageCanvasCandidate[],
): PageCanvasCandidate | null {
  let best: PageCanvasCandidate | null = null;
  let bestH = Infinity;
  let bestV = Infinity;

  for (const candidate of candidates) {
    const upper = candidate.canvas.upperCanvasEl;
    if (!upper) continue;
    const rect = upper.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    const hDist = horizontalDistanceToRect(clientX, rect);
    const vDist = verticalDistanceToRect(clientY, rect);

    if (hDist < bestH || (hDist === bestH && vDist < bestV)) {
      bestH = hDist;
      bestV = vDist;
      best = candidate;
    }
  }

  return best;
}

export function isPointerOutsideAllCanvases(
  clientX: number,
  clientY: number,
  canvases: Canvas[],
): boolean {
  return !canvases.some((canvas) => isPointerOverCanvas(canvas, clientX, clientY));
}

export function findCanvasUnderPointer(
  clientX: number,
  clientY: number,
  candidates: PageCanvasCandidate[],
): PageCanvasCandidate | null {
  return candidates.find(({ canvas }) => isPointerOverCanvas(canvas, clientX, clientY)) ?? null;
}

export function isPointerOverCanvas(canvas: Canvas, clientX: number, clientY: number): boolean {
  const upper = canvas.upperCanvasEl;
  if (!upper) return false;
  const rect = upper.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

export function findFabricUserTarget(
  canvas: Canvas,
  e: Parameters<Canvas['findTarget']>[0],
): FabricObject | undefined {
  const obj = resolveFindTarget(canvas, e);
  if (!obj || isChromeObject(obj) || isCropOverlay(obj) || !obj.selectable) return undefined;
  return obj;
}

export function isPointerOnCropOverlay(
  canvas: Canvas,
  e: Parameters<Canvas['findTarget']>[0],
): boolean {
  const obj = resolveFindTarget(canvas, e);
  return !!obj && isCropOverlay(obj);
}

export function hasCropOverlayOnCanvas(canvas: Canvas): boolean {
  return canvas.getObjects().some((obj) => isCropOverlay(obj));
}
