import { Control, controlsUtils } from 'fabric';
import type { ControlRenderingStyleOverride } from 'fabric';
import type { FabricObject } from './types';
import { isTextObject } from './textStyle';

const PB_PURPLE = '#5b21b6';
const PB_PURPLE_DARK = '#1e1b4b';
/** Hot pink — multi-select group border (Fabric default is dull blue rgb(178,204,255)). */
export const PB_DARK_PINK = '#ff1e68';

/** Target on-screen control sizes (px); design units scale inversely with DOM zoom. */
const PB_CORNER_SCREEN_PX = 11;
const PB_MULTI_SELECT_CORNER_SCREEN_PX = 18;
const PB_ROTATE_CONTROL_SCREEN_PX = 18;
const PB_ROTATE_OFFSET_SCREEN_PX = 40;
const PB_LINE_CORNER_SCREEN_PX = 20;
const PB_OBJECT_PADDING_SCREEN_PX = 4;

/** Convert a screen-pixel target into Fabric design units for the current DOM zoom. */
export function zoomControlUnits(screenPx: number, domZoom: number): number {
  return Math.max(3, Math.round(screenPx / Math.max(domZoom, 0.25)));
}

/** Read DOM stack zoom from the canvas page unit (for render-time sizing). */
export function readPbStackZoomFromCanvas(
  canvas: { upperCanvasEl?: HTMLElement | null } | null | undefined,
): number {
  const unit = canvas?.upperCanvasEl?.closest<HTMLElement>('[class*="pbCanvasPageUnit"]');
  if (!unit) return 1;
  const raw = getComputedStyle(unit).getPropertyValue('--pb-stack-zoom').trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

const {
  createObjectDefaultControls,
  rotationWithSnapping,
  rotationStyleHandler,
} = controlsUtils;

type FabricInteractive = FabricObject & {
  controls?: Record<string, Control>;
  cornerStyle?: string;
};

function renderCropBar(
  this: Control,
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  _styleOverride: ControlRenderingStyleOverride,
  fabricObject: FabricObject,
) {
  const long = 20;
  const thick = 4;
  const x = this.x;
  const y = this.y;
  const isCorner = Math.abs(x) === 0.5 && Math.abs(y) === 0.5;
  const isTop = y === -0.5;
  const isBottom = y === 0.5;
  const isLeft = x === -0.5;
  const isRight = x === 0.5;

  ctx.save();
  ctx.translate(left, top);
  const angle = ((fabricObject.angle ?? 0) * Math.PI) / 180;
  ctx.rotate(angle);
  ctx.fillStyle = PB_PURPLE;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;

  const fillBar = (w: number, h: number, ox: number, oy: number) => {
    ctx.fillRect(ox - w / 2, oy - h / 2, w, h);
    ctx.strokeRect(ox - w / 2, oy - h / 2, w, h);
  };

  if (isCorner) {
    const signX = x < 0 ? -1 : 1;
    const signY = y < 0 ? -1 : 1;
    fillBar(long, thick, signX * (long / 2 - thick / 2), 0);
    fillBar(thick, long, 0, signY * (long / 2 - thick / 2));
  } else if (isTop || isBottom) {
    fillBar(long, thick, 0, 0);
  } else if (isLeft || isRight) {
    fillBar(thick, long, 0, 0);
  }

  ctx.restore();
}

function withCropBarRender(control: Control): Control {
  control.render = renderCropBar;
  control.sizeX = 24;
  control.sizeY = 24;
  control.touchSizeX = 28;
  control.touchSizeY = 28;
  return control;
}

function renderRotateIcon(
  this: Control,
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  _styleOverride: ControlRenderingStyleOverride,
  _fabricObject: FabricObject,
) {
  const size = this.sizeX || 18;
  const radius = size / 2;

  ctx.save();
  ctx.translate(left, top);

  // Draw white background circle
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = PB_PURPLE;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Draw curved arrows representing rotation
  ctx.strokeStyle = PB_PURPLE;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';

  // First curved arc
  ctx.beginPath();
  ctx.arc(0, 0, radius - 4.5, -Math.PI * 0.1, Math.PI * 0.6);
  ctx.stroke();

  // Second curved arc
  ctx.beginPath();
  ctx.arc(0, 0, radius - 4.5, Math.PI * 0.9, Math.PI * 1.6);
  ctx.stroke();

  // Draw arrow heads
  const drawArrowHead = (angle: number) => {
    ctx.save();
    const r = radius - 4.5;
    const ax = r * Math.cos(angle);
    const ay = r * Math.sin(angle);
    ctx.translate(ax, ay);
    ctx.rotate(angle + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-2.5, 0);
    ctx.lineTo(2.5, 0);
    ctx.lineTo(0, 3.5);
    ctx.closePath();
    ctx.fillStyle = PB_PURPLE;
    ctx.fill();
    ctx.restore();
  };

  drawArrowHead(Math.PI * 0.6);
  drawArrowHead(Math.PI * 1.6);

  ctx.restore();
}

export function createObjectControls(domZoom = 1): Record<string, Control> {
  const controls = createObjectDefaultControls();
  const rotateSize = zoomControlUnits(PB_ROTATE_CONTROL_SCREEN_PX, domZoom);
  const rotateOffset = zoomControlUnits(PB_ROTATE_OFFSET_SCREEN_PX, domZoom);
  controls.mtr = new Control({
    x: 0,
    y: 0.5,
    actionHandler: rotationWithSnapping,
    cursorStyleHandler: rotationStyleHandler,
    offsetY: rotateOffset,
    withConnection: true,
    actionName: 'rotate',
    sizeX: rotateSize,
    sizeY: rotateSize,
  });
  controls.mtr.render = renderRotateIcon;
  return controls;
}

export function createCropOverlayControls(): Record<string, Control> {
  const defaults = createObjectDefaultControls();
  const keys = ['tl', 'tr', 'bl', 'br', 'ml', 'mr', 'mt', 'mb'] as const;
  const controls: Record<string, Control> = {};

  keys.forEach((key) => {
    const base = defaults[key];
    controls[key] = withCropBarRender(
      new Control({
        x: base.x,
        y: base.y,
        cursorStyleHandler: base.cursorStyleHandler,
        actionHandler: base.actionHandler,
        getActionName: base.getActionName,
      }),
    );
  });

  return controls;
}

/** Control definitions + deselected chrome (no visible bbox/handles until selected). */
export function applyObjectControlStyle(obj: FabricInteractive, domZoom = 1) {
  if ((obj as any).pbKind === 'line') {
    obj.set({
      hasControls: false,
      hasBorders: false,
      hasRotatingPoint: false,
      transparentCorners: true,
      cornerColor: 'transparent',
      cornerStrokeColor: 'transparent',
      cornerStyle: 'circle',
      cornerSize: zoomControlUnits(PB_LINE_CORNER_SCREEN_PX, domZoom),
      padding: 0,
    });
    return;
  }
  obj.controls = createObjectControls(domZoom);
  const padding = isTextObject(obj) ? 0 : zoomControlUnits(PB_OBJECT_PADDING_SCREEN_PX, domZoom);
  obj.set({
    hasControls: false,
    hasBorders: false,
    hasRotatingPoint: false,
    transparentCorners: false,
    cornerColor: '#ffffff',
    cornerStrokeColor: PB_PURPLE_DARK,
    borderColor: PB_PURPLE_DARK,
    borderScaleFactor: 2,
    cornerStyle: 'circle',
    cornerSize: zoomControlUnits(PB_CORNER_SCREEN_PX, domZoom),
    padding,
    snapAngle: 90,
    snapThreshold: PB_ROTATION_SNAP_THRESHOLD,
  });
}

export function applySelectedChrome(obj: FabricInteractive, domZoom = 1) {
  applyObjectControlStyle(obj, domZoom);
  if ((obj as any).pbKind === 'line') {
    obj.set({
      hasControls: true,
      hasBorders: false,
      hasRotatingPoint: false,
    });
    return;
  }
  obj.set({
    hasControls: true,
    hasBorders: true,
    hasRotatingPoint: true,
  });
}

export function isMultiCanvasSelection(
  obj: FabricObject,
): obj is FabricObject & { getObjects: () => FabricObject[] } {
  return (
    'multiSelectionStacking' in obj &&
    typeof (obj as FabricObject & { getObjects?: () => FabricObject[] }).getObjects === 'function'
  );
}

/** Dark pink chrome for each object shown inside a multi-select. */
export function applyMultiSelectMemberChrome(obj: FabricInteractive, domZoom = 1) {
  if ((obj as { pbKind?: string }).pbKind === 'line') {
    applySelectedChrome(obj, domZoom);
    return;
  }
  applySelectedChrome(obj, domZoom);
  const multiCorner = zoomControlUnits(PB_MULTI_SELECT_CORNER_SCREEN_PX, domZoom);
  obj.set({
    borderColor: PB_DARK_PINK,
    cornerStrokeColor: PB_DARK_PINK,
    cornerColor: '#ffffff',
    cornerSize: multiCorner,
    transparentCorners: false,
  });
}

/** Dark pink outer bounding box for ActiveSelection (multi-select group). */
export function applyActiveSelectionChrome(selection: FabricInteractive, domZoom = 1) {
  const multiCorner = zoomControlUnits(PB_MULTI_SELECT_CORNER_SCREEN_PX, domZoom);
  selection.set({
    hasControls: true,
    hasBorders: true,
    borderColor: PB_DARK_PINK,
    cornerColor: '#ffffff',
    cornerStrokeColor: PB_DARK_PINK,
    cornerStyle: 'circle',
    cornerSize: multiCorner,
    transparentCorners: false,
    padding: 0,
  });
  if (typeof (selection as FabricObject & { getObjects?: () => FabricObject[] }).getObjects === 'function') {
    (selection as FabricObject & { getObjects: () => FabricInteractive[] })
      .getObjects()
      .forEach((obj) => applyMultiSelectMemberChrome(obj, domZoom));
  }
}

export function applyLockedChrome(obj: FabricInteractive, domZoom = 1) {
  applyObjectControlStyle(obj, domZoom);
  obj.set({
    hasControls: false,
    hasBorders: false,
    hasRotatingPoint: false,
  });
}

/** Resize-only handles (no rotate) with Fabric's native scale drag behavior. */
export function createCropResizeControls(): Record<string, Control> {
  const defaults = createObjectDefaultControls();
  const keys = ['tl', 'tr', 'bl', 'br', 'ml', 'mr', 'mt', 'mb'] as const;
  const controls: Record<string, Control> = {};
  keys.forEach((key) => {
    controls[key] = defaults[key];
  });
  return controls;
}

export function applyCropOverlayStyle(obj: FabricInteractive, domZoom = 1) {
  obj.controls = createCropResizeControls();
  const corner = zoomControlUnits(PB_CORNER_SCREEN_PX, domZoom);
  obj.set({
    hasControls: true,
    hasBorders: true,
    hasRotatingPoint: false,
    lockRotation: true,
    lockScalingX: false,
    lockScalingY: false,
    hoverCursor: 'move',
    transparentCorners: false,
    cornerSize: corner,
    padding: 0,
    borderColor: PB_PURPLE_DARK,
    cornerColor: '#ffffff',
    cornerStrokeColor: PB_PURPLE_DARK,
    cornerStyle: 'circle',
    borderScaleFactor: 2,
  });
}

export function normalizeDegrees(angle: number): number {
  const n = Math.round(angle) % 360;
  return n < 0 ? n + 360 : n;
}

export const PB_ROTATION_SNAP_ANGLES = [0, 90, 180, 270] as const;
export const PB_ROTATION_SNAP_THRESHOLD = 7;

/** Magnetic snap to cardinal angles while rotating — returns true when angle was adjusted. */
export function applyPbRotationSnap(obj: FabricObject): boolean {
  const raw = obj.angle ?? 0;
  const current = normalizeDegrees(raw);
  for (const snap of PB_ROTATION_SNAP_ANGLES) {
    let diff = Math.abs(current - snap);
    if (diff > 180) diff = 360 - diff;
    if (diff <= PB_ROTATION_SNAP_THRESHOLD) {
      if (Math.abs(raw - snap) > 0.5) {
        obj.set({ angle: snap });
        obj.setCoords();
        return true;
      }
      return false;
    }
  }
  return false;
}

export function getRotateHintPosition(obj: FabricObject, hostEl: HTMLElement | null, scale: number = 1) {
  if (!hostEl) return null;
  
  let x = 0;
  let y = 0;
  
  const mtr = (obj as any).oCoords?.mtr;
  if (mtr && typeof mtr.x === 'number' && typeof mtr.y === 'number') {
    // mtr contains the center of the rotate handle circle.
    // We want the hint to be placed slightly below the circle, e.g. 16px below in canvas design units.
    // Let's find the direction of the rotation vector to shift it outwards.
    const center = obj.getCenterPoint();
    const dx = mtr.x - center.x;
    const dy = mtr.y - center.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    
    // Shift by 16 units in the direction of the handle
    x = mtr.x + (dx / len) * 16;
    y = mtr.y + (dy / len) * 16;
  } else {
    // Fallback: calculate mathematically
    const center = obj.getCenterPoint();
    const angleRad = ((obj.angle ?? 0) * Math.PI) / 180;
    
    // localY is half height plus offset plus extra padding
    const height = obj.height ?? 0;
    const scaleY = obj.scaleY ?? 1;
    const rotateOffset = zoomControlUnits(PB_ROTATE_OFFSET_SCREEN_PX, scale);
    const localY = (height * scaleY) / 2 + rotateOffset + zoomControlUnits(16, scale);
    
    x = center.x - localY * Math.sin(angleRad);
    y = center.y + localY * Math.cos(angleRad);
  }
  
  return {
    top: y * scale,
    left: x * scale,
    degrees: normalizeDegrees(obj.angle ?? 0),
  };
}

type CropCoords = {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  br: { x: number; y: number };
  bl: { x: number; y: number };
};

const PB_MIN_CROP_SCENE_PX = 24;

type SceneRect = { left: number; top: number; width: number; height: number };

const CROP_BOUNDS_EPS = 1;

function getObjectSceneBounds(obj: FabricObject): SceneRect {
  obj.setCoords();
  const rect = obj.getBoundingRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function getCropLogicalBounds(cropRect: FabricObject): SceneRect {
  const left = cropRect.left ?? 0;
  const top = cropRect.top ?? 0;
  const width = (cropRect.width ?? 0) * (cropRect.scaleX ?? 1);
  const height = (cropRect.height ?? 0) * (cropRect.scaleY ?? 1);
  return { left, top, width, height };
}

/** Axis-aligned grid corners from the crop rect geometry (not control oCoords). */
export function getCropGridCoords(cropRect: FabricObject): CropCoords | null {
  const rect = getCropLogicalBounds(cropRect);
  if (rect.width < 1 || rect.height < 1) return null;
  return {
    tl: { x: rect.left, y: rect.top },
    tr: { x: rect.left + rect.width, y: rect.top },
    br: { x: rect.left + rect.width, y: rect.top + rect.height },
    bl: { x: rect.left, y: rect.top + rect.height },
  };
}

/** Stable image bounds captured when crop mode starts. */
export function getImageCropBounds(img: FabricObject): SceneRect {
  return getObjectSceneBounds(img);
}

export function isCropAtFullImageSize(cropRect: FabricObject, image: SceneRect): boolean {
  const crop = getCropLogicalBounds(cropRect);
  return (
    crop.width >= image.width - CROP_BOUNDS_EPS &&
    crop.height >= image.height - CROP_BOUNDS_EPS &&
    Math.abs(crop.left - image.left) < CROP_BOUNDS_EPS &&
    Math.abs(crop.top - image.top) < CROP_BOUNDS_EPS
  );
}

export function syncCropOverlayMovementLock(cropRect: FabricObject, image: SceneRect) {
  const atFull = isCropAtFullImageSize(cropRect, image);
  cropRect.set({
    lockMovementX: atFull,
    lockMovementY: atFull,
  });
}

/** Keep the crop overlay inside the target image — shrink-only relative to image bounds. */
export function clampCropOverlayToImage(cropRect: FabricObject, image: SceneRect) {
  const crop = getCropLogicalBounds(cropRect);

  let width = Math.min(crop.width, image.width);
  let height = Math.min(crop.height, image.height);
  width = Math.max(PB_MIN_CROP_SCENE_PX, width);
  height = Math.max(PB_MIN_CROP_SCENE_PX, height);

  let left = Math.max(image.left, Math.min(crop.left, image.left + image.width - width));
  let top = Math.max(image.top, Math.min(crop.top, image.top + image.height - height));

  if (width >= image.width - CROP_BOUNDS_EPS && height >= image.height - CROP_BOUNDS_EPS) {
    left = image.left;
    top = image.top;
    width = image.width;
    height = image.height;
  }

  cropRect.set({
    left,
    top,
    width,
    height,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    originX: 'left',
    originY: 'top',
  });
  cropRect.setCoords();
  syncCropOverlayMovementLock(cropRect, image);
}

/** Slide a crop box within the image without changing its size. */
export function clampCropOverlayPosition(cropRect: FabricObject, image: SceneRect): void {
  if (isCropAtFullImageSize(cropRect, image)) {
    syncCropOverlayMovementLock(cropRect, image);
    return;
  }

  const crop = getCropLogicalBounds(cropRect);
  const nextLeft = Math.max(image.left, Math.min(crop.left, image.left + image.width - crop.width));
  const nextTop = Math.max(image.top, Math.min(crop.top, image.top + image.height - crop.height));

  cropRect.set({ left: nextLeft, top: nextTop });
  cropRect.setCoords();
  syncCropOverlayMovementLock(cropRect, image);
}

/** During resize, correct as soon as the crop box would leave the image. */
export function constrainCropOverlayDuringTransform(cropRect: FabricObject, image: SceneRect) {
  const before = getCropLogicalBounds(cropRect);
  const tol = 0.5;
  const positionOverflow =
    before.left < image.left - tol ||
    before.top < image.top - tol ||
    before.left + before.width > image.left + image.width + tol ||
    before.top + before.height > image.top + image.height + tol;
  const sizeOverflow =
    before.width > image.width + tol || before.height > image.height + tol;

  if (!isCropAtFullImageSize(cropRect, image) && positionOverflow) {
    clampCropOverlayPosition(cropRect, image);
  }

  if (sizeOverflow) {
    clampCropOverlayToImage(cropRect, image);
    return true;
  }

  syncCropOverlayMovementLock(cropRect, image);
  return positionOverflow;
}

export function drawCropGrid(ctx: CanvasRenderingContext2D, coords: CropCoords) {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const lineAt = (t: number) => ({
    top: { x: lerp(coords.tl.x, coords.bl.x, t), y: lerp(coords.tl.y, coords.bl.y, t) },
    bottom: { x: lerp(coords.tr.x, coords.br.x, t), y: lerp(coords.tr.y, coords.br.y, t) },
    left: { x: lerp(coords.tl.x, coords.tr.x, t), y: lerp(coords.tl.y, coords.tr.y, t) },
    right: { x: lerp(coords.bl.x, coords.br.x, t), y: lerp(coords.bl.y, coords.br.y, t) },
  });

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1;
  [1 / 3, 2 / 3].forEach((t) => {
    const v = lineAt(t);
    ctx.beginPath();
    ctx.moveTo(v.top.x, v.top.y);
    ctx.lineTo(v.bottom.x, v.bottom.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(v.left.x, v.left.y);
    ctx.lineTo(v.right.x, v.right.y);
    ctx.stroke();
  });
  ctx.restore();
}
