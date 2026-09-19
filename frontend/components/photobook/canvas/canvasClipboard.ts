import { util } from 'fabric';
import type { Canvas, FabricModule, FabricObject } from './types';
import { applyActiveSelectionChrome, isMultiCanvasSelection } from './controls';
import { isChromeObject } from './chrome';
import { PB_CROP_OVERLAY_NAME } from './constants';
import { getPageContentRect } from './types';

type CanvasSpaceSnapshot = {
  centerX: number;
  centerY: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
  flipX: boolean;
  flipY: boolean;
};

type PbFabricClipboard = {
  objects: FabricObject[];
  snapshots: CanvasSpaceSnapshot[];
};

let clipboard: PbFabricClipboard | null = null;

function isCropOverlay(obj: FabricObject): boolean {
  return (obj as FabricObject & { name?: string }).name === PB_CROP_OVERLAY_NAME;
}

function isEditingText(obj: FabricObject): boolean {
  return !!(obj as FabricObject & { isEditing?: boolean }).isEditing;
}

/** Absolute canvas-space transform (works for objects inside ActiveSelection). */
function captureCanvasSpaceState(obj: FabricObject): CanvasSpaceSnapshot {
  const center = obj.getCenterPoint();
  const scale = obj.getObjectScaling();
  const { skewX, skewY } = util.qrDecompose(obj.calcTransformMatrix());
  return {
    centerX: center.x,
    centerY: center.y,
    angle: obj.getTotalAngle(),
    scaleX: scale.x,
    scaleY: scale.y,
    skewX,
    skewY,
    flipX: !!obj.flipX,
    flipY: !!obj.flipY,
  };
}

function applyCanvasSpaceState(obj: FabricObject, state: CanvasSpaceSnapshot) {
  obj.set({
    originX: 'center',
    originY: 'center',
    left: state.centerX,
    top: state.centerY,
    angle: state.angle,
    scaleX: state.scaleX,
    scaleY: state.scaleY,
    skewX: state.skewX,
    skewY: state.skewY,
    flipX: state.flipX,
    flipY: state.flipY,
    group: undefined,
    parent: undefined,
    canvas: undefined,
  } as Record<string, unknown>);
  obj.setCoords();
}

/** Clone with absolute canvas coordinates (required when copying from multi-select). */
async function cloneForClipboard(obj: FabricObject): Promise<{
  clone: FabricObject;
  snapshot: CanvasSpaceSnapshot;
}> {
  const snapshot = captureCanvasSpaceState(obj);
  const clone = await obj.clone();
  applyCanvasSpaceState(clone, snapshot);
  return { clone, snapshot };
}

function getObjectsBounds(objects: FabricObject[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  objects.forEach((obj) => {
    const center = obj.getCenterPoint();
    minX = Math.min(minX, center.x);
    minY = Math.min(minY, center.y);
    maxX = Math.max(maxX, center.x);
    maxY = Math.max(maxY, center.y);
  });

  if (!Number.isFinite(minX)) {
    return null;
  }

  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/** Nudge pasted content into the page if transforms landed outside the artboard. */
function ensurePasteWithinPage(objects: FabricObject[], snapshots: CanvasSpaceSnapshot[]) {
  const bounds = getObjectsBounds(objects);
  if (!bounds) return;

  const page = getPageContentRect();
  const pageRight = page.left + page.width;
  const pageBottom = page.top + page.height;
  const margin = 24;

  const outOfPage =
    bounds.centerX < page.left - margin ||
    bounds.centerX > pageRight + margin ||
    bounds.centerY < page.top - margin ||
    bounds.centerY > pageBottom + margin;

  if (!outOfPage) return;

  const targetCenterX = page.left + page.width / 2;
  const targetCenterY = page.top + page.height / 2;
  const dx = targetCenterX - bounds.centerX;
  const dy = targetCenterY - bounds.centerY;

  objects.forEach((obj, index) => {
    const snapshot = snapshots[index];
    if (!snapshot) return;
    const next = {
      ...snapshot,
      centerX: snapshot.centerX + dx,
      centerY: snapshot.centerY + dy,
    };
    snapshots[index] = next;
    applyCanvasSpaceState(obj, next);
  });
}

export function hasCanvasClipboard(): boolean {
  return !!clipboard?.objects.length;
}

export async function copyCanvasSelection(canvas: Canvas): Promise<boolean> {
  const active = canvas.getActiveObject();
  if (!active || isChromeObject(active) || isCropOverlay(active) || isEditingText(active)) {
    return false;
  }

  if (isMultiCanvasSelection(active)) {
    const objects = active.getObjects();
    if (!objects.length) return false;
    const packed = await Promise.all(objects.map((obj) => cloneForClipboard(obj)));
    clipboard = {
      objects: packed.map((item) => item.clone),
      snapshots: packed.map((item) => item.snapshot),
    };
    return true;
  }

  const snapshot = captureCanvasSpaceState(active);
  const cloned = await active.clone();
  applyCanvasSpaceState(cloned, snapshot);
  clipboard = { objects: [cloned], snapshots: [snapshot] };
  return true;
}

export async function pasteCanvasClipboard(
  canvas: Canvas,
  fabric: FabricModule,
  prepareObject: (obj: FabricObject) => void,
): Promise<FabricObject | null> {
  if (!clipboard?.objects.length) return null;

  canvas.discardActiveObject();

  const snapshots = clipboard.snapshots.map((snapshot) => ({ ...snapshot }));
  const pasted = await Promise.all(
    clipboard.objects.map(async (source, index) => {
      const obj = await source.clone();
      applyCanvasSpaceState(obj, snapshots[index]);
      return obj;
    }),
  );

  ensurePasteWithinPage(pasted, snapshots);

  pasted.forEach((obj) => {
    obj.set({
      evented: true,
      group: undefined,
      parent: undefined,
    } as Record<string, unknown>);
    prepareObject(obj);
    canvas.add(obj);
    obj.setCoords();
  });

  const active =
    pasted.length === 1
      ? pasted[0]
      : new fabric.ActiveSelection(pasted, { canvas });

  if (pasted.length > 1) {
    applyActiveSelectionChrome(active as FabricObject);
  }

  canvas.setActiveObject(active);
  canvas.requestRenderAll();
  return active;
}
