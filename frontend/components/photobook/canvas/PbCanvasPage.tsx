'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PbCanvasPageApi, PbCanvasSerialized } from './api';
import type { PbCanvasObjectEditMeta, ToolbarColorMode } from './objectMeta';
import { getObjectColor, getObjectEditMeta, getToolbarConfig } from './objectMeta';
import { applyTextStylePatch, isTextObject, type PbCanvasTextStyle } from './textStyle';
import {
  PB_CROP_OVERLAY_NAME,
  PB_PAGE_SIZE_PX,
  type PbCanvasToolMode,
  type PbTextPresetKind,
} from './constants';
import { syncPageChrome, isChromeObject, type PbPageDimensions } from './chrome';
import {
  applyCropOverlayStyle,
  applyActiveSelectionChrome,
  applyMultiSelectMemberChrome,
  applyPbRotationSnap,
  applySelectedChrome,
  clampCropOverlayToImage,
  clampCropOverlayPosition,
  constrainCropOverlayDuringTransform,
  getImageCropBounds,
  getCropGridCoords,
  syncCropOverlayMovementLock,
  drawCropGrid,
  getRotateHintPosition,
  isMultiCanvasSelection,
} from './controls';
import { canvasHasUserContent, deserializePageCanvas, serializePageCanvas } from './document';
import { loadFabricImageFromUrl } from './imageLoad';
import { STICKER_INSERT_MAX_SCENE_PX } from '@/lib/photobook/stickers';
import { syncCanvasDisplayScale } from './displayScale';
import { loadFabric } from './fabricLoader';
import {
  applyCenterAlignSnap,
  computeCenterAlignSnap,
  drawCenterAlignGuides,
  type PbAlignGuideVisibility,
} from './alignGuides';
import { drawHoverOutline, resolveHoverTarget } from './hover';
import { eraseDrawObjectsAtPoint } from './drawEraser';
import {
  getMarqueeDragPageId,
  getMarqueeDragPreviewObjects,
  isMarqueeDragActive,
} from './workspaceMarquee';
import './pbCanvasDomDiagnostics';
import { logPbCanvasLayerAlignment } from './pbCanvasLayerAlignment';
import { registerPbFabricCanvas, unregisterPbFabricCanvas } from './pbFabricCanvasRegistry';
import './pbCanvasPaintProbe';
import './pbCanvasObjectProbe';
import './pbFabricCanvasRegistry';
import './pbTextRepaintSteps';
import { flushCanvasAfterSelectionChange } from './selectionRender';
import { copyCanvasSelection, pasteCanvasClipboard } from './canvasClipboard';
import { isPageBgGeomLogEnabled, logPageBgGeometry } from './pbPageBgGeometry';
import './selectionRender';
import { diffProbe, logLockRenderProbe } from './pbLockProbe';
import { isRebakeTraceEnabled, reportRebakeTrace } from './pbRebakeTrace';
import {
  configureNewTextObject,
  ensureTextObjectCachingOff,
  rebakeTextAfterInteraction,
  refreshTextObjectGeometry,
  scheduleRepaintTextLikeObjectModified,
} from './textLayout';
import {
  applyLockToObject,
  isObjectLocked,
  resolveObjectChromeState,
  syncAllObjectsChrome,
  syncObjectChrome,
} from './interaction';
import { createShapeObject } from './shapes';
import { getTextPreset } from './textPresets';
import {
  applyPageLayout,
  applyPageLayoutToCanvas,
  clearFrameBorderToggleTransitions,
  enforceTemplateFrameLocks,
  findFrameAtScenePoint,
  getFabricImageNaturalSize,
  computeCoverTransform,
  createFrameClipPath,
  getFrameById,
  getFrameGeometry,
  getFrameImageForFrame,
  getFrameObjects,
  getFirstEmptyFrame,
  hasAnyFilledFrame,
  highlightFrame,
  installFrameImageTargetHitTest,
  isFrameFilled,
  isFrameTargetSelected,
  placeImageInFrame,
  placeImageInFrameById,
  removeLayoutObjects,
  reorderPageLayers,
  restoreFrameImagesAfterLoad,
  setFrameFilledState,
  setFrameEmptyHintVisible,
  setFrameEmptyHintsVisible,
  restoreAllEmptyFrameHints,
  ensureFrameEmptyHintRender,
  syncFrameSelectionHighlight,
  updateFrameImageCrop,
} from './frames';
import {
  clearFrameAdjustScaleGesture,
  enterFrameAdjustMode,
  exitFrameAdjustMode,
  getFrameAdjustSession,
  handleFrameAdjustPointerDown,
  handleFrameAdjustPointerMove,
  handleFrameAdjustPointerUp,
  isFrameAdjustDragging,
  handleFrameAdjustScaling,
  isFrameAdjustActive,
  isFrameAdjustTarget,
  removeFrameAdjustArtifacts,
  updateFrameAdjustCrop,
} from './frameAdjust';
import {
  defaultFrameCrop,
  getFrameCrop,
  getFrameId,
  isCanvasPlacedImage,
  isFrameImage,
  isImageFrame,
  type PbTaggedObject,
  PB_KIND_GALLERY_PREVIEW,
} from './frameMeta';
import {
  applyFrameImageStyle,
  type PbFrameImageStylePatch,
} from './frameImageStyle';
import { getPbLayoutDefinition, normalizeLayoutId, resolveLayoutInnerGap, type PbLayoutId } from './layouts';
import { getPbCoverDesignDefinition, normalizeCoverDesignId, type PbCoverDesignId } from './coverDesigns';
import type { Canvas, FabricModule, FabricObject } from './types';
import styles from '../../ProductDetailsModal.module.css';
import { setupCustomLineObject, createCustomLineObject } from './customLines';

const STROKE = '#ff1e68';

function isPbStickerAssetUrl(url: string): boolean {
  return /\/openmoji\//i.test(url) || /\.svg($|[?#])/i.test(url);
}

export type PbCanvasPageProps = {
  pageId: string;
  className?: string;
  /** DOM artboard zoom factor (1 = 100%). Drives display sync only; Fabric viewport stays at 1. */
  displayScale?: number;
  isActivePage: boolean;
  isPreview: boolean;
  isLocked: boolean;
  toolsActive: boolean;
  toolMode: PbCanvasToolMode;
  drawPreset: 'pencil' | 'marker' | 'highlighter' | 'eraser';
  drawColor?: string;
  drawWeight?: number;
  drawOpacity?: number;
  linePreset: 'straight' | 'curve' | 'zigzag' | null;
  canvasShape: string;
  extendedSelectArea?: boolean;
  documentData?: PbCanvasSerialized;
  onDocumentChange: (pageId: string, data: PbCanvasSerialized) => void;
  onRegisterApi: (pageId: string, api: PbCanvasPageApi | null) => void;
  onImagePlaced?: (pageId: string) => void;
  galleryDropActive?: boolean;
  hasCanvasObjects?: boolean;
  useSidebarEditToolbar?: boolean;
  onObjectSelected?: (info: { pageId: string; meta: PbCanvasObjectEditMeta } | null) => void;
  onCanvasBackgroundClick?: () => void;
  onActivatePage?: () => void;
  onCropActiveChange?: (active: boolean) => void;
  pageBackgroundColor?: string;
  /** Dev probe hook — fired once when Fabric canvas is ready. */
  onFabricCanvasReady?: (canvas: Canvas) => void;
  pbTip?: (text: string) => {
    onMouseEnter: (e: React.MouseEvent) => void;
    onMouseMove?: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
  };
  pageWidthPx?: number;
  pageHeightPx?: number;
  /** Current page layout id from page metadata. */
  pageLayoutId?: string;
  /** When false, gaps between image frames are removed (outer page padding unchanged). */
  layoutFrameGapEnabled?: boolean;
  /** Front-cover design id (uses cover frame templates instead of page layout). */
  coverDesignId?: string;
  /** Gallery image URL while dragging (for frame drop preview). */
  galleryDragUrl?: string | null;
  onFrameCropOpen?: (payload: {
    pageId: string;
    sourceUrl: string;
    frameWidth: number;
    frameHeight: number;
    naturalWidth: number;
    naturalHeight: number;
    crop: import('./frameMeta').PbFrameCrop;
    frameId: string;
  }) => void;
  /** Fired when in-canvas frame image adjust mode starts or ends. */
  onFrameAdjustActiveChange?: (active: boolean, opts?: { openEditSidebar?: boolean }) => void;
  onGalleryMessage?: (message: string) => void;
};

function ensureShapeObjectProperties(obj: FabricObject) {
  const type = (obj.type ?? '').toLowerCase();
  const isShape =
    (obj as any).pbKind === 'shape' ||
    type === 'rect' ||
    type === 'circle' ||
    type === 'ellipse' ||
    type === 'triangle' ||
    type === 'polygon' ||
    type === 'path';

  if (isShape) {
    obj.set({
      strokeUniform: true,
      objectCaching: false,
      noScaleCache: true,
    });
    const anyObj = obj as any;
    if (typeof anyObj._removeCacheCanvas === 'function') {
      anyObj._removeCacheCanvas();
    }
    if (typeof anyObj._clearCache === 'function') {
      anyObj._clearCache();
    }
    obj.dirty = true;
  }
}

function isCropOverlay(obj: FabricObject): boolean {
  return (obj as FabricObject & { name?: string }).name === PB_CROP_OVERLAY_NAME;
}

function pinCropOverlaySelection(
  canvas: Canvas,
  cropRect: FabricObject,
  domZoom: number,
  skipStyleRefresh = false,
) {
  if (canvas.getActiveObject() !== cropRect) {
    canvas.setActiveObject(cropRect);
  }
  if (!skipStyleRefresh) {
    applyCropOverlayStyle(cropRect as Parameters<typeof applyCropOverlayStyle>[0], domZoom);
  }
  cropRect.setCoords();
}

function lockCanvasObjectsForCrop(canvas: Canvas, cropRect: FabricObject, cropTarget: FabricObject | null) {
  canvas.forEachObject((obj) => {
    if (isCropOverlay(obj)) {
      if (obj === cropRect) {
        obj.set({ selectable: true, evented: true });
      }
      return;
    }
    if (isChromeObject(obj) || obj === cropTarget) {
      obj.set({ selectable: false, evented: false });
      return;
    }
    obj.set({ selectable: false, evented: false });
  });
}


/** Design-space padding around the page for handles / off-canvas selection. */
const FABRIC_SELECT_PAD = 56;

function getPad(_extended: boolean) {
  return FABRIC_SELECT_PAD;
}

function getCanvasPixelSize(pad: number, page: PbPageDimensions) {
  return { width: page.widthPx + pad * 2, height: page.heightPx + pad * 2 };
}

function pageCenter(pad: number, page: PbPageDimensions) {
  return {
    x: pad + page.widthPx / 2,
    y: pad + page.heightPx / 2,
  };
}

export default function PbCanvasPage({
  pageId,
  className,
  displayScale = 1,
  isActivePage,
  isPreview,
  isLocked,
  toolsActive,
  toolMode,
  drawPreset,
  drawColor = '#ff1e68',
  drawWeight = 0,
  drawOpacity = 100,
  linePreset,
  canvasShape,
  extendedSelectArea = false,
  documentData,
  onDocumentChange,
  onRegisterApi,
  onImagePlaced,
  galleryDropActive = false,
  useSidebarEditToolbar = true,
  onObjectSelected,
  onCanvasBackgroundClick,
  onActivatePage,
  onCropActiveChange,
  pageBackgroundColor = '#ffffff',
  onFabricCanvasReady,
  pbTip,
  pageWidthPx = PB_PAGE_SIZE_PX,
  pageHeightPx = PB_PAGE_SIZE_PX,
  pageLayoutId,
  layoutFrameGapEnabled = true,
  coverDesignId,
  galleryDragUrl = null,
  onFrameCropOpen,
  onFrameAdjustActiveChange,
  onGalleryMessage,
}: PbCanvasPageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const fabricModuleRef = useRef<FabricModule | null>(null);
  const loadedJsonRef = useRef('');
  const isRestoringRef = useRef(false);
  const hoveredRef = useRef<FabricObject | null>(null);
  const alignGuidesRef = useRef<PbAlignGuideVisibility>({ vertical: false, horizontal: false });
  const lineDraftRef = useRef<FabricObject | null>(null);
  const cropRectRef = useRef<FabricObject | null>(null);
  const cropTargetRef = useRef<FabricObject | null>(null);
  const cropImageBoundsRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);
  const cropTransformActiveRef = useRef(false);
  const savedControlsAboveOverlayRef = useRef<boolean | null>(null);
  const applyInteractionModeRef = useRef<(() => void) | null>(null);
  const galleryPreviewRef = useRef<FabricObject | null>(null);
  const galleryHighlightFrameRef = useRef<FabricObject | null>(null);
  const galleryPreviewSeqRef = useRef(0);
  const galleryDragScenePointRef = useRef<{ x: number; y: number } | null>(null);
  const galleryPreviewActiveRef = useRef(false);
  const framePointerHoverRef = useRef<FabricObject | null>(null);
  const syncAllFrameHighlightsRef = useRef<((target?: FabricObject | null) => void) | null>(null);
  const suppressSelectionReportRef = useRef(false);
  const suppressSelectionFlushRef = useRef(false);

  const onFrameCropOpenRef = useRef(onFrameCropOpen);
  const onFrameAdjustActiveChangeRef = useRef(onFrameAdjustActiveChange);
  const onGalleryMessageRef = useRef(onGalleryMessage);
  const openFrameCropModalForFrameRef = useRef<(frameId: string) => boolean>(() => false);
  onFrameCropOpenRef.current = onFrameCropOpen;
  onFrameAdjustActiveChangeRef.current = onFrameAdjustActiveChange;
  onGalleryMessageRef.current = onGalleryMessage;

  const onDocumentChangeRef = useRef(onDocumentChange);
  const onRegisterApiRef = useRef(onRegisterApi);
  const onImagePlacedRef = useRef(onImagePlaced);
  const onObjectSelectedRef = useRef(onObjectSelected);
  const onCanvasBackgroundClickRef = useRef(onCanvasBackgroundClick);
  const onActivatePageRef = useRef(onActivatePage);
  const onCropActiveChangeRef = useRef(onCropActiveChange);
  const displayScaleRef = useRef(displayScale);
  onDocumentChangeRef.current = onDocumentChange;
  onRegisterApiRef.current = onRegisterApi;
  onImagePlacedRef.current = onImagePlaced;
  onObjectSelectedRef.current = onObjectSelected;
  onCanvasBackgroundClickRef.current = onCanvasBackgroundClick;
  onActivatePageRef.current = onActivatePage;
  onCropActiveChangeRef.current = onCropActiveChange;
  displayScaleRef.current = displayScale;

  const pageBackgroundColorRef = useRef(pageBackgroundColor);
  pageBackgroundColorRef.current = pageBackgroundColor;

  const padRef = useRef(getPad(extendedSelectArea));
  padRef.current = getPad(extendedSelectArea);

  const pageSizeRef = useRef<PbPageDimensions>({ widthPx: pageWidthPx, heightPx: pageHeightPx });
  pageSizeRef.current = { widthPx: pageWidthPx, heightPx: pageHeightPx };
  const getPageSize = () => pageSizeRef.current;

  const toolModeRef = useRef(toolMode);
  const linePresetRef = useRef(linePreset);
  const toolsActiveRef = useRef(toolsActive);
  const isPreviewRef = useRef(isPreview);
  const isLockedRef = useRef(isLocked);
  const isActivePageRef = useRef(isActivePage);
  toolModeRef.current = toolMode;
  linePresetRef.current = linePreset;
  toolsActiveRef.current = toolsActive;
  isPreviewRef.current = isPreview;
  isLockedRef.current = isLocked;
  isActivePageRef.current = isActivePage;
  const galleryDropActiveRef = useRef(galleryDropActive);
  const galleryDragUrlRef = useRef(galleryDragUrl);
  galleryDropActiveRef.current = galleryDropActive;
  galleryDragUrlRef.current = galleryDragUrl;
  const drawPresetRef = useRef(drawPreset);
  drawPresetRef.current = drawPreset;
  const drawWeightRef = useRef(drawWeight);
  drawWeightRef.current = drawWeight;


  const [cropActive, setCropActive] = useState(false);
  const [rotateHint, setRotateHint] = useState<{ top: number; left: number; degrees: number } | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [toolbar, setToolbar] = useState<{
    top: number;
    left: number;
    fill: string;
    locked: boolean;
    showColor: boolean;
    showCrop: boolean;
    colorMode: ToolbarColorMode;
  } | null>(null);

  const persistCanvas = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || isRestoringRef.current || galleryPreviewActiveRef.current) return;
    const pad = padRef.current;
    try {
      const json = serializePageCanvas(canvas, pad);
      const key = JSON.stringify(json);
      if (key === loadedJsonRef.current) {
        canvas.requestRenderAll();
        return;
      }
      loadedJsonRef.current = key;
      onDocumentChangeRef.current(pageId, json);
    } catch {
      /* ignore transient serialize errors */
    }
    syncPageChrome(canvas, fabricModuleRef.current!, pageBackgroundColorRef.current, padRef.current, getPageSize());
    canvas.requestRenderAll();
  }, [pageBackgroundColor, pageId]);

  const schedulePersist = useCallback(() => {
    if (isRestoringRef.current) return;
    window.setTimeout(persistCanvas, 0);
  }, [persistCanvas]);

  const updateToolbarPosition = useCallback(() => {
    const canvas = fabricRef.current;
    const host = hostRef.current;
    if (!canvas || !host || useSidebarEditToolbar) {
      setToolbar(null);
      return;
    }
    const active = canvas.getActiveObject();
    if (!active || isCropOverlay(active)) {
      setToolbar(null);
      return;
    }
    if (isTextObject(active)) {
      setToolbar(null);
      return;
    }
    const pad = padRef.current;
    const bound = active.getBoundingRect();
    const clipL = pad;
    const clipT = pad;
    const page = getPageSize();
    const clipW = page.widthPx;
    const clipH = page.heightPx;
    const toolbarW = cropActive ? 148 : 200;
    const centerX = bound.left + bound.width / 2;
    const left = Math.min(clipL + clipW - toolbarW / 2 - 4, Math.max(clipL + toolbarW / 2 + 4, centerX));
    const top = Math.max(clipT + 8, Math.min(bound.top - 52, clipT + clipH - 44));
    const config = getToolbarConfig(active);
    setToolbar({
      top,
      left,
      fill: getObjectColor(active, config.colorMode),
      locked: !!active.lockMovementX,
      showColor: config.showColor,
      showCrop: config.showCrop,
      colorMode: config.colorMode,
    });
  }, [cropActive, useSidebarEditToolbar]);

  const reportSelection = useCallback(
    (target?: FabricObject) => {
      if (suppressSelectionReportRef.current) return;
      const cb = onObjectSelectedRef.current;
      if (!cb) return;
      if (!target || isChromeObject(target) || isCropOverlay(target)) {
        cb(null);
        return;
      }
      cb({ pageId, meta: getObjectEditMeta(target) });
    },
    [pageId],
  );

  const styleObject = useCallback((obj: FabricObject) => {
    applySelectedChrome(obj);
  }, []);

  const addObject = useCallback(
    (obj: FabricObject) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      ensureShapeObjectProperties(obj);
      applySelectedChrome(obj);
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
      schedulePersist();
      updateToolbarPosition();
    },
    [schedulePersist, styleObject, updateToolbarPosition],
  );

  const cancelCrop = useCallback(
    (opts?: { reselectTarget?: boolean }) => {
      const canvas = fabricRef.current;
      const cropRect = cropRectRef.current;
      const target = cropTargetRef.current;
      if (!canvas || !cropRect) return null;
      const movingHandler = (cropRect as FabricObject & { _pbCropMovingHandler?: () => void })
        ._pbCropMovingHandler;
      if (movingHandler) {
        cropRect.off('moving', movingHandler);
      }
      canvas.remove(cropRect);
      if (target) {
        target.set({ selectable: true, evented: true });
      }
      cropRectRef.current = null;
      cropTargetRef.current = null;
      cropImageBoundsRef.current = null;
      cropTransformActiveRef.current = false;
      setCropActive(false);
      onCropActiveChangeRef.current?.(false);
      if (savedControlsAboveOverlayRef.current !== null) {
        canvas.controlsAboveOverlay = savedControlsAboveOverlayRef.current;
        savedControlsAboveOverlayRef.current = null;
      }
      if (opts?.reselectTarget && target) {
        canvas.setActiveObject(target);
        updateToolbarPosition();
      } else if (opts?.reselectTarget === false) {
        canvas.discardActiveObject();
        setToolbar(null);
      }
      applyInteractionModeRef.current?.();
      canvas.requestRenderAll();
      return target;
    },
    [updateToolbarPosition],
  );

  const applyCrop = useCallback(() => {
    const canvas = fabricRef.current;
    const cropRect = cropRectRef.current;
    const img = cropTargetRef.current;
    if (!canvas || !cropRect || !img || img.type !== 'image') {
      cancelCrop();
      return;
    }
    const imgRect = img.getBoundingRect();
    const cropBounds = cropRect.getBoundingRect();
    const relL = Math.max(0, (cropBounds.left - imgRect.left) / Math.max(imgRect.width, 1));
    const relT = Math.max(0, (cropBounds.top - imgRect.top) / Math.max(imgRect.height, 1));
    const relW = Math.min(1 - relL, cropBounds.width / Math.max(imgRect.width, 1));
    const relH = Math.min(1 - relT, cropBounds.height / Math.max(imgRect.height, 1));
    if (relW < 0.02 || relH < 0.02) {
      cancelCrop();
      return;
    }
    const image = img as FabricObject & { cropX?: number; cropY?: number; width?: number; height?: number };
    const existingCropX = image.cropX || 0;
    const existingCropY = image.cropY || 0;
    const existingW = image.width || 1;
    const existingH = image.height || 1;
    img.set({
      cropX: existingCropX + relL * existingW,
      cropY: existingCropY + relT * existingH,
      width: relW * existingW,
      height: relH * existingH,
    } as Partial<FabricObject>);
    img.setCoords();
    cancelCrop({ reselectTarget: true });
    schedulePersist();
    updateToolbarPosition();
  }, [cancelCrop, schedulePersist, updateToolbarPosition]);

  const startCrop = useCallback(() => {
    const canvas = fabricRef.current;
    const fabric = fabricModuleRef.current;
    if (!canvas || !fabric || cropRectRef.current) return;
    const active = canvas.getActiveObject();
    if (!active || active.type !== 'image') return;

    const imageBounds = getImageCropBounds(active);
    cropImageBoundsRef.current = imageBounds;
    const cropRect = new fabric.Rect({
      left: imageBounds.left,
      top: imageBounds.top,
      width: imageBounds.width,
      height: imageBounds.height,
      originX: 'left',
      originY: 'top',
      opacity: 1,
      fill: 'rgba(139, 92, 246, 0.1)',
      stroke: 'transparent',
      strokeWidth: 0,
      hasRotatingPoint: false,
      objectCaching: false,
      name: PB_CROP_OVERLAY_NAME,
    });
    applyCropOverlayStyle(cropRect, displayScaleRef.current);
    active.set({ selectable: false, evented: false });
    cropTargetRef.current = active;
    cropRectRef.current = cropRect;
    savedControlsAboveOverlayRef.current = canvas.controlsAboveOverlay;
    canvas.controlsAboveOverlay = true;
    canvas.add(cropRect);
    canvas.bringObjectToFront(cropRect);
    clampCropOverlayToImage(cropRect, imageBounds);
    syncCropOverlayMovementLock(cropRect, imageBounds);
    const handleCropMoving = () => {
      const bounds = cropImageBoundsRef.current;
      const rect = cropRectRef.current;
      if (bounds && rect) {
        clampCropOverlayPosition(rect, bounds);
      }
    };
    cropRect.on('moving', handleCropMoving);
    (cropRect as FabricObject & { _pbCropMovingHandler?: () => void })._pbCropMovingHandler =
      handleCropMoving;
    cropRect.setCoords();
    lockCanvasObjectsForCrop(canvas, cropRect, active);
    setCropActive(true);
    onCropActiveChangeRef.current?.(true);
    suppressSelectionFlushRef.current = true;
    suppressSelectionReportRef.current = true;
    canvas.setActiveObject(cropRect);
    suppressSelectionFlushRef.current = false;
    suppressSelectionReportRef.current = false;
    updateToolbarPosition();
    canvas.requestRenderAll();
  }, [updateToolbarPosition]);

  const removeActive = useCallback((): boolean => {
    if (cropRectRef.current) {
      cancelCrop();
      return true;
    }
    const canvas = fabricRef.current;
    if (!canvas) return false;
    const targets = canvas.getActiveObjects();
    if (!targets.length) return false;
    targets.forEach((obj) => {
      if (!isChromeObject(obj)) {
        if (isImageFrame(obj)) return;
        if (isFrameImage(obj)) {
          const frameId = getFrameId(obj);
          const frame = canvas.getObjects().find((o) => isImageFrame(o) && getFrameId(o) === frameId);
          if (frame) setFrameFilledState(frame, false);
        }
        canvas.remove(obj);
      }
    });
    canvas.discardActiveObject();
    setToolbar(null);
    canvas.requestRenderAll();
    schedulePersist();
    return true;
  }, [cancelCrop, schedulePersist]);

  const duplicateActive = useCallback((): boolean => {
    const canvas = fabricRef.current;
    if (!canvas) return false;
    const active = canvas.getActiveObject();
    if (!active || isChromeObject(active)) return false;
    void active.clone().then((cloned) => {
      cloned.set({ left: (cloned.left ?? 0) + 24, top: (cloned.top ?? 0) + 24 });
      addObject(cloned);
      reportSelection(cloned);
    });
    return true;
  }, [addObject, reportSelection]);

  const toggleLockActive = useCallback((): boolean => {
    const canvas = fabricRef.current;
    if (!canvas) return false;
    const active = canvas.getActiveObject();
    if (!active || isChromeObject(active)) return false;
    const nextLocked = !isObjectLocked(active);
    if (hoveredRef.current === active) hoveredRef.current = null;
    if (isPageBgGeomLogEnabled()) {
      logPageBgGeometry(canvas, nextLocked ? 'before-lock' : 'before-unlock');
    }
    if (isTextObject(active)) {
      logLockRenderProbe(nextLocked ? 'before-lock' : 'before-unlock', active);
    }
    applyLockToObject(active, nextLocked, canvas);
    syncCanvasDisplayScale(canvas, displayScaleRef.current, hostRef.current, padRef.current, getPageSize());
    const fabric = fabricModuleRef.current;
    if (fabric) {
      flushCanvasAfterSelectionChange(
        canvas,
        fabric,
        pageBackgroundColorRef.current,
        padRef.current,
        getPageSize(),
        {
          hostEl: hostRef.current,
          displayScale: displayScaleRef.current,
          logLabel: nextLocked ? 'lock' : 'unlock',
        },
      );
    }
    if (isTextObject(active)) {
      logLockRenderProbe(nextLocked ? 'after-lock' : 'after-unlock', active);
      if (typeof globalThis !== 'undefined' && globalThis.__PB_LOCK_PROBE__) {
        const d = diffProbe(
          nextLocked ? 'before-lock' : 'before-unlock',
          nextLocked ? 'after-lock' : 'after-unlock',
        );
        if (d && Object.keys(d).length) console.table(d);
      }
      if (isRebakeTraceEnabled() && !nextLocked) {
        reportRebakeTrace();
      }
      if (
        typeof globalThis !== 'undefined' &&
        (globalThis as typeof globalThis & { __PB_ALIGN_PROBE__?: boolean }).__PB_ALIGN_PROBE__
      ) {
        logPbCanvasLayerAlignment(hostRef.current ?? undefined, canvas);
      }
    }
    canvas.setActiveObject(active);
    updateToolbarPosition();
    reportSelection(active);
    schedulePersist();
    return true;
  }, [reportSelection, schedulePersist, updateToolbarPosition]);

  const setActiveFill = useCallback(
    (color: string) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (!active) return;
      const config = getToolbarConfig(active);
      if (!config.showColor) return;
      if (config.colorMode === 'stroke') active.set({ stroke: color });
      else active.set({ fill: color });
      canvas.requestRenderAll();
      schedulePersist();
      setToolbar((prev) => (prev ? { ...prev, fill: color } : prev));
      reportSelection(active);
    },
    [reportSelection, schedulePersist],
  );

  const applyActiveTextStyle = useCallback(
    (patch: Partial<PbCanvasTextStyle>, skipPersist = false) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (!active) return;
      applyTextStylePatch(active, patch);
      canvas.requestRenderAll();
      if (!skipPersist) {
        schedulePersist();
        reportSelection(active);
      }
    },
    [reportSelection, schedulePersist],
  );

  const applyActiveObjectStyle = useCallback(
    (patch: Record<string, any>, skipPersist = false) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (!active) return;

      const finalPatch = { ...patch };

      // Recalculate strokeDashArray dynamically for lines to avoid collision with round caps
      if ((active as any).pbKind === 'line') {
        const nextStrokeLineCap = finalPatch.strokeLineCap !== undefined ? finalPatch.strokeLineCap : (active as any).strokeLineCap;
        const nextStrokeWidth = finalPatch.strokeWidth !== undefined ? finalPatch.strokeWidth : (active as any).strokeWidth;
        const currentDashArray = finalPatch.strokeDashArray !== undefined ? finalPatch.strokeDashArray : (active as any).strokeDashArray;

        if (currentDashArray && Array.isArray(currentDashArray)) {
          const firstVal = currentDashArray[0];
          let style = 'dotted';
          if (firstVal === 14 || firstVal === 12) {
            style = 'long-dash';
          } else if (firstVal === 6) {
            style = 'medium-dash';
          }

          let baseDash = 14;
          let baseGap = 6;
          if (style === 'medium-dash') {
            baseDash = 6;
            baseGap = 4;
          } else if (style === 'dotted') {
            baseDash = nextStrokeLineCap === 'round' ? 0.1 : 2;
            baseGap = 3;
          }

          let newDashArray = [baseDash, baseGap];
          if (nextStrokeLineCap === 'round') {
            // Adjust gap based on stroke width so they don't collide.
            // When strokeLineCap is 'round', the round caps extend beyond the dash by strokeWidth/2 on both sides.
            // To maintain a visual empty space equal to baseGap, we increase the gap value by strokeWidth.
            newDashArray = [baseDash, baseGap + nextStrokeWidth];
          }

          finalPatch.strokeDashArray = newDashArray;
        }
      }

      active.set(finalPatch);
      if (finalPatch.rx !== undefined || finalPatch.ry !== undefined || finalPatch.strokeWidth !== undefined) {
        active.setCoords();
      }
      // Temporarily hide control dots on line objects for 1 second after an edit
      if ((active as any).pbKind === 'line') {
        (active as any)._hideDotsUntil = Date.now() + 1000;
        setTimeout(() => {
          (active as any)._hideDotsUntil = 0;
          canvas.requestRenderAll();
        }, 1000);
      }
      canvas.requestRenderAll();
      if (!skipPersist) {
        schedulePersist();
        reportSelection(active);
      }
    },
    [reportSelection, schedulePersist],
  );

  const addImageAt = useCallback(
    async (
      url: string,
      sceneX: number,
      sceneY: number,
      options?: import('./api').PbImageInsertOptions,
    ) => {
      const canvas = fabricRef.current;
      const fabric = fabricModuleRef.current;
      if (!canvas || !fabric) return;
      const page = getPageSize();
      const defaultMax = Math.min(page.widthPx, page.heightPx) * 0.55;
      const maxDim = options?.maxSceneDimension ?? defaultMax;
      const img = await loadFabricImageFromUrl(fabric, url, { displayScenePx: maxDim });
      const naturalW = img.width || maxDim;
      const naturalH = img.height || maxDim;
      const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
      img.set({
        left: sceneX,
        top: sceneY,
        scaleX: scale,
        scaleY: scale,
        originX: 'center',
        originY: 'center',
        pbKind: 'image',
        sourceUrl: url,
        frameFilter: 'none',
        frameCornerRadius: 0,
        frameBorderEnabled: false,
        frameBorderPadding: 0,
        stroke: null,
        strokeWidth: 0,
      });
      addObject(img);
      if (options?.bringToFront) {
        canvas.bringObjectToFront(img);
        reorderPageLayers(canvas);
      }
      img.set('dirty', true);
      canvas.requestRenderAll();
      reportSelection(img);
      onImagePlacedRef.current?.(pageId);
    },
    [addObject, pageId, reportSelection],
  );

  const removeGalleryPreviewOverlay = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const preview = galleryPreviewRef.current;
    if (preview) {
      canvas.remove(preview);
      galleryPreviewRef.current = null;
    }
    galleryPreviewActiveRef.current = false;
  }, []);

  const clearGalleryPreview = useCallback(() => {
    galleryPreviewSeqRef.current += 1;
    const canvas = fabricRef.current;
    removeGalleryPreviewOverlay();
    if (!canvas) return;
    const prevFrame = galleryHighlightFrameRef.current;
    if (prevFrame) {
      highlightFrame(prevFrame, false, canvas);
      galleryHighlightFrameRef.current = null;
    }
    restoreAllEmptyFrameHints(canvas);
    galleryDragScenePointRef.current = null;
    canvas.requestRenderAll();
  }, [removeGalleryPreviewOverlay]);

  const updateGalleryPreview = useCallback(
    async (url: string | null | undefined, event?: MouseEvent | DragEvent) => {
      const canvas = fabricRef.current;
      const fabric = fabricModuleRef.current;
      if (!canvas || !fabric) return;

      if (!url || !event || !galleryDropActive) {
        clearGalleryPreview();
        return;
      }

      if (isPbStickerAssetUrl(url)) {
        clearGalleryPreview();
        return;
      }

      const pointer = canvas.getScenePoint(event);
      galleryDragScenePointRef.current = { x: pointer.x, y: pointer.y };

      const resolveHoverFrame = () => {
        const pt = galleryDragScenePointRef.current;
        if (!pt) return null;
        return findFrameAtScenePoint(canvas, pt.x, pt.y, padRef.current);
      };

      const syncFrameHighlight = (frame: FabricObject | null) => {
        const prevFrame = galleryHighlightFrameRef.current;
        if (prevFrame && prevFrame !== frame) {
          highlightFrame(prevFrame, false, canvas);
          const prevFrameId = getFrameId(prevFrame) ?? '';
          if (!isFrameFilled(canvas, prevFrameId)) {
            setFrameEmptyHintVisible(prevFrame, true);
          }
        }
        galleryHighlightFrameRef.current = frame;
        if (frame) {
          const active = canvas.getActiveObject();
          const selected = isFrameTargetSelected(canvas, frame, active);
          highlightFrame(frame, selected ? 'selected' : 'hover', canvas);
        }
      };

      let frame = resolveHoverFrame();
      syncFrameHighlight(frame);

      if (!frame) {
        galleryPreviewSeqRef.current += 1;
        removeGalleryPreviewOverlay();
        restoreAllEmptyFrameHints(canvas);
        canvas.requestRenderAll();
        return;
      }

      const frameId = getFrameId(frame) ?? '';
      const frameHasImage = isFrameFilled(canvas, frameId);

      let preview = galleryPreviewRef.current;
      const previewTagged = preview as (PbTaggedObject & { pbPreviewUrl?: string }) | null;
      if (preview && previewTagged?.pbPreviewUrl !== url) {
        removeGalleryPreviewOverlay();
        preview = null;
      }

      if (!preview) {
        const loadSeq = ++galleryPreviewSeqRef.current;
        preview = await loadFabricImageFromUrl(fabric, url);
        if (loadSeq !== galleryPreviewSeqRef.current) return;
        preview.set({
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false,
          name: 'pb-gallery-preview',
          pbKind: PB_KIND_GALLERY_PREVIEW,
          objectCaching: false,
          pbPreviewUrl: url,
        } as Record<string, unknown>);
        galleryPreviewRef.current = preview;
        canvas.add(preview);
      }

      frame = resolveHoverFrame();
      syncFrameHighlight(frame);
      if (!frame) {
        galleryPreviewSeqRef.current += 1;
        removeGalleryPreviewOverlay();
        restoreAllEmptyFrameHints(canvas);
        canvas.requestRenderAll();
        return;
      }

      const geom = getFrameGeometry(frame, padRef.current);
      if (!geom) {
        removeGalleryPreviewOverlay();
        restoreAllEmptyFrameHints(canvas);
        canvas.requestRenderAll();
        return;
      }

      setFrameEmptyHintVisible(frame, false);
      galleryPreviewActiveRef.current = true;

      const imgW = getFabricImageNaturalSize(preview).w;
      const imgH = getFabricImageNaturalSize(preview).h;
      const pad = padRef.current;
      const frameLeft = pad + geom.x;
      const frameTop = pad + geom.y;
      const transform = computeCoverTransform(
        imgW,
        imgH,
        geom.width,
        geom.height,
        defaultFrameCrop(),
        frameLeft,
        frameTop,
      );
      const clip = createFrameClipPath(fabric, geom, pad);
      preview.set({
        left: transform.left,
        top: transform.top,
        scaleX: transform.scaleX,
        scaleY: transform.scaleY,
        originX: 'center',
        originY: 'center',
        clipPath: clip,
        opacity: frameHasImage ? 0.62 : 0.48,
      });
      preview.setCoords();
      reorderPageLayers(canvas);
      canvas.bringObjectToFront(preview);
      canvas.requestRenderAll();
    },
    [clearGalleryPreview, galleryDropActive, removeGalleryPreviewOverlay],
  );

  const beginFrameAdjust = useCallback(
    async (frameId: string, opts?: { reportSelection?: boolean }) => {
      const canvas = fabricRef.current;
      const fabric = fabricModuleRef.current;
      if (!canvas || !fabric) return false;
      if (!opts?.reportSelection) {
        suppressSelectionReportRef.current = true;
      }
      const ok = await enterFrameAdjustMode(
        canvas,
        fabric,
        frameId,
        padRef.current,
        displayScaleRef.current,
      );
      if (!opts?.reportSelection) {
        window.setTimeout(() => {
          suppressSelectionReportRef.current = false;
        }, 0);
      }
      if (!ok) return false;
      onFrameAdjustActiveChangeRef.current?.(true, { openEditSidebar: !!opts?.reportSelection });
      if (opts?.reportSelection) {
        const img = getFrameImageForFrame(canvas, frameId);
        if (img) reportSelection(img);
      }
      return true;
    },
    [reportSelection],
  );

  const finishFrameAdjust = useCallback(
    (apply: boolean) => {
      const canvas = fabricRef.current;
      const fabric = fabricModuleRef.current;
      if (!canvas) return;
      if (!isFrameAdjustActive()) return;
      exitFrameAdjustMode(canvas, apply, fabric ?? undefined);
      onFrameAdjustActiveChangeRef.current?.(false);
      if (apply) schedulePersist();
    },
    [schedulePersist],
  );

  const openFrameCropModalForFrame = useCallback((frameId: string): boolean => {
    const canvas = fabricRef.current;
    if (!canvas || !frameId) return false;
    if (isFrameAdjustActive()) {
      finishFrameAdjust(true);
    }
    const frameObj = getFrameById(canvas, frameId);
    const mainImg = getFrameImageForFrame(canvas, frameId);
    if (!frameObj || !mainImg) return false;
    const geom = getFrameGeometry(frameObj, padRef.current);
    if (!geom) return false;
    const sourceUrl = (mainImg as PbTaggedObject).sourceUrl;
    if (!sourceUrl) return false;
    const { w: naturalWidth, h: naturalHeight } = getFabricImageNaturalSize(mainImg);
    onFrameCropOpenRef.current?.({
      pageId,
      sourceUrl,
      frameWidth: geom.width,
      frameHeight: geom.height,
      naturalWidth,
      naturalHeight,
      crop: { ...getFrameCrop(mainImg) },
      frameId,
    });
    return true;
  }, [finishFrameAdjust, pageId]);
  openFrameCropModalForFrameRef.current = openFrameCropModalForFrame;

  const applyLayoutToCanvas = useCallback(
    (layoutId: string, frameGapEnabled = layoutFrameGapEnabled) => {
      const canvas = fabricRef.current;
      const fabric = fabricModuleRef.current;
      if (!canvas || !fabric) return;
      const normalized = normalizeLayoutId(layoutId) as PbLayoutId;
      const page = getPageSize();
      const innerGap = resolveLayoutInnerGap(frameGapEnabled);
      const layout = getPbLayoutDefinition(normalized, page.widthPx, page.heightPx, innerGap);
      applyPageLayoutToCanvas(canvas, fabric, layout, padRef.current, page);
      schedulePersist();
      canvas.requestRenderAll();
    },
    [layoutFrameGapEnabled, schedulePersist],
  );

  const applyCoverDesignToCanvas = useCallback(
    (designId: string) => {
      const canvas = fabricRef.current;
      const fabric = fabricModuleRef.current;
      if (!canvas || !fabric) return;
      const normalized = normalizeCoverDesignId(designId) as PbCoverDesignId;
      const page = getPageSize();
      const layout = getPbCoverDesignDefinition(normalized, page.widthPx, page.heightPx);
      removeLayoutObjects(canvas);
      applyPageLayout(canvas, fabric, layout, padRef.current, page);
      schedulePersist();
      canvas.requestRenderAll();
    },
    [schedulePersist],
  );

  const placeImageInFrameAtPointInternal = useCallback(
    async (
      url: string,
      event: MouseEvent | DragEvent,
      options?: { fromGallery?: boolean },
    ): Promise<boolean> => {
      const canvas = fabricRef.current;
      const fabric = fabricModuleRef.current;
      if (!canvas || !fabric) return false;
      clearGalleryPreview();
      const pointer = canvas.getScenePoint(event);
      const frame = findFrameAtScenePoint(canvas, pointer.x, pointer.y, padRef.current);
      if (!frame) return false;
      const frameId = getFrameId(frame) ?? '';
      if (isFrameAdjustActive()) {
        finishFrameAdjust(true);
      }
      const img = await placeImageInFrame(canvas, fabric, frame, url, padRef.current);
      if (options?.fromGallery) {
        suppressSelectionReportRef.current = true;
        canvas.discardActiveObject();
        suppressSelectionReportRef.current = false;
      } else {
        canvas.setActiveObject(img);
        syncFrameSelectionHighlight(canvas, img);
        reportSelection(img);
      }
      schedulePersist();
      onImagePlacedRef.current?.(pageId);
      canvas.requestRenderAll();
      return true;
    },
    [clearGalleryPreview, finishFrameAdjust, pageId, reportSelection, schedulePersist],
  );

  const placeImageInFirstEmptyFrameInternal = useCallback(
    async (url: string, options?: { fromGallery?: boolean }): Promise<boolean> => {
      const canvas = fabricRef.current;
      const fabric = fabricModuleRef.current;
      if (!canvas || !fabric) return false;
      const frame = getFirstEmptyFrame(canvas);
      if (!frame) return false;
      const frameId = getFrameId(frame) ?? '';
      const img = await placeImageInFrame(canvas, fabric, frame, url, padRef.current);
      if (options?.fromGallery) {
        suppressSelectionReportRef.current = true;
        canvas.discardActiveObject();
        suppressSelectionReportRef.current = false;
      } else {
        canvas.setActiveObject(img);
        syncFrameSelectionHighlight(canvas, img);
        reportSelection(img);
      }
      schedulePersist();
      onImagePlacedRef.current?.(pageId);
      canvas.requestRenderAll();
      return true;
    },
    [pageId, reportSelection, schedulePersist],
  );

  const placeImageInFrameByIdInternal = useCallback(
    async (frameId: string, url: string, options?: { fromGallery?: boolean }): Promise<boolean> => {
      const canvas = fabricRef.current;
      const fabric = fabricModuleRef.current;
      if (!canvas || !fabric) return false;
      if (isFrameAdjustActive()) {
        finishFrameAdjust(true);
      }
      const result = await placeImageInFrameById(canvas, fabric, frameId, url, padRef.current);
      if (!result) return false;
      if (options?.fromGallery) {
        suppressSelectionReportRef.current = true;
        canvas.discardActiveObject();
        suppressSelectionReportRef.current = false;
      } else {
        canvas.setActiveObject(result);
        syncFrameSelectionHighlight(canvas, result);
        reportSelection(result);
      }
      schedulePersist();
      onImagePlacedRef.current?.(pageId);
      canvas.requestRenderAll();
      return true;
    },
    [finishFrameAdjust, pageId, reportSelection, schedulePersist],
  );

  const refreshDisplayScale = useCallback((opts?: { cssOnly?: boolean; domZoom?: number }) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const domZoom = opts?.domZoom ?? displayScaleRef.current;
    if (opts?.domZoom !== undefined) {
      displayScaleRef.current = domZoom;
    }
    syncCanvasDisplayScale(
      canvas,
      domZoom,
      hostRef.current,
      padRef.current,
      getPageSize(),
      opts,
    );
    if (!cropRectRef.current) {
      syncAllObjectsChrome(canvas, domZoom);
    }
    if (cropRectRef.current && !cropTransformActiveRef.current) {
      applyCropOverlayStyle(
        cropRectRef.current as Parameters<typeof applyCropOverlayStyle>[0],
        domZoom,
      );
      cropRectRef.current.setCoords();
    }
    const active = canvas.getActiveObject();
    if (active && isMultiCanvasSelection(active)) {
      applyActiveSelectionChrome(active as Parameters<typeof applyActiveSelectionChrome>[0], domZoom);
    }
    canvas.requestRenderAll();
  }, []);

  const buildApi = useCallback((): PbCanvasPageApi => {
    const pad = padRef.current;
    const center = pageCenter(pad, getPageSize());
    const page = getPageSize();
    const pageSpan = Math.min(page.widthPx, page.heightPx);
    return {
      addImageFromUrl: async (url, x, y, options) => {
        const cx = x != null ? pad + x : center.x;
        const cy = y != null ? pad + y : center.y;
        await addImageAt(url, cx, cy, options);
      },
      addImageFromScenePoint: (url, sceneX, sceneY) => addImageAt(url, sceneX, sceneY),
      addImageFromClientEvent: async (url, event, options?: { isSticker?: boolean }) => {
        const isSticker = options?.isSticker ?? isPbStickerAssetUrl(url);
        if (!isSticker) {
          const placed = await placeImageInFrameAtPointInternal(url, event, { fromGallery: true });
          if (placed) return;
        }
        const canvas = fabricRef.current;
        if (!canvas) return;
        const pointer = canvas.getScenePoint(event);
        await addImageAt(url, pointer.x, pointer.y, isSticker ? {
          maxSceneDimension: STICKER_INSERT_MAX_SCENE_PX,
          bringToFront: true,
        } : undefined);
      },
      addShape: async (shapeName) => {
        const fabric = fabricModuleRef.current;
        const canvas = fabricRef.current;
        if (!fabric || !canvas) return;
        const obj = createShapeObject(fabric, shapeName, center.x, center.y, pageSpan);
        if (obj) addObject(obj);
      },
      addCustomLine: async (lineType) => {
        const fabric = fabricModuleRef.current;
        const canvas = fabricRef.current;
        if (!fabric || !canvas) return;
        const obj = createCustomLineObject(fabric, lineType, center.x, center.y);
        if (obj) addObject(obj);
      },
      addEmoji: async (emoji) => {
        const fabric = fabricModuleRef.current;
        const canvas = fabricRef.current;
        if (!fabric || !canvas) return;
        const text = new fabric.FabricText(emoji, {
          fontSize: pageSpan * 0.18,
          left: center.x,
          top: center.y,
          originX: 'center',
          originY: 'center',
          fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
          pbKind: 'emoji',
        });
        addObject(text);
        reportSelection(text);
      },
      addCanvasText: async (initialText = 'Your text') => {
        const fabric = fabricModuleRef.current;
        if (!fabric) return;
        const text = new fabric.IText(initialText, {
          fontSize: pageSpan * 0.08,
          fill: '#1f2937',
          left: center.x,
          top: center.y,
          originX: 'center',
          originY: 'center',
          fontFamily: 'Inter, sans-serif',
          objectCaching: false,
          lineHeight: 1.08,
          pbKind: 'text',
        });
        configureNewTextObject(text);
        addObject(text);
        const editable = text as FabricObject & { enterEditing?: () => void; selectAll?: () => void };
        editable.enterEditing?.();
        editable.selectAll?.();
        reportSelection(text);
      },
      addTextPreset: async (presetKind: PbTextPresetKind) => {
        const fabric = fabricModuleRef.current;
        if (!fabric) return;
        const preset = getTextPreset(presetKind);
        const text = new fabric.IText(preset.defaultText, {
          left: center.x,
          top: center.y,
          originX: 'center',
          originY: 'center',
          objectCaching: false,
          lineHeight: 1.08,
          pbKind: 'text',
          pbTextPreset: presetKind,
          fontFamily: preset.style.fontFamily,
          fontSize: preset.style.fontSize,
          fill: preset.style.fill,
          fontWeight: preset.style.bold ? 'bold' : 'normal',
          fontStyle: preset.style.italic ? 'italic' : 'normal',
          underline: preset.style.underline,
          linethrough: preset.style.strikethrough,
          textAlign: preset.style.textAlign,
          opacity: preset.style.opacity,
        });
        configureNewTextObject(text);
        addObject(text);
        const editable = text as FabricObject & { enterEditing?: () => void; selectAll?: () => void };
        editable.enterEditing?.();
        editable.selectAll?.();
        reportSelection(text);
      },
      duplicateActiveObject: duplicateActive,
      toggleLockActiveObject: toggleLockActive,
      setActiveObjectFill: setActiveFill,
      applyActiveTextStyle: applyActiveTextStyle,
      applyActiveObjectStyle: applyActiveObjectStyle,
      cropActiveImage: startCrop,
      applyImageCrop: applyCrop,
      cancelImageCrop: () => {
        cancelCrop({ reselectTarget: true });
      },
      reloadFromData: async (data) => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        isRestoringRef.current = true;
        loadedJsonRef.current = data ? JSON.stringify(data) : '';
        await deserializePageCanvas(canvas, data, padRef.current, fabricModuleRef.current!);
        syncPageChrome(canvas, fabricModuleRef.current!, pageBackgroundColorRef.current, padRef.current, getPageSize());
        syncCanvasDisplayScale(canvas, displayScaleRef.current, hostRef.current, padRef.current, getPageSize());
        canvas.getObjects().forEach((obj) => {
          ensureTextObjectCachingOff(obj);
          if (isTextObject(obj)) refreshTextObjectGeometry(obj);
          ensureShapeObjectProperties(obj);
          if ((obj as any).pbKind === 'line') {
            setupCustomLineObject(obj, fabricModuleRef.current!);
          }
        });
        syncAllObjectsChrome(canvas, displayScaleRef.current);
        restoreFrameImagesAfterLoad(canvas, fabricModuleRef.current!, padRef.current, getPageSize());
        ensureFrameEmptyHintRender(canvas);
        reorderPageLayers(canvas);
        isRestoringRef.current = false;
        canvas.requestRenderAll();
      },
      removeActiveObject: removeActive,
      refreshDisplayScale,
      clearSelection: () => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        suppressSelectionReportRef.current = true;
        hoveredRef.current = null;
        framePointerHoverRef.current = null;
        if (canvas.getActiveObject()) {
          canvas.discardActiveObject();
        }
        syncAllFrameHighlightsRef.current?.(null);
        syncAllObjectsChrome(canvas, displayScaleRef.current);
        setToolbar(null);
        suppressSelectionReportRef.current = false;
        canvas.requestRenderAll();
      },
      applyLayout: (layoutId, frameGapEnabled) => applyLayoutToCanvas(layoutId, frameGapEnabled),
      applyCoverDesign: applyCoverDesignToCanvas,
      placeImageInFirstEmptyFrame: (url) => placeImageInFirstEmptyFrameInternal(url, { fromGallery: true }),
      placeImageInFrameById: (frameId, url) => placeImageInFrameByIdInternal(frameId, url, { fromGallery: true }),
      placeImageInFrameAtPoint: placeImageInFrameAtPointInternal,
      hasFilledFrames: () => {
        const canvas = fabricRef.current;
        return canvas ? hasAnyFilledFrame(canvas) : false;
      },
      openFrameCropModal: () => {
        const canvas = fabricRef.current;
        if (!canvas) return false;
        const active = canvas.getActiveObject();
        if (!active || !isFrameImage(active)) return false;
        const frameId = getFrameId(active) ?? '';
        return openFrameCropModalForFrame(frameId);
      },
      applyFrameAdjust: () => {
        finishFrameAdjust(true);
      },
      cancelFrameAdjust: () => {
        finishFrameAdjust(false);
      },
      setFrameAdjustZoom: (scale: number) => {
        const canvas = fabricRef.current;
        const fabric = fabricModuleRef.current;
        const session = getFrameAdjustSession();
        if (!canvas || !fabric || !session) return;
        updateFrameAdjustCrop(canvas, fabric, { ...session.crop, scale });
        schedulePersist();
      },
      applyFrameCrop: (frameId, crop) => {
        const canvas = fabricRef.current;
        const fabric = fabricModuleRef.current;
        if (!canvas || !fabric) return;
        const img = getFrameImageForFrame(canvas, frameId);
        const frame = canvas.getObjects().find((o) => isImageFrame(o) && getFrameId(o) === frameId);
        if (!img || !frame) return;
        const geom = getFrameGeometry(frame, padRef.current);
        if (!geom) return;
        updateFrameImageCrop(fabric, img, geom, padRef.current, crop);
        schedulePersist();
        canvas.requestRenderAll();
      },
      applyFrameImageStyle: (patch: PbFrameImageStylePatch) => {
        const canvas = fabricRef.current;
        const fabric = fabricModuleRef.current;
        if (!canvas || !fabric) return;
        const active = canvas.getActiveObject();
        if (!active || !isCanvasPlacedImage(active)) return;
        void applyFrameImageStyle(fabric, canvas, active, patch, padRef.current, {
          onFrameBorderTransitionEnd: () => syncAllFrameHighlightsRef.current?.(),
        }).then(() => {
          schedulePersist();
          reportSelection(active);
        });
      },
      captureDocumentSnapshot: () => {
        const canvas = fabricRef.current;
        if (!canvas || isRestoringRef.current || galleryPreviewActiveRef.current) return undefined;
        try {
          return serializePageCanvas(canvas, padRef.current);
        } catch {
          return undefined;
        }
      },
      handleGalleryDragOver: (url, event) => {
        void updateGalleryPreview(url, event);
      },
      handleGalleryDragLeave: () => {
        clearGalleryPreview();
      },
      handleGalleryDrop: async (url, event, options) => {
        clearGalleryPreview();
        const isSticker = options?.isSticker ?? isPbStickerAssetUrl(url);
        if (!isSticker) {
          const placed = await placeImageInFrameAtPointInternal(url, event, { fromGallery: true });
          if (placed) return;
        }
        const canvas = fabricRef.current;
        if (!canvas) return;
        const pointer = canvas.getScenePoint(event);
        await addImageAt(url, pointer.x, pointer.y, isSticker ? {
          maxSceneDimension: STICKER_INSERT_MAX_SCENE_PX,
          bringToFront: true,
        } : undefined);
      },
    };
  }, [
    addImageAt,
    addObject,
    applyActiveTextStyle,
    applyActiveObjectStyle,
    applyCrop,
    applyLayoutToCanvas,
    applyCoverDesignToCanvas,
    beginFrameAdjust,
    duplicateActive,
    finishFrameAdjust,
    openFrameCropModalForFrame,
    pageBackgroundColor,
    pageId,
    placeImageInFirstEmptyFrameInternal,
    placeImageInFrameByIdInternal,
    placeImageInFrameAtPointInternal,
    updateGalleryPreview,
    clearGalleryPreview,
    refreshDisplayScale,
    removeActive,
    reportSelection,
    setActiveFill,
    startCrop,
    toggleLockActive,
  ]);

  const preparePastedObject = useCallback((obj: FabricObject) => {
    ensureShapeObjectProperties(obj);
    ensureTextObjectCachingOff(obj);
    applySelectedChrome(obj);
  }, []);

  const copyActiveObject = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    void copyCanvasSelection(canvas);
  }, []);

  const pasteActiveObject = useCallback(() => {
    const canvas = fabricRef.current;
    const fabric = fabricModuleRef.current;
    if (!canvas || !fabric) return;

    void pasteCanvasClipboard(canvas, fabric, preparePastedObject).then((active) => {
      if (!active) return;
      schedulePersist();
      updateToolbarPosition();
      reportSelection(active);
    });
  }, [preparePastedObject, reportSelection, schedulePersist, updateToolbarPosition]);

  const applyInteractionMode = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (toolMode === 'draw' || toolMode === 'lines') {
      clearGalleryPreview();
      canvas.getObjects().forEach((obj) => {
        if (isFrameImage(obj) && (obj.opacity ?? 1) === 0) {
          obj.set({ opacity: 1, visible: true });
          obj.dirty = true;
        }
      });
    }
    const interactive = !isPreview && !isLocked && isActivePage && toolsActive;
    const canSelect = interactive && toolMode !== 'draw';
    canvas.selection = false;
    canvas.skipTargetFind = !interactive || toolMode === 'draw';
    const enablingDraw = interactive && toolMode === 'draw' && drawPreset !== 'eraser';
    if (enablingDraw && !canvas.isDrawingMode) {
      suppressSelectionFlushRef.current = true;
    }
    canvas.isDrawingMode = enablingDraw;
    if (enablingDraw && suppressSelectionFlushRef.current) {
      requestAnimationFrame(() => {
        suppressSelectionFlushRef.current = false;
        canvas.requestRenderAll();
      });
    }

    if (!interactive) {
      suppressSelectionReportRef.current = true;
      hoveredRef.current = null;
      framePointerHoverRef.current = null;
      if (canvas.getActiveObject()) {
        canvas.discardActiveObject();
      }
      syncAllFrameHighlightsRef.current?.(null);
      suppressSelectionReportRef.current = false;
    }

    const domZoom = displayScaleRef.current;
    const activeObj = canvas.getActiveObject();
    const activeCropRect = cropRectRef.current;
    if (activeCropRect) {
      const cropTarget = cropTargetRef.current;
      lockCanvasObjectsForCrop(canvas, activeCropRect, cropTarget);
      if (!cropTransformActiveRef.current) {
        applyCropOverlayStyle(
          activeCropRect as Parameters<typeof applyCropOverlayStyle>[0],
          domZoom,
        );
      }
      activeCropRect.setCoords();
      if (canvas.getActiveObject() !== activeCropRect) {
        canvas.setActiveObject(activeCropRect);
      }
      const cropBounds = cropImageBoundsRef.current;
      if (cropBounds) {
        syncCropOverlayMovementLock(activeCropRect, cropBounds);
      }
      if (!canSelect || useSidebarEditToolbar) setToolbar(null);
      else updateToolbarPosition();
      enforceTemplateFrameLocks(canvas);
      canvas.requestRenderAll();
      return;
    }
    canvas.forEachObject((obj) => {
      if (isCropOverlay(obj)) {
        const isActiveCrop = cropRectRef.current === obj;
        if (isActiveCrop) {
          obj.set({ selectable: true, evented: true });
          applyCropOverlayStyle(obj as Parameters<typeof applyCropOverlayStyle>[0], domZoom);
          obj.setCoords();
        } else {
          obj.set({
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false,
          });
        }
        return;
      }
      if (isChromeObject(obj)) {
        obj.selectable = false;
        obj.evented = false;
        obj.hasControls = false;
        obj.hasBorders = false;
        return;
      }
      if (isImageFrame(obj) || isFrameImage(obj)) {
        if (isFrameAdjustActive() && isFrameAdjustTarget(obj)) {
          obj.set({
            selectable: canSelect,
            evented: canSelect,
            lockMovementX: true,
            lockMovementY: true,
            lockScalingX: false,
            lockScalingY: false,
            lockRotation: true,
            hasRotatingPoint: false,
            objectCaching: false,
          } as Record<string, unknown>);
          if (canSelect) {
            applySelectedChrome(obj as Parameters<typeof applySelectedChrome>[0], domZoom);
            obj.setCoords();
          }
          return;
        }
        const locked = isObjectLocked(obj);
        const frameFilled = isImageFrame(obj) && !!(obj as PbTaggedObject).pbFrameFilled;
        const frameInteractive = isImageFrame(obj) ? !frameFilled : !locked;
        obj.selectable = canSelect && frameInteractive;
        obj.evented = canSelect && frameInteractive;
        obj.lockMovementX = true;
        obj.lockMovementY = true;
        obj.lockScalingX = true;
        obj.lockScalingY = true;
        obj.lockRotation = true;
        obj.hasControls = false;
        obj.hasBorders = false;
        if (!canSelect) {
          syncObjectChrome(obj, locked ? 'locked' : 'deselected', domZoom);
        } else if (locked && isFrameImage(obj)) {
          syncObjectChrome(obj, 'locked', domZoom);
        } else if (activeObj === obj) {
          if (isFrameImage(obj) && !isFrameAdjustTarget(obj)) {
            syncObjectChrome(obj, 'deselected', domZoom);
          } else {
            syncObjectChrome(obj, isObjectLocked(obj) ? 'locked' : 'selected', domZoom);
          }
        } else {
          syncObjectChrome(obj, 'deselected', domZoom);
        }
        return;
      }
      const locked = isObjectLocked(obj);
      obj.selectable = canSelect;
      obj.evented = canSelect;
      if (!canSelect) {
        syncObjectChrome(obj, locked ? 'locked' : 'deselected', domZoom);
        return;
      }
      if (locked) {
        syncObjectChrome(obj, 'locked', domZoom);
      } else if (activeObj === obj) {
        syncObjectChrome(obj, 'selected', domZoom);
      } else {
        syncObjectChrome(obj, 'deselected', domZoom);
      }
    });

    if (canvas.isDrawingMode) {
      if (!canvas.freeDrawingBrush && fabricModuleRef.current) {
        canvas.freeDrawingBrush = new fabricModuleRef.current.PencilBrush(canvas);
      }
      if (canvas.freeDrawingBrush) {
        const brush = canvas.freeDrawingBrush;
        const alpha = Math.max(0, Math.min(1, (drawPreset === 'highlighter' ? 0.4 : 1) * (drawOpacity / 100)));
        const hex = drawColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        brush.color = `rgba(${r},${g},${b},${alpha})`;
        const defaultWidth = drawPreset === 'highlighter' ? 10 : drawPreset === 'marker' ? 5 : 3.2;
        brush.width = drawWeight > 0 ? drawWeight : defaultWidth;
        const brushCtx = brush as unknown as { globalCompositeOperation?: string };
        brushCtx.globalCompositeOperation = 'source-over';
      }
    } else if (interactive && toolMode === 'draw' && drawPreset === 'eraser') {
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
    }

    syncCanvasDisplayScale(canvas, displayScaleRef.current, hostRef.current, padRef.current, getPageSize());

    if (!canSelect || useSidebarEditToolbar) setToolbar(null);
    else updateToolbarPosition();
    enforceTemplateFrameLocks(canvas);
  }, [
    drawColor,
    drawOpacity,
    drawPreset,
    drawWeight,
    isActivePage,
    isLocked,
    isPreview,
    toolMode,
    toolsActive,
    updateToolbarPosition,
    useSidebarEditToolbar,
    clearGalleryPreview,
  ]);

  applyInteractionModeRef.current = applyInteractionMode;

  useEffect(() => {
    let disposed = false;
    let debugListener: ((e: PointerEvent) => void) | null = null;
    const pad = getPad(extendedSelectArea);
    padRef.current = pad;
    const size = getCanvasPixelSize(pad, getPageSize());

    void loadFabric().then((fabric) => {
      if (disposed || !canvasElRef.current) return;
      fabricModuleRef.current = fabric;
      const canvas = new fabric.Canvas(canvasElRef.current, {
        width: size.width,
        height: size.height,
        selection: false,
        preserveObjectStacking: true,
        backgroundColor: 'transparent',
        targetFindTolerance: 8,
        // Crop pan draws into the pad margin; default skipOffscreen culls objects
        // whose bbox crosses canvas [0,width]×[0,height] (see Object.render → isOnScreen).
        skipOffscreen: false,
      });
      fabricRef.current = canvas;
      installFrameImageTargetHitTest(canvas);

      const debugOutsideHitbox = () => {
        const upper = canvas.upperCanvasEl;
        const lower = canvas.lowerCanvasEl;

        console.log('[FABRIC HITBOX]', {
          upperRect: upper?.getBoundingClientRect(),
          lowerRect: lower?.getBoundingClientRect(),
          upperStyle: upper
            ? {
                width: upper.style.width,
                height: upper.style.height,
                pointerEvents: getComputedStyle(upper).pointerEvents,
                position: getComputedStyle(upper).position,
                zIndex: getComputedStyle(upper).zIndex,
              }
            : null,
        });
      };

      debugOutsideHitbox();

      debugListener = (e: PointerEvent) => {
        const target = document.elementFromPoint(e.clientX, e.clientY);

        console.log('[OUTSIDE POINTER DOWN]', {
          clientX: e.clientX,
          clientY: e.clientY,
          target,
          targetClass: (target as HTMLElement | null)?.className,
          isUpperCanvas: target === canvas.upperCanvasEl,
          upperRect: canvas.upperCanvasEl?.getBoundingClientRect(),
        });
      };

      document.addEventListener('pointerdown', debugListener, true);

      registerPbFabricCanvas(pageId, canvas);
      onFabricCanvasReady?.(canvas);

      let eraserDragging = false;

      const canUseDrawEraser = () =>
        toolModeRef.current === 'draw' &&
        drawPresetRef.current === 'eraser' &&
        !isPreviewRef.current &&
        !isLockedRef.current &&
        toolsActiveRef.current &&
        isActivePageRef.current;

      const getDrawEraserRadius = () => {
        const weight = drawWeightRef.current > 0 ? drawWeightRef.current : 14;
        return Math.max(6, weight / 2);
      };

      const runDrawEraserAtEvent = (e: { e: Parameters<Canvas['getScenePoint']>[0] }) => {
        if (!canUseDrawEraser()) return false;
        const pointer = canvas.getScenePoint(e.e);
        const removed = eraseDrawObjectsAtPoint(canvas, pointer, getDrawEraserRadius());
        if (removed.length > 0) {
          schedulePersist();
          canvas.requestRenderAll();
        }
        return true;
      };

      const clearAlignGuides = () => {
        if (!alignGuidesRef.current.vertical && !alignGuidesRef.current.horizontal) return;
        alignGuidesRef.current = { vertical: false, horizontal: false };
        canvas.requestRenderAll();
      };

      canvas.on('after:render', (opt) => {
        const ctx = opt.ctx;
        const activeObj = canvas.getActiveObject();
        const isDrawingActive = toolModeRef.current === 'draw' || toolModeRef.current === 'lines';

        if (!isDrawingActive) {
          const marqueePreviewActive = isMarqueeDragActive() && getMarqueeDragPageId() === pageId;
          if (marqueePreviewActive) {
            getMarqueeDragPreviewObjects().forEach((obj) => {
              if (activeObj !== obj) {
                drawHoverOutline(ctx, obj);
              }
            });
          } else {
            const hovered = hoveredRef.current;
            if (
              hovered &&
              activeObj !== hovered &&
              !isImageFrame(hovered) &&
              !isFrameImage(hovered)
            ) {
              drawHoverOutline(ctx, hovered);
            }
          }
        }

        drawCenterAlignGuides(ctx, padRef.current, alignGuidesRef.current, getPageSize());

        const cropRect = cropRectRef.current;
        if (cropRect) {
          const coords = getCropGridCoords(cropRect);
          if (coords) drawCropGrid(ctx, coords);
        }
      });

      const syncAllFrameHighlights = (target?: FabricObject | null) => {
        const active = target ?? canvas.getActiveObject();
        getFrameObjects(canvas).forEach((f) => {
          if (isFrameTargetSelected(canvas, f, active)) {
            highlightFrame(f, 'selected', canvas);
          } else if (framePointerHoverRef.current === f) {
            highlightFrame(f, 'hover', canvas);
          } else {
            highlightFrame(f, false, canvas);
          }
        });
      };
      syncAllFrameHighlightsRef.current = syncAllFrameHighlights;

      const resolveFrameFromTarget = (target: FabricObject | null): FabricObject | null => {
        if (!target) return null;
        if (isImageFrame(target)) return target;
        if (isFrameImage(target)) {
          const frameId = getFrameId(target) ?? '';
          return getFrameById(canvas, frameId);
        }
        return null;
      };

      const syncFramePointerHover = (target: FabricObject | null) => {
        const hoverFrame = resolveFrameFromTarget(target);
        if (framePointerHoverRef.current === hoverFrame) return;
        framePointerHoverRef.current = hoverFrame;
        syncAllFrameHighlights();
      };

      const syncHoverFromEvent = (e: { e: Parameters<Canvas['findTarget']>[0] }) => {
        const isDrawingActive = toolModeRef.current === 'draw' || toolModeRef.current === 'lines';
        if (isDrawingActive || isMarqueeDragActive()) {
          if (hoveredRef.current !== null) {
            hoveredRef.current = null;
            framePointerHoverRef.current = null;
            syncAllFrameHighlights();
            canvas.requestRenderAll();
          }
          return;
        }
        const next = resolveHoverTarget(canvas, e.e);
        if (hoveredRef.current !== next) {
          hoveredRef.current = next;
          syncFramePointerHover(next);
          canvas.requestRenderAll();
        }
      };

      canvas.on('mouse:move', (e) => {
        if (eraserDragging && runDrawEraserAtEvent(e)) {
          return;
        }
        if (isFrameAdjustDragging()) {
          const pointer = canvas.getScenePoint(e.e);
          if (handleFrameAdjustPointerMove(canvas, fabric, pointer.x, pointer.y)) {
            canvas.requestRenderAll();
          }
        }
        syncHoverFromEvent(e);
      });
      canvas.on('mouse:over', syncHoverFromEvent);

      canvas.on('mouse:out', () => {
        if (hoveredRef.current || framePointerHoverRef.current) {
          hoveredRef.current = null;
          framePointerHoverRef.current = null;
          syncAllFrameHighlights();
          canvas.requestRenderAll();
        }
      });

      canvas.on('text:editing:entered', (e) => {
        updateToolbarPosition();
      });

      canvas.on('text:editing:exited', (e) => {
        const target = e.target;
        if (!target || !isTextObject(target) || isObjectLocked(target)) return;
        syncObjectChrome(target, resolveObjectChromeState(target, canvas));
        scheduleRepaintTextLikeObjectModified(target, canvas, true);
        syncCanvasDisplayScale(canvas, displayScaleRef.current, hostRef.current, padRef.current, getPageSize());
        updateToolbarPosition();
      });

      canvas.on('text:changed', (e) => {
        const target = e.target;
        if (target && isTextObject(target)) {
          reportSelection(target);
        }
      });

      const filterMultiSelectMembers = (members: FabricObject[]) =>
        members.filter((o) => {
          if (isImageFrame(o)) return false;
          if (isFrameImage(o) && !isFrameAdjustTarget(o)) return false;
          return true;
        });

      const sanitizeSelectionTarget = (target?: FabricObject): FabricObject | undefined => {
        if (!target || !isMultiCanvasSelection(target)) return target;
        const members = target.getObjects();
        const filtered = filterMultiSelectMembers(members);
        if (filtered.length === members.length) return target;
        canvas.discardActiveObject();
        if (filtered.length === 1) {
          canvas.setActiveObject(filtered[0]);
          return filtered[0];
        }
        if (filtered.length > 1) {
          const next = new fabric.ActiveSelection(filtered, { canvas });
          applyActiveSelectionChrome(next, displayScaleRef.current);
          canvas.setActiveObject(next);
          return next;
        }
        return undefined;
      };

      const shouldSkipSelectionFlush = () =>
        suppressSelectionFlushRef.current ||
        !!cropRectRef.current ||
        toolModeRef.current === 'draw' ||
        toolModeRef.current === 'lines' ||
        canvas.isDrawingMode;

      const reselectCropOverlay = (skipStyleRefresh = false) => {
        const cropRect = cropRectRef.current;
        if (!cropRect) return;
        suppressSelectionFlushRef.current = true;
        suppressSelectionReportRef.current = true;
        pinCropOverlaySelection(
          canvas,
          cropRect,
          displayScaleRef.current,
          skipStyleRefresh || cropTransformActiveRef.current,
        );
        suppressSelectionFlushRef.current = false;
        suppressSelectionReportRef.current = false;
        canvas.requestRenderAll();
      };

      const onSelectionChange = (rawTarget?: FabricObject) => {
        const cropRect = cropRectRef.current;
        if (cropRect) {
          if (rawTarget !== cropRect && !cropTransformActiveRef.current) {
            reselectCropOverlay();
          }
          return;
        }
        const target = sanitizeSelectionTarget(rawTarget);
        const domZoom = displayScaleRef.current;
        if (target && hoveredRef.current === target) hoveredRef.current = null;
        const multiMembers =
          target && isMultiCanvasSelection(target) ? target.getObjects() : null;
        canvas.getObjects().forEach((obj) => {
          if (isChromeObject(obj) || isCropOverlay(obj) || isImageFrame(obj)) return;
          const inMulti = multiMembers?.includes(obj) ?? false;
          if (target === obj || inMulti) {
            if (inMulti) {
              applyMultiSelectMemberChrome(obj, domZoom);
            } else if (isFrameImage(obj) && !isFrameAdjustTarget(obj)) {
              syncObjectChrome(obj, 'deselected', domZoom);
            } else {
              syncObjectChrome(obj, isObjectLocked(obj) ? 'locked' : 'selected', domZoom);
            }
          } else {
            syncObjectChrome(obj, isObjectLocked(obj) ? 'locked' : 'deselected', domZoom);
          }
        });
        if (target && isMultiCanvasSelection(target)) {
          applyActiveSelectionChrome(target, domZoom);
        }
        if (target && isCropOverlay(target)) {
          applyCropOverlayStyle(target as Parameters<typeof applyCropOverlayStyle>[0], domZoom);
          target.setCoords();
        }
        updateToolbarPosition();
        reportSelection(target);
        setRotateHint(null);
        setIsRotating(false);
        if (shouldSkipSelectionFlush()) {
          canvas.getObjects().forEach((obj) => {
            obj.dirty = true;
          });
          canvas.requestRenderAll();
        } else {
          flushCanvasAfterSelectionChange(
            canvas,
            fabric,
            pageBackgroundColorRef.current,
            padRef.current,
            getPageSize(),
            {
              hostEl: hostRef.current,
              displayScale: displayScaleRef.current,
              logLabel: target ? 'selection:created/updated' : 'selection',
            },
          );
        }
        enforceTemplateFrameLocks(canvas);
        syncAllFrameHighlights(target);
      };

      canvas.on('selection:created', (e) => {
        onSelectionChange(e.selected?.[0]);
      });

      canvas.on('selection:updated', (e) => {
        onSelectionChange(e.selected?.[0]);
      });

      canvas.on('selection:cleared', () => {
        const cropRect = cropRectRef.current;
        if (cropRect && !cropTransformActiveRef.current) {
          reselectCropOverlay();
          return;
        }
        clearAlignGuides();
        syncAllObjectsChrome(canvas, displayScaleRef.current);
        setToolbar(null);
        setRotateHint(null);
        setIsRotating(false);
        reportSelection(undefined);
        if (shouldSkipSelectionFlush()) {
          canvas.getObjects().forEach((obj) => {
            obj.dirty = true;
          });
          canvas.requestRenderAll();
        } else {
          flushCanvasAfterSelectionChange(
            canvas,
            fabric,
            pageBackgroundColorRef.current,
            padRef.current,
            getPageSize(),
            {
              hostEl: hostRef.current,
              displayScale: displayScaleRef.current,
              rebakeText: true,
              logLabel: 'selection:cleared',
            },
          );
        }
        enforceTemplateFrameLocks(canvas);
        framePointerHoverRef.current = null;
        syncAllFrameHighlights(null);
      });

      canvas.on('object:moving', (e) => {
        const target = e.target;
        if (target && isCropOverlay(target)) {
          const transform = (canvas as Canvas & { _currentTransform?: { action?: string } | null })
            ._currentTransform;
          const action = transform?.action ?? '';
          if (action.includes('scale')) {
            cropTransformActiveRef.current = true;
            return;
          }
          cropTransformActiveRef.current = true;
          const bounds = cropImageBoundsRef.current;
          if (bounds) {
            clampCropOverlayPosition(target, bounds);
          }
          return;
        }
        if (target && isFrameAdjustTarget(target)) {
          return;
        }
        if (
          !target ||
          isChromeObject(target) ||
          isCropOverlay(target) ||
          isImageFrame(target) ||
          (isFrameImage(target) && !isFrameAdjustTarget(target)) ||
          isObjectLocked(target)
        ) {
          clearAlignGuides();
          return;
        }
        const snap = computeCenterAlignSnap(target, padRef.current, getPageSize());
        applyCenterAlignSnap(target, snap);
        const next = { vertical: snap.vertical, horizontal: snap.horizontal };
        if (
          alignGuidesRef.current.vertical !== next.vertical ||
          alignGuidesRef.current.horizontal !== next.horizontal
        ) {
          alignGuidesRef.current = next;
          canvas.requestRenderAll();
        }
      });

      canvas.on('object:scaling', (e) => {
        const target = e.target;
        if (target && isCropOverlay(target)) {
          cropTransformActiveRef.current = true;
          const bounds = cropImageBoundsRef.current;
          if (bounds) {
            constrainCropOverlayDuringTransform(target, bounds);
          }
          return;
        }
        if (target && isFrameAdjustTarget(target)) {
          handleFrameAdjustScaling(canvas, fabric, target);
        }
      });

      canvas.on('object:modified', (e) => {
        clearAlignGuides();
        clearFrameAdjustScaleGesture();
        const target = e.target;
        if (!target) return;
        if (isCropOverlay(target)) {
          cropTransformActiveRef.current = false;
          const scaleX = target.scaleX ?? 1;
          const scaleY = target.scaleY ?? 1;
          if (scaleX !== 1 || scaleY !== 1) {
            const rect = target as FabricObject & { width?: number; height?: number };
            rect.set({
              width: Math.max(24, (rect.width ?? 0) * scaleX),
              height: Math.max(24, (rect.height ?? 0) * scaleY),
              scaleX: 1,
              scaleY: 1,
            });
          }
          const bounds = cropImageBoundsRef.current;
          if (bounds) {
            clampCropOverlayToImage(target, bounds);
          }
          applyCropOverlayStyle(target as Parameters<typeof applyCropOverlayStyle>[0], displayScaleRef.current);
          if (bounds) {
            syncCropOverlayMovementLock(target, bounds);
          }
          target.setCoords();
          canvas.requestRenderAll();
          return;
        }
        if (isFrameAdjustTarget(target)) {
          schedulePersist();
          return;
        }
        ensureShapeObjectProperties(target);
        applyPbRotationSnap(target);

        const type = (target.type ?? '').toLowerCase();
        if (
          type === 'rect' ||
          type === 'circle' ||
          type === 'ellipse' ||
          type === 'triangle' ||
          type === 'polygon'
        ) {
          const scaleX = target.scaleX ?? 1;
          const scaleY = target.scaleY ?? 1;

          if (scaleX !== 1 || scaleY !== 1) {
            // Guarantee that old objects loaded from documents get uniform stroke rendering
            if (target.strokeUniform !== true) {
              target.set({ strokeUniform: true });
            }

            if (type === 'rect') {
              const rect = target as any;
              rect.set({
                width: Math.max(5, (rect.width ?? 0) * scaleX),
                height: Math.max(5, (rect.height ?? 0) * scaleY),
                scaleX: 1,
                scaleY: 1,
              });
            } else if (type === 'ellipse') {
              const ellipse = target as any;
              ellipse.set({
                rx: Math.max(2, (ellipse.rx ?? 0) * scaleX),
                ry: Math.max(2, (ellipse.ry ?? 0) * scaleY),
                scaleX: 1,
                scaleY: 1,
              });
            } else if (type === 'circle') {
              const circle = target as any;
              const factor = Math.abs(scaleX - 1) > Math.abs(scaleY - 1) ? scaleX : scaleY;
              circle.set({
                radius: Math.max(2, (circle.radius ?? 0) * factor),
                scaleX: 1,
                scaleY: 1,
              });
            } else if (type === 'triangle') {
              const triangle = target as any;
              triangle.set({
                width: Math.max(5, (triangle.width ?? 0) * scaleX),
                height: Math.max(5, (triangle.height ?? 0) * scaleY),
                scaleX: 1,
                scaleY: 1,
              });
            } else if (type === 'polygon') {
              const polygon = target as any;
              if (polygon.points) {
                polygon.points = polygon.points.map((pt: any) => ({
                  x: pt.x * scaleX,
                  y: pt.y * scaleY,
                }));
              }
              polygon.set({
                scaleX: 1,
                scaleY: 1,
              });
            }
            target.setCoords();
            canvas.requestRenderAll();
          }
        }

        if (target && isTextObject(target)) {
          rebakeTextAfterInteraction(target, canvas);
        }
        schedulePersist();
        updateToolbarPosition();
        reportSelection(target);
        setRotateHint(null);
        setIsRotating(false);
      });

      canvas.on('object:rotating', (e) => {
        const target = e.target;
        if (!target) return;
        if (isFrameAdjustTarget(target)) return;
        if (applyPbRotationSnap(target)) {
          canvas.requestRenderAll();
        }
        setIsRotating(true);
        setRotateHint(getRotateHintPosition(target, hostRef.current, displayScaleRef.current));
      });

      canvas.on('path:created', (e) => {
        const path = e.path;
        if (path) {
          (path as FabricObject & { pbKind?: string }).pbKind = 'draw';
          styleObject(path);
        }
        canvas.getObjects().forEach((obj) => {
          if (!isChromeObject(obj) && !isCropOverlay(obj)) {
            obj.dirty = true;
          }
        });
        schedulePersist();
        canvas.requestRenderAll();
      });

      canvas.on('mouse:dblclick', (opt) => {
        const target = opt.target;
        if (!target || !isFrameImage(target)) return;
        if (
          isFrameAdjustActive() ||
          galleryDropActiveRef.current ||
          galleryDragUrlRef.current ||
          isMarqueeDragActive() ||
          isPreviewRef.current ||
          isLockedRef.current ||
          !toolsActiveRef.current ||
          toolModeRef.current === 'draw' ||
          toolModeRef.current === 'lines'
        ) {
          return;
        }
        const frameId = getFrameId(target) ?? '';
        if (!frameId) return;
        openFrameCropModalForFrameRef.current(frameId);
      });

      canvas.on('mouse:down', (opt) => {
        if (isFrameAdjustActive()) {
          const adjustTarget = opt.target;
          if (isFrameAdjustTarget(adjustTarget)) {
            const transform = (canvas as Canvas & { _currentTransform?: { action?: string } | null })
              ._currentTransform;
            const action = transform?.action;
            if (action !== 'scale' && action !== 'scaleX' && action !== 'scaleY') {
              const pointer = canvas.getScenePoint(opt.e);
              handleFrameAdjustPointerDown(pointer.x, pointer.y);
            }
          } else if (!isFrameAdjustTarget(adjustTarget)) {
            finishFrameAdjust(true);
          }
        }

        const cropRect = cropRectRef.current;
        if (cropRect) {
          if (opt.target === cropRect) {
            return;
          }
          if (!opt.target) {
            reselectCropOverlay();
            return;
          }
          reselectCropOverlay();
          return;
        }

        const isDrawingActive =
          (toolModeRef.current === 'draw' && drawPresetRef.current !== 'eraser') ||
          toolModeRef.current === 'lines' ||
          canvas.isDrawingMode;

        if (canUseDrawEraser()) {
          eraserDragging = true;
          runDrawEraserAtEvent(opt);
          if (canvas.upperCanvasEl && opt.e && 'pointerId' in opt.e) {
            try {
              canvas.upperCanvasEl.setPointerCapture((opt.e as PointerEvent).pointerId);
            } catch {
              // Ignore
            }
          }
          if (!isActivePageRef.current && !isPreviewRef.current && !isLockedRef.current) {
            onActivatePageRef.current?.();
          }
          return;
        }

        if (isDrawingActive) {
          canvas.getObjects().forEach((obj) => {
            if (!isChromeObject(obj) && !isCropOverlay(obj)) {
              obj.dirty = true;
            }
          });
          canvas.requestRenderAll();
          if (canvas.upperCanvasEl && opt.e && 'pointerId' in opt.e) {
            try {
              canvas.upperCanvasEl.setPointerCapture((opt.e as PointerEvent).pointerId);
            } catch {
              // Ignore
            }
          }
          if (!isActivePageRef.current && !isPreviewRef.current && !isLockedRef.current) {
            onActivatePageRef.current?.();
          }
          return;
        }

        const pointer = canvas.getScenePoint(opt.e);
        const frameAtPoint = findFrameAtScenePoint(canvas, pointer.x, pointer.y, padRef.current);
        const active = canvas.getActiveObject();
        const activeIsFrame =
          !!active &&
          !isFrameAdjustActive() &&
          (isImageFrame(active) || isFrameImage(active));

        if (!frameAtPoint && activeIsFrame) {
          canvas.discardActiveObject();
          framePointerHoverRef.current = null;
          syncAllFrameHighlights(null);
          reportSelection(undefined);
          onCanvasBackgroundClickRef.current?.();
          canvas.requestRenderAll();
          return;
        }

        if (canvas.upperCanvasEl && opt.e && 'pointerId' in opt.e) {
          try {
            canvas.upperCanvasEl.setPointerCapture((opt.e as any).pointerId);
          } catch {
            // Ignore
          }
        }

        if (!isActivePageRef.current && !isPreviewRef.current && !isLockedRef.current) {
          onActivatePageRef.current?.();
        }

        const target = opt.target;
        if (target && !isChromeObject(target)) return;

        if (!target || isChromeObject(target)) {
          if (cropRectRef.current) {
            reselectCropOverlay();
            return;
          }
          canvas.discardActiveObject();
          framePointerHoverRef.current = null;
          syncAllFrameHighlights(null);
          canvas.requestRenderAll();
          onCanvasBackgroundClickRef.current?.();
        }
      });

      canvas.on('mouse:move', (opt) => {
        const draft = lineDraftRef.current;
        if (draft) {
          const pointer = canvas.getScenePoint(opt.e);
          console.log('Fabric mouse:move (line drawing). pointer:', pointer);
          draft.set({ x2: pointer.x, y2: pointer.y });
          draft.setCoords();
          canvas.requestRenderAll();
          return;
        }
      });

      canvas.on('mouse:up', (opt) => {
        eraserDragging = false;
        if (
          opt.isClick &&
          opt.target &&
          isImageFrame(opt.target) &&
          !(opt.target as PbTaggedObject).pbFrameFilled &&
          !isFrameAdjustActive() &&
          !galleryDropActiveRef.current &&
          !galleryDragUrlRef.current &&
          !isMarqueeDragActive() &&
          !isPreviewRef.current &&
          !isLockedRef.current &&
          toolsActiveRef.current &&
          toolModeRef.current !== 'draw' &&
          toolModeRef.current !== 'lines'
        ) {
          syncAllFrameHighlights(opt.target);
          reportSelection(opt.target);
        }
        if (
          opt.isClick &&
          opt.target &&
          isFrameImage(opt.target) &&
          !isFrameAdjustActive() &&
          !galleryDropActiveRef.current &&
          !galleryDragUrlRef.current &&
          !isMarqueeDragActive() &&
          !isPreviewRef.current &&
          !isLockedRef.current &&
          toolsActiveRef.current &&
          toolModeRef.current !== 'draw' &&
          toolModeRef.current !== 'lines'
        ) {
          syncAllFrameHighlights(opt.target);
          reportSelection(opt.target);
        }
        if (isFrameAdjustDragging()) {
          handleFrameAdjustPointerUp();
          schedulePersist();
        }
        if (canvas.upperCanvasEl && opt?.e && 'pointerId' in opt.e) {
          try {
            canvas.upperCanvasEl.releasePointerCapture((opt.e as any).pointerId);
          } catch {
            // Ignore
          }
        }
        clearAlignGuides();
        setIsRotating(false);

        const draft = lineDraftRef.current;
        if (!draft) return;
        lineDraftRef.current = null;
        styleObject(draft);
        draft.set({ selectable: true, evented: true });
        canvas.setActiveObject(draft);
        schedulePersist();
        reportSelection(draft);
        updateToolbarPosition();
      });

      syncPageChrome(canvas, fabric, pageBackgroundColorRef.current, pad, getPageSize());
      syncCanvasDisplayScale(canvas, displayScaleRef.current, hostRef.current, pad, getPageSize());
      onRegisterApiRef.current(pageId, buildApi());
      applyInteractionMode();

      if (documentData && canvasHasUserContent(documentData)) {
        isRestoringRef.current = true;
        loadedJsonRef.current = JSON.stringify(documentData);
        void deserializePageCanvas(canvas, documentData, pad, fabric).then(() => {
          syncPageChrome(canvas, fabric, pageBackgroundColorRef.current, pad, getPageSize());
          canvas.getObjects().forEach((obj) => {
            ensureTextObjectCachingOff(obj);
            ensureShapeObjectProperties(obj);
            if ((obj as any).pbKind === 'line') {
              setupCustomLineObject(obj, fabric);
            }
          });
          syncAllObjectsChrome(canvas, displayScaleRef.current);
          restoreFrameImagesAfterLoad(canvas, fabric, pad, getPageSize());
          ensureFrameEmptyHintRender(canvas);
          reorderPageLayers(canvas);
          isRestoringRef.current = false;
          canvas.requestRenderAll();
        });
      }
    });

    return () => {
      disposed = true;
      onRegisterApiRef.current(pageId, null);
      if (debugListener) {
        document.removeEventListener('pointerdown', debugListener, true);
      }
      const canvas = fabricRef.current;
      if (canvas) {
        syncAllFrameHighlightsRef.current = null;
        clearFrameBorderToggleTransitions(canvas);
        unregisterPbFabricCanvas(pageId);
        canvas.dispose();
        fabricRef.current = null;
      }
    };
  }, [pageId]);

  useEffect(() => {
    onRegisterApiRef.current(pageId, buildApi());
  }, [buildApi, pageId]);

  useEffect(() => {
    applyInteractionMode();
  }, [applyInteractionMode]);

  useEffect(() => {
    const canvas = fabricRef.current;
    const fabric = fabricModuleRef.current;
    if (!canvas || !fabric) return;
    syncPageChrome(canvas, fabric, pageBackgroundColorRef.current, padRef.current, getPageSize());
    canvas.requestRenderAll();
  }, [pageBackgroundColor]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || isRestoringRef.current) return;
    if (!documentData) return;
    const key = JSON.stringify(documentData);
    if (key === loadedJsonRef.current) return;
    isRestoringRef.current = true;
    loadedJsonRef.current = key;
    void deserializePageCanvas(canvas, documentData, padRef.current, fabricModuleRef.current!).then(() => {
      syncPageChrome(canvas, fabricModuleRef.current!, pageBackgroundColorRef.current, padRef.current, getPageSize());
      canvas.getObjects().forEach((obj) => {
        ensureTextObjectCachingOff(obj);
        ensureShapeObjectProperties(obj);
        if ((obj as any).pbKind === 'line') {
          setupCustomLineObject(obj, fabricModuleRef.current!);
        }
      });
      syncAllObjectsChrome(canvas, displayScaleRef.current);
      restoreFrameImagesAfterLoad(canvas, fabricModuleRef.current!, padRef.current, getPageSize());
      ensureFrameEmptyHintRender(canvas);
      reorderPageLayers(canvas);
      isRestoringRef.current = false;
      canvas.requestRenderAll();
    });
  }, [documentData, pageBackgroundColor]);

  useEffect(() => {
    const canvas = fabricRef.current;
    const fabric = fabricModuleRef.current;
    if (!canvas || !fabric || isRestoringRef.current) return;
    if (!pageLayoutId) return;
    if (documentData && canvasHasUserContent(documentData)) return;
    const normalized = normalizeLayoutId(pageLayoutId);
    if (normalized === 'blank') {
      if (canvas.getObjects().some(isImageFrame)) {
        removeLayoutObjects(canvas);
        schedulePersist();
        canvas.requestRenderAll();
      }
      return;
    }
    const hasFrames = canvas.getObjects().some(isImageFrame);
    if (!hasFrames) {
      applyLayoutToCanvas(normalized);
    }
  }, [applyLayoutToCanvas, pageLayoutId, layoutFrameGapEnabled, schedulePersist, documentData]);

  useEffect(() => {
    const canvas = fabricRef.current;
    const fabric = fabricModuleRef.current;
    if (!canvas || !fabric || isRestoringRef.current) return;
    if (!pageLayoutId) return;
    const normalized = normalizeLayoutId(pageLayoutId);
    if (normalized === 'blank') return;
    if (!canvas.getObjects().some(isImageFrame)) return;
    applyLayoutToCanvas(normalized, layoutFrameGapEnabled);
  }, [applyLayoutToCanvas, layoutFrameGapEnabled, pageLayoutId]);

  useEffect(() => {
    const canvas = fabricRef.current;
    const fabric = fabricModuleRef.current;
    if (!canvas || !fabric || isRestoringRef.current) return;
    if (!coverDesignId) return;
    if (documentData && canvasHasUserContent(documentData)) return;
    const normalized = normalizeCoverDesignId(coverDesignId);
    const hasFrames = canvas.getObjects().some(isImageFrame);
    if (!hasFrames) {
      applyCoverDesignToCanvas(normalized);
    }
  }, [applyCoverDesignToCanvas, coverDesignId, schedulePersist, documentData]);

  useEffect(() => {
    if (!galleryDragUrl) {
      clearGalleryPreview();
    }
  }, [clearGalleryPreview, galleryDragUrl]);

  useEffect(() => {
    refreshDisplayScale({ cssOnly: isPreviewRef.current });
  }, [displayScale, pageWidthPx, pageHeightPx, refreshDisplayScale]);

  useEffect(() => {
    if (!fabricRef.current) return;
    refreshDisplayScale({ cssOnly: isPreview });
  }, [isPreview, extendedSelectArea, refreshDisplayScale]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setFrameEmptyHintsVisible(canvas, !isPreview);
    canvas.requestRenderAll();
  }, [isPreview]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const page = getPageSize();
      const pad = padRef.current;
      const designW = page.widthPx + pad * 2;
      const domZoom =
        host.clientWidth > 0 && designW > 0
          ? host.clientWidth / designW
          : displayScaleRef.current;
      const cssOnly =
        isPreviewRef.current ||
        Math.abs(domZoom - displayScaleRef.current) > 0.001;
      syncCanvasDisplayScale(canvas, domZoom, host, pad, page, { cssOnly });
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, [pageId, pageWidthPx, pageHeightPx]);

  useEffect(() => {
    if (!isActivePage || isPreview || isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is editing inside standard DOM input fields
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"], emoji-picker')
      ) {
        return;
      }

      // Ignore if currently editing a text object in Fabric.js
      const canvas = fabricRef.current;
      if (canvas) {
        const active = canvas.getActiveObject();
        if (active && (active as any).isEditing) {
          return;
        }
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd) {
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          copyActiveObject();
        } else if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          pasteActiveObject();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActivePage, isPreview, isLocked, copyActiveObject, pasteActiveObject]);

  const scaledPageWidthPx = pageWidthPx * displayScale;
  const scaledPageHeightPx = pageHeightPx * displayScale;
  const scaledSelectPadPx = FABRIC_SELECT_PAD * displayScale;

  const hostClass = [
    styles.pbFabricCanvasHost,
    extendedSelectArea ? styles.pbFabricCanvasHostExtended : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.pbCanvasZoomSurface}>
      <div
        ref={hostRef}
        className={hostClass}
        style={{
          ['--pb-page-width-px' as string]: `${scaledPageWidthPx}px`,
          ['--pb-page-height-px' as string]: `${scaledPageHeightPx}px`,
          ['--pb-fabric-select-pad' as string]: `${scaledSelectPadPx}px`,
        }}
      >
        <canvas ref={canvasElRef} className={styles.pbFabricCanvas} />
        {rotateHint && isRotating ? (
          <div
            className={styles.pbFabricRotateHint}
            style={{ top: rotateHint.top, left: rotateHint.left }}
          >
            {rotateHint.degrees}°
          </div>
        ) : null}
      </div>
    </div>
  );
}
