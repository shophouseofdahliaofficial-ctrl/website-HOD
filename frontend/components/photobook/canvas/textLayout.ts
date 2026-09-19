import type { Canvas, FabricObject } from './types';
import { isTextObject } from './textStyle';
import { isRebakeTraceEnabled, traceRebake } from './pbRebakeTrace';

type TextLike = FabricObject & {
  initDimensions?: () => void;
  shouldCache?: () => boolean;
  lineHeight?: number;
  isEditing?: boolean;
  exitEditing?: () => void;
  _cacheCanvas?: HTMLCanvasElement;
  _removeCacheCanvas?: () => void;
  _clearCache?: () => void;
};

export function clearTextObjectCache(obj: FabricObject) {
  if (!isTextObject(obj)) return;
  const text = obj as TextLike;
  text.objectCaching = false;
  text._removeCacheCanvas?.();
  text._clearCache?.();
  text.dirty = true;
}

function tracedInitDimensions(text: TextLike) {
  const hasFn = typeof text.initDimensions === 'function';
  if (isRebakeTraceEnabled()) {
    traceRebake('initDimensions', { called: hasFn });
  }
  if (hasFn) text.initDimensions!();
}

function tracedSetCoords(obj: FabricObject, context: string) {
  if (isRebakeTraceEnabled()) {
    traceRebake('setCoords', { context });
  }
  obj.setCoords();
}

/**
 * Same repaint path as object:modified after a drag (initDimensions + setCoords + full canvas paint).
 * Lock/unlock must call this — requestRenderAll alone leaves stale IText glyph layout.
 */
export function rebakeTextAfterInteraction(obj: FabricObject, canvas: Canvas) {
  if (!isTextObject(obj)) {
    if (isRebakeTraceEnabled()) {
      traceRebake('rebakeTextAfterInteraction', { phase: 'skip', reason: 'not-text' });
    }
    return;
  }

  if (isRebakeTraceEnabled()) {
    traceRebake('rebakeTextAfterInteraction', { phase: 'enter', dirty: obj.dirty });
  }

  const text = obj as TextLike;
  clearTextObjectCache(obj);
  if (typeof text.lineHeight !== 'number') {
    text.lineHeight = 1.08;
  }
  tracedInitDimensions(text);
  tracedSetCoords(obj, 'rebakeTextAfterInteraction');
  obj.dirty = true;
  flushCanvasRender(canvas, obj);

  if (isRebakeTraceEnabled()) {
    traceRebake('rebakeTextAfterInteraction', {
      phase: 'exit',
      dirty: obj.dirty,
      objectCaching: obj.objectCaching,
      cacheCanvasW: text._cacheCanvas?.width ?? null,
    });
  }
}

export function flushCanvasRender(canvas: Canvas, obj?: FabricObject) {
  if (isRebakeTraceEnabled()) {
    traceRebake('flushCanvasRender', {
      phase: 'enter',
      hasContextTop: !!canvas.contextTop,
      dirty: obj?.dirty,
    });
  }

  if (canvas.contextTop) {
    canvas.clearContext(canvas.contextTop);
    const top = canvas as Canvas & { contextTopDirty?: boolean };
    if (top.contextTopDirty !== undefined) {
      top.contextTopDirty = true;
    }
  }
  canvas.calcOffset();
  canvas.requestRenderAll();

  if (isRebakeTraceEnabled()) {
    traceRebake('renderAll', { phase: 'before' });
  }
  canvas.renderAll();
  if (isRebakeTraceEnabled()) {
    traceRebake('renderAll', {
      phase: 'after',
      dirty: obj?.dirty,
    });
  }

  if (isRebakeTraceEnabled()) {
    traceRebake('flushCanvasRender', {
      phase: 'exit',
      dirty: obj?.dirty,
    });
  }
}

export function getTextRenderProbe(obj: FabricObject) {
  if (!isTextObject(obj)) return null;
  const text = obj as TextLike;
  const bound = obj.getBoundingRect();
  return {
    width: obj.width,
    height: obj.height,
    textBoundsW: Math.round(bound.width * 100) / 100,
    textBoundsH: Math.round(bound.height * 100) / 100,
    scaleX: obj.scaleX,
    scaleY: obj.scaleY,
    left: obj.left,
    top: obj.top,
    clipPath: !!obj.clipPath,
    objectCaching: obj.objectCaching,
    shouldCache: typeof text.shouldCache === 'function' ? text.shouldCache() : null,
    cacheCanvasW: text._cacheCanvas?.width ?? null,
    cacheCanvasH: text._cacheCanvas?.height ?? null,
    dirty: obj.dirty,
    editable: (text as TextLike & { editable?: boolean }).editable,
    selectable: obj.selectable,
    isEditing: text.isEditing,
    hasBorders: (obj as FabricObject & { hasBorders?: boolean }).hasBorders,
    hasControls: obj.hasControls,
    padding: (obj as FabricObject & { padding?: number }).padding,
    selectionBackgroundColor:
      (obj as FabricObject & { selectionBackgroundColor?: string }).selectionBackgroundColor || '',
    opacity: obj.opacity,
    globalAlpha: (obj as FabricObject & { globalAlpha?: number }).globalAlpha,
  };
}

export function refreshTextObjectGeometry(obj: FabricObject) {
  if (!isTextObject(obj)) return;
  clearTextObjectCache(obj);
  const text = obj as TextLike;
  if (typeof text.lineHeight !== 'number') {
    text.lineHeight = 1.08;
  }
  tracedInitDimensions(text);
  tracedSetCoords(obj, 'refreshTextObjectGeometry');
}

/**
 * Post-drag / object:modified paint path (no position change).
 * Rebake on lock ran more than this; drag only refreshes geometry then Fabric repaints on modified.
 */
export function repaintTextLikeObjectModified(obj: FabricObject, canvas: Canvas) {
  if (!isTextObject(obj)) return;
  refreshTextObjectGeometry(obj);
  obj.dirty = true;
  canvas.requestRenderAll();
  canvas.renderAll();
  canvas.fire('object:modified', { target: obj });
}

export function scheduleRepaintTextLikeObjectModified(
  obj: FabricObject,
  canvas: Canvas,
  defer = false,
) {
  if (!defer) {
    repaintTextLikeObjectModified(obj, canvas);
    return;
  }
  requestAnimationFrame(() => repaintTextLikeObjectModified(obj, canvas));
}

export function configureNewTextObject(obj: FabricObject) {
  if (!isTextObject(obj)) return;
  const text = obj as TextLike & { editable?: boolean };
  text.lineHeight = 1.08;
  text.editable = true;
  clearTextObjectCache(obj);
  refreshTextObjectGeometry(obj);
}

export function ensureTextObjectCachingOff(obj: FabricObject) {
  clearTextObjectCache(obj);
}
