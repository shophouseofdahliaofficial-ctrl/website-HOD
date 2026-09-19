import type { Canvas, FabricObject } from './types';
import { isChromeObject } from './chrome';
import { PB_CROP_OVERLAY_NAME } from './constants';
import {
  applyObjectControlStyle,
  applySelectedChrome,
} from './controls';
import { clearLegacyHoverStroke } from './hover';
import { isTextObject } from './textStyle';
import { isTextEditing } from './textEditing';
import { isRebakeTraceEnabled, reportRebakeTrace, traceRebake } from './pbRebakeTrace';
import { scheduleRepaintTextLikeObjectModified } from './textLayout';

type FabricInteractive = FabricObject & {
  controls?: Record<string, import('fabric').Control>;
  cornerStyle?: string;
};

export type PbObjectChromeState = 'selected' | 'deselected' | 'locked';

function isCropOverlay(obj: FabricObject): boolean {
  return (obj as FabricObject & { name?: string }).name === PB_CROP_OVERLAY_NAME;
}

export function exitTextEditing(obj: FabricObject) {
  if (!isTextObject(obj) || !isTextEditing(obj)) return;
  const text = obj as FabricObject & { exitEditing?: () => void };
  text.exitEditing?.();
}

export function setTextEditable(obj: FabricObject, editable: boolean) {
  if (!isTextObject(obj)) return;
  (obj as FabricObject & { editable?: boolean }).editable = editable;
}

export function isObjectLocked(obj: FabricObject): boolean {
  return !!obj.lockMovementX;
}

function applyLockFlags(obj: FabricObject, locked: boolean) {
  obj.lockMovementX = locked;
  obj.lockMovementY = locked;
  obj.lockScalingX = locked;
  obj.lockScalingY = locked;
  obj.lockRotation = locked;
}

function applyLockedChromeOnly(obj: FabricObject) {
  const target = obj as FabricObject & { hasRotatingPoint?: boolean };
  target.hasControls = false;
  target.hasBorders = false;
  target.hasRotatingPoint = false;
}

export function resolveObjectChromeState(obj: FabricObject, canvas: Canvas): PbObjectChromeState {
  if (isObjectLocked(obj)) return 'locked';
  if (canvas.getActiveObject() === obj) return 'selected';
  return 'deselected';
}

export function syncObjectChrome(obj: FabricObject, state: PbObjectChromeState, domZoom = 1) {
  if (isChromeObject(obj) || isCropOverlay(obj)) return;
  // Fabric hides controls while IText is editing; don't restore selection chrome mid-edit.
  if (isTextEditing(obj)) return;

  clearLegacyHoverStroke(obj);

  if (state === 'locked') {
    applyLockedChromeOnly(obj);
    setTextEditable(obj, false);
  } else {
    setTextEditable(obj, true);
    if (state === 'selected') {
      applySelectedChrome(obj as FabricInteractive, domZoom);
    } else {
      applyObjectControlStyle(obj as FabricInteractive, domZoom);
    }
  }

  obj.setCoords();
}

export function syncAllObjectsChrome(canvas: Canvas, domZoom = 1) {
  canvas.forEachObject((obj) => {
    syncObjectChrome(obj, resolveObjectChromeState(obj, canvas), domZoom);
  });
}

/** Lock/unlock: interaction flags only, then same text rebake as object:modified after drag. */
export function applyLockToObject(
  obj: FabricObject,
  locked: boolean,
  canvas: Canvas,
  domZoom = 1,
) {
  if (isRebakeTraceEnabled()) {
    traceRebake('applyLockToObject', {
      phase: 'enter',
      locked,
      isText: isTextObject(obj),
      dirty: obj.dirty,
    });
  }

  const wasEditing = locked && isTextEditing(obj);
  if (locked) {
    exitTextEditing(obj);
  }

  applyLockFlags(obj, locked);

  if (locked) {
    applyLockedChromeOnly(obj);
    setTextEditable(obj, false);
  } else {
    const state = resolveObjectChromeState(obj, canvas);
    if (state === 'selected') {
      applySelectedChrome(obj as FabricInteractive, domZoom);
    } else {
      applyObjectControlStyle(obj as FabricInteractive, domZoom);
    }
    setTextEditable(obj, true);
  }

  if (isTextObject(obj)) {
    scheduleRepaintTextLikeObjectModified(obj, canvas, wasEditing);
  } else {
    if (isRebakeTraceEnabled()) {
      traceRebake('rebakeTextAfterInteraction', {
        phase: 'skip',
        reason: 'applyLockToObject-non-text',
      });
    }
    obj.setCoords();
    canvas.requestRenderAll();
    canvas.renderAll();
  }

  if (isRebakeTraceEnabled()) {
    traceRebake('applyLockToObject', {
      phase: 'exit',
      locked,
      isText: isTextObject(obj),
      dirty: obj.dirty,
    });
  }
}

export { reportRebakeTrace };
