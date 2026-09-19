import type { Canvas, FabricModule, FabricObject } from './types';
import {
  computeCoverTransform,
  computeRotationAwareCoverScale,
  createFrameClipPath,
  getFabricImageNaturalSize,
  getFrameById,
  getFrameGeometry,
  getFrameImageForFrame,
  highlightFrame,
  updateFrameImageCrop,
} from './frames';
import {
  defaultFrameCrop,
  getFrameCrop,
  isFrameAdjustGhost,
  PB_KIND_FRAME_ADJUST_GHOST,
  type PbFrameCrop,
  type PbTaggedObject,
} from './frameMeta';
import type { PbLayoutFrameDef } from './layouts';
import { applySelectedChrome } from './controls';

export type FrameAdjustSession = {
  frameId: string;
  mainImg: FabricObject;
  ghostImg: FabricObject;
  frameObj: FabricObject;
  geom: PbLayoutFrameDef;
  pad: number;
  crop: PbFrameCrop;
  savedCrop: PbFrameCrop;
  baseCoverScale: number;
  scaleGestureStart?: { cropScale: number; pointerScale: number };
  savedCanvasClipPath?: FabricObject;
  savedControlsAboveOverlay: boolean;
  dragPointerStart?: {
    sceneX: number;
    sceneY: number;
    offsetX: number;
    offsetY: number;
  };
};

let activeSession: FrameAdjustSession | null = null;
let adjustDragActive = false;

export function getFrameAdjustSession(): FrameAdjustSession | null {
  return activeSession;
}

export function isFrameAdjustActive(): boolean {
  return activeSession !== null;
}

export function clampFrameCrop(
  crop: PbFrameCrop,
  geom: PbLayoutFrameDef,
  naturalW: number,
  naturalH: number,
  angleDeg = 0,
): PbFrameCrop {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const baseScale = computeRotationAwareCoverScale(naturalW, naturalH, geom.width, geom.height, angleDeg);
  const s = baseScale * crop.scale;
  const sw = naturalW * s;
  const sh = naturalH * s;
  const bboxW = sw * cos + sh * sin;
  const bboxH = sw * sin + sh * cos;
  const maxOffX = Math.max(0, (bboxW - geom.width) / 2);
  const maxOffY = Math.max(0, (bboxH - geom.height) / 2);
  return {
    scale: Math.max(1, Math.min(3, crop.scale)),
    offsetX: Math.max(-maxOffX, Math.min(maxOffX, crop.offsetX)),
    offsetY: Math.max(-maxOffY, Math.min(maxOffY, crop.offsetY)),
  };
}

function getBaseCoverScale(img: FabricObject, geom: PbLayoutFrameDef): number {
  const { w, h } = getFabricImageNaturalSize(img);
  return computeRotationAwareCoverScale(w, h, geom.width, geom.height, img.angle ?? 0);
}

function syncAdjustGhost(session: FrameAdjustSession, fabric: FabricModule) {
  const { mainImg, ghostImg, geom, pad, crop } = session;
  const { w, h } = getFabricImageNaturalSize(mainImg);
  const frameLeft = pad + geom.x;
  const frameTop = pad + geom.y;
  const angleDeg = mainImg.angle ?? 0;
  const transform = computeCoverTransform(
    w,
    h,
    geom.width,
    geom.height,
    crop,
    frameLeft,
    frameTop,
    angleDeg,
  );
  const clip = createFrameClipPath(fabric, geom, pad);

  mainImg.set({
    left: transform.left,
    top: transform.top,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    originX: 'center',
    originY: 'center',
    angle: angleDeg,
    clipPath: clip,
    crop: { ...crop },
    pbFrameAdjustActive: true,
  } as Record<string, unknown>);

  ghostImg.set({
    left: transform.left,
    top: transform.top,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    originX: 'center',
    originY: 'center',
    angle: angleDeg,
    clipPath: undefined,
    opacity: 0.35,
    visible: true,
  });
  mainImg.setCoords();
  ghostImg.setCoords();
  mainImg.dirty = true;
  ghostImg.dirty = true;
}

/** Keep ghost + clipped main above frames and page clip while adjusting. */
export function maintainFrameAdjustLayerOrder(canvas: Canvas, session: FrameAdjustSession) {
  canvas.clipPath = undefined;
  const objects = canvas.getObjects();
  const ghostIdx = objects.indexOf(session.ghostImg);
  const mainIdx = objects.indexOf(session.mainImg);
  if (ghostIdx < 0 || mainIdx < 0) return;

  const top = objects.length - 1;
  canvas.moveObjectTo(session.ghostImg, Math.max(0, top - 1));
  canvas.moveObjectTo(session.mainImg, top);

  session.ghostImg.set({
    visible: true,
    opacity: 0.35,
    clipPath: undefined,
    evented: false,
    selectable: false,
  });
  session.ghostImg.dirty = true;
  session.mainImg.dirty = true;
}

export async function enterFrameAdjustMode(
  canvas: Canvas,
  fabric: FabricModule,
  frameId: string,
  pad: number,
  domZoom = 1,
): Promise<boolean> {
  exitFrameAdjustMode(canvas, true);

  const frameObj = getFrameById(canvas, frameId);
  const mainImg = getFrameImageForFrame(canvas, frameId);
  if (!frameObj || !mainImg) return false;

  const geom = getFrameGeometry(frameObj, pad);
  if (!geom) return false;

  const tagged = mainImg as PbTaggedObject;
  const sourceUrl = tagged.sourceUrl;
  if (!sourceUrl) return false;

  const crop = { ...getFrameCrop(mainImg) };
  const savedCrop = { ...crop };
  const baseCoverScale = getBaseCoverScale(mainImg, geom);

  const ghostImg = await fabric.FabricImage.fromURL(sourceUrl, { crossOrigin: 'anonymous' });
  ghostImg.set({
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
    objectCaching: false,
    pbKind: PB_KIND_FRAME_ADJUST_GHOST,
    name: 'pb-frame-adjust-ghost',
    originX: 'left',
    originY: 'top',
  } as Record<string, unknown>);

  const session: FrameAdjustSession = {
    frameId,
    mainImg,
    ghostImg,
    frameObj,
    geom,
    pad,
    crop,
    savedCrop,
    baseCoverScale,
    savedCanvasClipPath: canvas.clipPath,
    savedControlsAboveOverlay: !!canvas.controlsAboveOverlay,
  };
  activeSession = session;

  // Let adjust handles and ghost image extend into the page padding (Canva-style).
  canvas.clipPath = undefined;
  canvas.controlsAboveOverlay = true;

  syncAdjustGhost(session, fabric);
  canvas.add(ghostImg);
  maintainFrameAdjustLayerOrder(canvas, session);

  highlightFrame(frameObj, 'selected', canvas);
  mainImg.set({
    selectable: true,
    evented: true,
    lockMovementX: true,
    lockMovementY: true,
    lockScalingX: false,
    lockScalingY: false,
    lockRotation: true,
    hasRotatingPoint: false,
    pbFrameAdjustActive: true,
    objectCaching: false,
  } as Record<string, unknown>);
  applySelectedChrome(mainImg as Parameters<typeof applySelectedChrome>[0], domZoom);
  mainImg.setCoords();
  canvas.setActiveObject(mainImg);
  canvas.requestRenderAll();
  return true;
}

export function updateFrameAdjustCrop(
  canvas: Canvas,
  fabric: FabricModule,
  nextCrop: PbFrameCrop,
) {
  const session = activeSession;
  if (!session) return;
  const { w, h } = getFabricImageNaturalSize(session.mainImg);
  session.crop = clampFrameCrop(nextCrop, session.geom, w, h, session.mainImg.angle ?? 0);
  syncAdjustGhost(session, fabric);
  maintainFrameAdjustLayerOrder(canvas, session);
  canvas.requestRenderAll();
}

export function handleFrameAdjustPointerDown(sceneX: number, sceneY: number) {
  const session = activeSession;
  if (!session) return;
  adjustDragActive = true;
  session.dragPointerStart = {
    sceneX,
    sceneY,
    offsetX: session.crop.offsetX,
    offsetY: session.crop.offsetY,
  };
}

export function handleFrameAdjustPointerMove(
  canvas: Canvas,
  fabric: FabricModule,
  sceneX: number,
  sceneY: number,
) {
  const session = activeSession;
  if (!session || !adjustDragActive || !session.dragPointerStart) return false;

  const dx = sceneX - session.dragPointerStart.sceneX;
  const dy = sceneY - session.dragPointerStart.sceneY;
  const { w, h } = getFabricImageNaturalSize(session.mainImg);
  session.crop = clampFrameCrop(
    {
      ...session.crop,
      offsetX: session.dragPointerStart.offsetX + dx,
      offsetY: session.dragPointerStart.offsetY + dy,
    },
    session.geom,
    w,
    h,
    session.mainImg.angle ?? 0,
  );
  syncAdjustGhost(session, fabric);
  maintainFrameAdjustLayerOrder(canvas, session);
  return true;
}

export function handleFrameAdjustPointerUp() {
  adjustDragActive = false;
  if (activeSession) {
    activeSession.dragPointerStart = undefined;
  }
}

export function isFrameAdjustDragging(): boolean {
  return adjustDragActive;
}

export function handleFrameAdjustScaling(canvas: Canvas, fabric: FabricModule, target: FabricObject) {
  const session = activeSession;
  if (!session || target !== session.mainImg) return false;

  const pointerScale = target.scaleX ?? session.baseCoverScale;
  if (!session.scaleGestureStart) {
    session.scaleGestureStart = {
      cropScale: session.crop.scale,
      pointerScale,
    };
  }

  const ratio = pointerScale / Math.max(session.scaleGestureStart.pointerScale, 0.0001);
  const { w, h } = getFabricImageNaturalSize(session.mainImg);
  session.crop = clampFrameCrop(
    { ...session.crop, scale: session.scaleGestureStart.cropScale * ratio },
    session.geom,
    w,
    h,
    session.mainImg.angle ?? 0,
  );
  syncAdjustGhost(session, fabric);
  maintainFrameAdjustLayerOrder(canvas, session);
  canvas.requestRenderAll();
  return true;
}

export function clearFrameAdjustScaleGesture() {
  if (activeSession) {
    activeSession.scaleGestureStart = undefined;
  }
}

export function exitFrameAdjustMode(canvas: Canvas, apply: boolean, fabric?: FabricModule) {
  const session = activeSession;
  if (!session) return;

  const { mainImg, ghostImg, frameObj, geom, pad, savedCrop, crop } = session;
  activeSession = null;
  adjustDragActive = false;

  canvas.remove(ghostImg);
  highlightFrame(frameObj, false, canvas);

  canvas.clipPath = session.savedCanvasClipPath;
  canvas.controlsAboveOverlay = session.savedControlsAboveOverlay;

  const finalCrop = apply ? crop : savedCrop;
  if (fabric) {
    updateFrameImageCrop(fabric, mainImg, geom, pad, finalCrop);
  }

  mainImg.set({
    selectable: true,
    evented: true,
    lockMovementX: true,
    lockMovementY: true,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
    hasControls: false,
    hasBorders: false,
    hasRotatingPoint: false,
    pbFrameAdjustActive: false,
  } as Record<string, unknown>);
  mainImg.setCoords();
  canvas.requestRenderAll();
}

export function removeFrameAdjustArtifacts(canvas: Canvas) {
  canvas.getObjects().forEach((obj) => {
    if (isFrameAdjustGhost(obj)) canvas.remove(obj);
  });
  if (activeSession) {
    activeSession = null;
  }
}

export function isFrameAdjustTarget(obj: FabricObject | null | undefined): boolean {
  if (!activeSession || !obj) return false;
  return obj === activeSession.mainImg;
}

export function getFrameAdjustFrameId(): string | null {
  return activeSession?.frameId ?? null;
}

export function resetFrameAdjustCrop(canvas: Canvas, fabric: FabricModule) {
  const session = activeSession;
  if (!session) return;
  session.crop = defaultFrameCrop();
  syncAdjustGhost(session, fabric);
  maintainFrameAdjustLayerOrder(canvas, session);
  canvas.requestRenderAll();
}
