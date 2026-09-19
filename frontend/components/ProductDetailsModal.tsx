'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, Fragment, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { PbFabricPageApi, PbFabricSerialized, PbFabricTextStyle, PbFabricObjectEditMeta } from './photobook/canvas';
import { pbFabricHasObjects } from './photobook/canvas';
import { getPbFabricCanvas } from './photobook/canvas/pbFabricCanvasRegistry';
import gsap from 'gsap';
import { triggerSparkleBurst } from '@/lib/utils/sparkleBurst';
import {
  beginMarqueeDrag,
  clearMarqueeDragPreview,
  findCanvasUnderPointer,
  findFabricUserTarget,
  findNearestPageCanvas,
  finishFabricSelection,
  hasCropOverlayOnCanvas,
  isPointerOnCropOverlay,
  isPointerOutsideAllCanvases,
  isPointerOverCanvas,
  updateMarqueeDragPreview,
} from './photobook/canvas/workspaceMarquee';
import PbGlobalMarqueePortal, {
  type PbGlobalMarqueeVisualState,
} from './photobook/canvas/PbGlobalMarqueePortal';
import { getFabricScenePointer, normalizeSceneRect, type ScenePoint } from './photobook/canvas/fabricScenePointer';

const PbCanvasPage = dynamic(
  () => import('./photobook/canvas/PbCanvasPage').then((m) => m.default),
  { ssr: false },
);
import { getObjectEditMeta } from './photobook/canvas/objectMeta';
import {
  computePbInitialFitZoomPercent,
  PB_ZOOM_MIN_PERCENT,
  refinePbFitZoomFromBlockMeasure,
} from './photobook/canvas/photobookZoom';
import PbEditSidebarPanel, { type PbEditHoverTarget } from './photobook/PbEditSidebarPanel';
import PbColorPicker from './photobook/PbColorPicker';
import PbThumbScrollbar from './photobook/PbThumbScrollbar';
import PbLayoutPickerGrid from './photobook/PbLayoutPickerGrid';
import PbCoverDesignPickerGrid from './photobook/PbCoverDesignPickerGrid';
import PbFrameCropModal from './photobook/PbFrameCropModal';
import StickerSidebar from './photobook/stickers/StickerSidebar';
import { STICKER_INSERT_MAX_SCENE_PX, type StickerAsset } from '@/lib/photobook/stickers';
import PhotobookLoginModal from './photobook/PhotobookLoginModal';
import PbEditorHelpPanel from './photobook/PbEditorHelpPanel';
import { photobookApi } from '@/lib/api/photobook';
import {
  persistPhotobookProject,
  hydrateUploadedImagesFromProject,
  type PbUploadedImageEntry,
} from '@/lib/photobook/projectPersistence';
import type { PhotobookProjectJson, PhotobookProjectRecord } from '@/lib/photobook/projectTypes';
import { exportPhotobookPagesForFlipbookPreview } from '@/lib/photobook/canvasExport';
import type { PbFrameCrop } from './photobook/canvas/frameMeta';
import { normalizeLayoutId, type PbLayoutId, layoutHasMultipleFrames } from './photobook/canvas/layouts';
import { normalizeCoverDesignId, type PbCoverDesignId } from './photobook/canvas/coverDesigns';
import { Product, ProductVariation, ProductReview } from '@/types';
import { productsApi, apiClient, contentApi } from '@/lib/api';
import { executePrintModalUpload, type PurchaseProgress } from '@/lib/photobooth/purchaseFlow';
import { COMING_SOON_BYPASS_COOKIE } from '@/lib/utils/constants';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  readScopedPincode,
  scopedPincodeKey,
  scopedPincodeStatusKey,
  writeScopedPincode,
} from '@/lib/utils/userScopedStorage';
import { animateToCart } from '@/lib/utils/cartAnimation';
import { cartIconRefStore } from '@/lib/utils/cartIconRef';
import Image from 'next/image';
import Link from 'next/link';
import { PB_PHOTOBOOK_FONTS_FALLBACK, type PbPhotobookFont } from '@/lib/photobook/photobookFonts';
import styles from './ProductDetailsModal.module.css';
import cardStyles from './ProductsSection.module.css';
import RatingBadge from '@/components/ui/RatingBadge';
import { toSafeHtml } from '@/lib/utils/sanitizeHtml';
import { getUploadsVariationHint, isUploadsVariationActive, resolveUploadFlags } from '@/lib/product/uploadsVariation';
import {
  canOpenPhotobookEditor,
  PB_PX_PER_CM,
  resolvePhotobookPageSizePx,
  type PhotobookPageSizePx,
} from '@/lib/product/photobookDimensions';
import { getOrderedProductImageUrls, getPrimaryProductImageUrl } from '@/lib/utils/productImages';
import { getAverageProductRating, getProductReviewCount, formatShortReviewCount } from '@/lib/utils/productReviewStats';
import { getFirstVariationForCard, getCardDiscountOff, getCardPriceDisplay, getProductDisplayUnitLabel } from '@/lib/utils/productCardPricing';
import { useCategoryMap } from '@/hooks/useCategoryMap';
import ProductPrintUploadModal, {
  type PrintUploadMode,
  type UploadedPrintItem,
} from '@/components/product/ProductPrintUploadModal';
import ProductDetailBanners from '@/components/product/ProductDetailBanners';
import ProductDigitalFlipbook from '@/components/product/ProductDigitalFlipbook';
import Logo from '@/components/Logo';

function UploadImagesButtonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="-9 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M13.48 17.6c-0.48 0-0.84 0.36-0.84 0.84v3.92c0 0.48-0.36 0.84-0.84 0.84h-9.28c-0.48 0-0.84-0.36-0.84-0.84v-3.92c0-0.44-0.36-0.84-0.84-0.84s-0.84 0.4-0.84 0.84v3.92c0 1.4 1.12 2.52 2.52 2.52h9.28c1.4 0 2.52-1.12 2.52-2.52v-3.92c0-0.44-0.36-0.84-0.84-0.84zM7.76 7.4c-0.040-0.040-0.2-0.28-0.6-0.28s-0.56 0.24-0.6 0.28l-3.52 3.52c-0.32 0.32-0.32 0.84 0 1.2 0.32 0.32 0.84 0.32 1.2 0l2.080-2.12v7.92c0 0.48 0.36 0.84 0.84 0.84s0.84-0.36 0.84-0.84v-7.92l2.080 2.080c0.32 0.32 0.84 0.32 1.2 0 0.32-0.32 0.32-0.84 0-1.2l-3.52-3.48z"
      />
    </svg>
  );
}

function EditUploadedImagesButtonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0-4.24-4.24L3.76 15.76A1 1 0 0 0 3.6 16.4L4 20z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 6.5l4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


type PbSidebarTool = 'images' | 'emoji' | 'edit' | 'pages' | 'texts' | 'tools';

type PbLayout =
  | 'single'
  | 'double'
  | 'text-top'
  | 'text-bottom'
  | 'grid-4'
  | 'grid-6'
  | 'left-full-right-2'
  | 'left-2-right-full'
  | 'right-full-left-2'
  | 'two-vertical'
  | 'three-vertical'
  | 'four-vertical'
  | 'three-horizontal'
  | 'center-inset'
  | 'double-center-inset'
  | 'stacked-horizontal'
  | 'blank';

type PbCanvasToolMode = 'select' | 'shapes' | 'draw' | 'lines';

const PB_ZOOM_MIN = PB_ZOOM_MIN_PERCENT;
const PB_ZOOM_MAX = 250;
/** Zoom % change per pixel of wheel travel (trackpad + mouse wheel). */
const PB_ZOOM_WHEEL_SENSITIVITY = 0.14;

function pbWheelDeltaPixels(e: WheelEvent): number {
  switch (e.deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      return e.deltaY * 16;
    case WheelEvent.DOM_DELTA_PAGE:
      return e.deltaY * (typeof window !== 'undefined' ? window.innerHeight : 800);
    default:
      return e.deltaY;
  }
}

function isFileDragTransfer(dt: DataTransfer | null | undefined): boolean {
  if (!dt) return false;
  return Array.from(dt.types).some((type) => type === 'Files' || type === 'application/x-moz-file');
}

function getFilesFromDataTransfer(dt: DataTransfer | null | undefined): File[] {
  if (!dt) return [];
  if (dt.files?.length) return Array.from(dt.files);
  if (!dt.items?.length) return [];
  const files: File[] = [];
  for (const item of Array.from(dt.items)) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  return files;
}

function isImageUploadFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  if (file.type) return false;
  return /\.(jpe?g|png|gif|webp|bmp|svg|avif|heic|heif)$/i.test(file.name);
}

const removePriceFromName = (name: string): string => {
  if (!name) return '';
  return name.replace(/\s*(?:\(\s*[+-]?\s*(?:₹|Rs\.?)\s*\d+(?:\.\d+)?\s*\)|[+-]?\s*(?:₹|Rs\.?)\s*\d+(?:\.\d+)?)/gi, '').trim();
};

const PB_MOBILE_EDITOR_MAX_WIDTH = 768;

function isPhotobookMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth <= PB_MOBILE_EDITOR_MAX_WIDTH;
}

interface ProductDetailsModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  mode?: 'default' | 'trial';
  onAddTrialProduct?: (payload: { product: Product; variation: ProductVariation | null }) => void;
  onRelatedProductClick?: (product: Product) => void;
  isFlatPage?: boolean;
  initialPhotobookProjectId?: string;
}

/**
 * Product Details Modal Component
 * Shows detailed product information in a beautiful animated popup
 */
export default function ProductDetailsModal({
  product,
  isOpen,
  onClose,
  mode = 'default',
  onAddTrialProduct,
  onRelatedProductClick,
  isFlatPage = false,
  initialPhotobookProjectId,
}: ProductDetailsModalProps) {
  const router = useRouter();
  const { addItem, items } = useCart();
  const { user, isAuthenticated } = useAuth();
  const pinUserId = user?.id ?? null;
  const { showToast } = useToast();
  const categoryMap = useCategoryMap();

  useEffect(() => {
    if (isOpen && !isFlatPage && product?.id) {
      router.push(`/product/${product.id}`);
      if (onClose) onClose();
    }
  }, [isOpen, isFlatPage, product?.id, router, onClose]);

  if (!isFlatPage) {
    return null;
  }

  const addToCartButtonRef = useRef<HTMLButtonElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const reviewSummaryRef = useRef<HTMLDivElement>(null);
  const detailsSectionRef = useRef<HTMLDivElement>(null);
  const imageSectionRef = useRef<HTMLDivElement>(null);
  const imageGridRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [productDetails, setProductDetails] = useState<Product | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [pincode, setPincode] = useState('');
  const [isPincodeAvailable, setIsPincodeAvailable] = useState<boolean | null>(null);
  const [isCheckingPincode, setIsCheckingPincode] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedCustomizations, setSelectedCustomizations] = useState<Record<string, string>>({});
  const [textPersonalizations, setTextPersonalizations] = useState<Record<string, string>>({});
  const [textPersonalizationDone, setTextPersonalizationDone] = useState<Record<string, boolean>>({});
  const [animatedPrice, setAnimatedPrice] = useState<number | null>(null);
  const animatedPriceRef = useRef<number | null>(null);

  const [priceAnimKey, setPriceAnimKey] = useState<number>(0);
  const [priceDirY, setPriceDirY] = useState<number>(1);
  const prevUnitPriceRef = useRef<number>(0);

  useEffect(() => {
    animatedPriceRef.current = animatedPrice;
  }, [animatedPrice]);

  const [photoboothLinks, setPhotoboothLinks] = useState<any>(null);

  useEffect(() => {
    const fetchPhotoboothLinks = async () => {
      try {
        const data = await contentApi.getByType('photobooth_links');
        if (data && data.isActive) {
          setPhotoboothLinks(data.metadata || {});
        }
      } catch (err) {
        console.error('Failed to fetch photobooth links:', err);
      }
    };
    void fetchPhotoboothLinks();
  }, []);

  const [glowActive, setGlowActive] = useState(false);
  const [isPrintUploadOpen, setIsPrintUploadOpen] = useState(false);
  const [uploadedPrintItems, setUploadedPrintItems] = useState<UploadedPrintItem[]>([]);
  const [uploadedPrintMode, setUploadedPrintMode] = useState<PrintUploadMode>('polaroid');
  const [printUploadProgress, setPrintUploadProgress] = useState<PurchaseProgress | null>(null);
  const [isUploadingPrints, setIsUploadingPrints] = useState(false);
  const printUploadCompleted = uploadedPrintItems.length > 0;
  const [photobookEditorState, setPhotobookEditorState] = useState<'idle' | 'loading' | 'editor'>('idle');
  const [pbPhotobookFonts, setPbPhotobookFonts] = useState<PbPhotobookFont[]>(PB_PHOTOBOOK_FONTS_FALLBACK);
  const [pbPageSizePx, setPbPageSizePx] = useState<PhotobookPageSizePx>(() => resolvePhotobookPageSizePx());
  const pbPageSizePxRef = useRef(pbPageSizePx);
  pbPageSizePxRef.current = pbPageSizePx;
  const [pbEditorSkeletonVisible, setPbEditorSkeletonVisible] = useState(false);
  const pbEditorSkeletonShownRef = useRef(false);
  const productDetailsLoadedRef = useRef(false);
  const [pbEditorDarkMode, setPbEditorDarkMode] = useState(true);

  // Photobook Coming Soon Password Bypass state variables
  const [showPbPasswordModal, setShowPbPasswordModal] = useState(false);
  const [pbPassword, setPbPassword] = useState('');
  const [pbPasswordError, setPbPasswordError] = useState('');
  const [isVerifyingPbPassword, setIsVerifyingPbPassword] = useState(false);

  // Photobook Editor SPA state variables
  const [pbProjectName, setPbProjectName] = useState('My Project');
  const PB_PROJECT_NAME_MAX_W = 300;
  const PB_PROJECT_NAME_PLACEHOLDER = 'My Project';
  const pbProjectNameMeasureRef = useRef<HTMLSpanElement>(null);
  const pbProjectNameInputRef = useRef<HTMLInputElement>(null);

  const syncPbProjectNameInputWidth = useCallback(() => {
    const measure = pbProjectNameMeasureRef.current;
    const input = pbProjectNameInputRef.current;
    if (!measure || !input) return;
    const text = pbProjectName.length > 0 ? pbProjectName : PB_PROJECT_NAME_PLACEHOLDER;
    measure.textContent = text;
    const measured = measure.getBoundingClientRect().width;
    const overflows = measured > PB_PROJECT_NAME_MAX_W;
    input.style.width = overflows ? `${PB_PROJECT_NAME_MAX_W}px` : `${Math.ceil(measured)}px`;
    input.classList.toggle(styles.photobookProjectNameInputOverflow, overflows);
  }, [pbProjectName]);

  useLayoutEffect(() => {
    if (photobookEditorState !== 'editor') return;
    syncPbProjectNameInputWidth();
  }, [pbProjectName, photobookEditorState, syncPbProjectNameInputWidth]);

  useEffect(() => {
    if (photobookEditorState !== 'editor') return;
    let cancelled = false;
    void import('@/lib/photobook/photobookFonts').then((mod) => {
      if (!cancelled) setPbPhotobookFonts(mod.PB_PHOTOBOOK_FONTS);
    });
    return () => {
      cancelled = true;
    };
  }, [photobookEditorState]);

  const [pbActiveTool, setPbActiveTool] = useState<PbSidebarTool | null>('images');
  const [pbDrawColorPickerOpen, setPbDrawColorPickerOpen] = useState(false);
  const [pbZoomVal, setPbZoomVal] = useState(100);
  const pbZoomValRef = useRef(100);
  const [pbWorkspaceMode, setPbWorkspaceMode] = useState<'move' | 'hand'>('move');
  const pbFabricApiRef = useRef<Record<string, PbFabricPageApi>>({});
  const pbActivePageIdRef = useRef<string | null>(null);
  const pbCanvasStackRef = useRef<HTMLDivElement>(null);
  const pbCanvasStackViewportRef = useRef<HTMLDivElement>(null);
  const photobookEditorRootRef = useRef<HTMLDivElement>(null);
  const photobookMainWorkspaceRef = useRef<HTMLElement>(null);
  type WorkspaceMarqueeState = {
    active: boolean;
    pointerId: number;
    pageId: string;
    startClientX: number;
    startClientY: number;
    currentClientX: number;
    currentClientY: number;
    sceneStart: ScenePoint;
    sceneCurrent: ScenePoint;
  };
  const workspaceMarqueeRef = useRef<WorkspaceMarqueeState | null>(null);
  const [marqueeVisual, setMarqueeVisual] = useState<PbGlobalMarqueeVisualState | null>(null);

  const pbPageBlockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingPbScrollPageIdRef = useRef<string | null>(null);
  const pbStackZoomingRef = useRef(false);
  const pbPreviewModeRef = useRef(false);
  const pbPreviewPreparingRef = useRef(false);
  const pbZoomGestureEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pbEditorInitialZoomDoneRef = useRef(false);
  const pbCustomBgColorInputRef = useRef<HTMLInputElement>(null);

  const applyPbZoomToDom = useCallback((value: number) => {
    const clamped = Math.min(PB_ZOOM_MAX, Math.max(PB_ZOOM_MIN, value));
    pbZoomValRef.current = clamped;
    return clamped;
  }, []);

  const applyPbStackZoomToDom = useCallback(
    (zoomPercent: number) => {
      const clamped = applyPbZoomToDom(zoomPercent);
      const zoomFactor = clamped / 100;
      const zoomFactorStr = String(zoomFactor);
      const padPx = `${56 * zoomFactor}px`;
      const { widthPx, heightPx } = pbPageSizePxRef.current;
      const pageWidthVar = `${widthPx * zoomFactor}px`;
      const pageHeightVar = `${heightPx * zoomFactor}px`;
      const pageSizeVar = `${Math.max(widthPx, heightPx) * zoomFactor}px`;

      const workspace = photobookMainWorkspaceRef.current;
      const stack = pbCanvasStackRef.current;
      workspace?.style.setProperty('--pb-stack-zoom', zoomFactorStr);
      if (stack) {
        stack.style.setProperty('--pb-stack-zoom', zoomFactorStr);
        stack.style.setProperty('--pb-fabric-select-pad', padPx);
        stack.querySelectorAll('[data-pb-page-id]').forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          node.style.setProperty('--pb-page-width-px', pageWidthVar);
          node.style.setProperty('--pb-page-height-px', pageHeightVar);
          node.style.setProperty('--pb-page-size-px', pageSizeVar);
          node.style.setProperty('--pb-fabric-select-pad', padPx);
        });
      }
      return clamped;
    },
    [applyPbZoomToDom],
  );

  const clampPbWorkspaceScroll = useCallback((workspace: HTMLElement) => {
    const maxLeft = Math.max(0, workspace.scrollWidth - workspace.clientWidth);
    const maxTop = Math.max(0, workspace.scrollHeight - workspace.clientHeight);
    workspace.scrollLeft = Math.min(maxLeft, Math.max(0, workspace.scrollLeft));
    workspace.scrollTop = Math.min(maxTop, Math.max(0, workspace.scrollTop));
  }, []);

  const centerPbWorkspaceScrollX = useCallback((workspace: HTMLElement) => {
    const maxLeft = Math.max(0, workspace.scrollWidth - workspace.clientWidth);
    workspace.scrollLeft = maxLeft / 2;
    clampPbWorkspaceScroll(workspace);
  }, [clampPbWorkspaceScroll]);

  const applyPbStackZoomLayout = useCallback((opts?: { centerScrollX?: boolean }) => {
    const stack = pbCanvasStackRef.current;
    const viewport = pbCanvasStackViewportRef.current;
    const workspace = photobookMainWorkspaceRef.current;
    if (!stack || !viewport) return;

    viewport.style.width = `${stack.offsetWidth}px`;
    viewport.style.height = `${stack.offsetHeight}px`;
    if (opts?.centerScrollX && workspace) centerPbWorkspaceScrollX(workspace);
  }, [centerPbWorkspaceScrollX]);

  /** DOM zoom already changed layout; sync Fabric CSS/backstore only (viewport zoom stays 1). */
  const refreshAllPbFabricDisplayScale = useCallback(
    (opts?: { cssOnly?: boolean; domZoom?: number }) => {
      Object.values(pbFabricApiRef.current).forEach((api) => api.refreshDisplayScale?.(opts));
    },
    [],
  );

  const finishPbZoomGesture = useCallback(() => {
    pbStackZoomingRef.current = false;
    setPbZoomVal(pbZoomValRef.current);
    refreshAllPbFabricDisplayScale({
      cssOnly: pbPreviewModeRef.current,
      domZoom: pbZoomValRef.current / 100,
    });
    pbZoomGestureEndTimerRef.current = null;
  }, [refreshAllPbFabricDisplayScale]);

  /** Uniform stack zoom; pointer anchor + Fabric CSS sync happen synchronously (no blink). */
  const zoomPbAtClientPoint = useCallback(
    (clientX: number, clientY: number, nextZoomPercent: number) => {
      const clamped = Math.min(PB_ZOOM_MAX, Math.max(PB_ZOOM_MIN, nextZoomPercent));
      const oldZoom = pbZoomValRef.current / 100;
      const newZoom = clamped / 100;
      if (Math.abs(oldZoom - newZoom) < 0.0001) return clamped;

      const stack = pbCanvasStackRef.current;
      if (!stack) return clamped;

      const stackBefore = stack.getBoundingClientRect();
      const anchorLocalX = clientX - stackBefore.left;
      const anchorLocalY = clientY - stackBefore.top;

      pbStackZoomingRef.current = true;
      applyPbStackZoomToDom(clamped);
      applyPbStackZoomLayout();
      void stack.offsetHeight;

      const stackAfter = stack.getBoundingClientRect();
      const ratio = newZoom / oldZoom;
      const workspace = photobookMainWorkspaceRef.current;
      if (workspace) {
        workspace.scrollLeft += stackAfter.left + anchorLocalX * ratio - clientX;
        workspace.scrollTop += stackAfter.top + anchorLocalY * ratio - clientY;
        clampPbWorkspaceScroll(workspace);
      }

      refreshAllPbFabricDisplayScale({ cssOnly: true, domZoom: newZoom });

      if (pbZoomGestureEndTimerRef.current) {
        clearTimeout(pbZoomGestureEndTimerRef.current);
      }
      pbZoomGestureEndTimerRef.current = setTimeout(finishPbZoomGesture, 150);

      return clamped;
    },
    [
      applyPbStackZoomLayout,
      applyPbStackZoomToDom,
      clampPbWorkspaceScroll,
      finishPbZoomGesture,
      refreshAllPbFabricDisplayScale,
    ],
  );

  useLayoutEffect(() => {
    if (photobookEditorState !== 'editor') return;
    applyPbStackZoomLayout();

    if (pbStackZoomingRef.current) return;

    refreshAllPbFabricDisplayScale({
      cssOnly: pbPreviewModeRef.current,
      domZoom: pbZoomValRef.current / 100,
    });
  }, [pbZoomVal, photobookEditorState, applyPbStackZoomLayout, refreshAllPbFabricDisplayScale]);

  const syncPbZoomLabelFromRef = useCallback(() => {
    setPbZoomVal(pbZoomValRef.current);
  }, []);

  const pbZoomAnimationRef = useRef<number | null>(null);

  const animatePbZoomTo = useCallback((targetZoom: number) => {
    const workspace = photobookMainWorkspaceRef.current;
    if (!workspace) return;

    const rect = workspace.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    if (pbZoomAnimationRef.current) {
      cancelAnimationFrame(pbZoomAnimationRef.current);
    }

    const startZoom = pbZoomValRef.current;
    const clampedTarget = Math.min(PB_ZOOM_MAX, Math.max(PB_ZOOM_MIN, targetZoom));
    const duration = 200;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress * (2 - progress);
      const currentZoom = startZoom + (clampedTarget - startZoom) * easeProgress;

      zoomPbAtClientPoint(clientX, clientY, currentZoom);

      if (progress < 1) {
        pbZoomAnimationRef.current = requestAnimationFrame(step);
      } else {
        pbZoomAnimationRef.current = null;
      }
    };

    pbZoomAnimationRef.current = requestAnimationFrame(step);
  }, [zoomPbAtClientPoint]);

  useEffect(() => {
    return () => {
      if (pbZoomAnimationRef.current) {
        cancelAnimationFrame(pbZoomAnimationRef.current);
      }
    };
  }, []);

  const resetPbViewport = useCallback(() => {
    if (pbZoomGestureEndTimerRef.current) {
      clearTimeout(pbZoomGestureEndTimerRef.current);
      pbZoomGestureEndTimerRef.current = null;
    }
    pbStackZoomingRef.current = false;
    pbZoomValRef.current = 100;
    applyPbStackZoomToDom(100);
    setPbZoomVal(100);
    const workspace = photobookMainWorkspaceRef.current;
    if (workspace) {
      workspace.scrollLeft = 0;
      workspace.scrollTop = 0;
    }
  }, [applyPbStackZoomToDom]);

  useLayoutEffect(() => {
    if (photobookEditorState !== 'editor') {
      pbEditorInitialZoomDoneRef.current = false;
      return;
    }
    applyPbStackZoomLayout({ centerScrollX: true });
    const workspace = photobookMainWorkspaceRef.current;
    if (workspace) {
      workspace.scrollTop = 0;
    }
  }, [photobookEditorState, applyPbStackZoomLayout]);

  useEffect(() => {
    if (photobookEditorState !== 'editor') {
      resetPbViewport();
    }
  }, [photobookEditorState, resetPbViewport]);

  useEffect(() => {
    if (photobookEditorState !== 'editor') return;

    const onWheel = (e: WheelEvent) => {
      if (pbPreviewModeRef.current || pbPreviewPreparingRef.current) return;
      if (!e.ctrlKey && !e.metaKey) return;

      const editorRoot = photobookEditorRootRef.current;
      const workspace = photobookMainWorkspaceRef.current;
      if (!editorRoot || !workspace) return;

      const target = e.target;
      if (!(target instanceof Node) || !editorRoot.contains(target)) return;
      if (!workspace.contains(target)) return;

      e.preventDefault();
      e.stopPropagation();

      const deltaPx = pbWheelDeltaPixels(e);
      if (Math.abs(deltaPx) < 0.01) return;

      const zoomDelta = -deltaPx * PB_ZOOM_WHEEL_SENSITIVITY;
      zoomPbAtClientPoint(e.clientX, e.clientY, pbZoomValRef.current + zoomDelta);
    };

    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => document.removeEventListener('wheel', onWheel, { capture: true });
  }, [photobookEditorState, zoomPbAtClientPoint]);

  const pbCanvasDeleteKeyHandlerRef = useRef<(() => boolean) | null>(null);

  const togglePbSidebarTool = useCallback((tool: PbSidebarTool) => {
    setPbEditCanvasPageSelected(false);
    setPbEditPageHeadlinePageId(null);
    setPbEditHover(null);
    setPbCanvasToolMode('select');
    setPbActiveSubTool(null);
    setPbActiveTool((prev) => {
      return prev === tool ? null : tool;
    });
  }, []);

  const [pbCursorTooltip, setPbCursorTooltip] = useState<{
    text: string;
    x: number;
    y: number;
    fixed?: boolean;
    align?: 'right' | 'bottom' | 'cursor';
  } | null>(null);

  const showPbCursorTooltip = useCallback((e: ReactMouseEvent, text: string, align?: 'right' | 'bottom' | 'cursor') => {
    if (align === 'right') {
      const rect = e.currentTarget.getBoundingClientRect();
      setPbCursorTooltip({
        text,
        x: rect.right + 10,
        y: rect.top + rect.height / 2,
        fixed: true,
        align: 'right'
      });
    } else if (align === 'bottom') {
      const rect = e.currentTarget.getBoundingClientRect();
      setPbCursorTooltip({
        text,
        x: rect.left + rect.width / 2,
        y: rect.bottom + 10,
        fixed: true,
        align: 'bottom'
      });
    } else {
      setPbCursorTooltip({ text, x: e.clientX, y: e.clientY });
    }
  }, []);

  const movePbCursorTooltip = useCallback((e: ReactMouseEvent) => {
    setPbCursorTooltip((prev) => (prev && !prev.fixed ? { text: prev.text, x: e.clientX, y: e.clientY } : prev));
  }, []);

  const hidePbCursorTooltip = useCallback(() => setPbCursorTooltip(null), []);

  useEffect(() => {
    const handleGlobalMouseDown = () => {
      setPbCursorTooltip(null);
    };
    window.addEventListener('mousedown', handleGlobalMouseDown, { capture: true });
    return () => {
      window.removeEventListener('mousedown', handleGlobalMouseDown, { capture: true });
    };
  }, []);

  const pbTip = useCallback(
    (text: string, align?: 'right' | 'bottom' | 'cursor') => ({
      onMouseEnter: (e: ReactMouseEvent) => showPbCursorTooltip(e, text, align),
      onMouseMove: align && align !== 'cursor' ? undefined : movePbCursorTooltip,
      onMouseLeave: hidePbCursorTooltip,
    }),
    [showPbCursorTooltip, movePbCursorTooltip, hidePbCursorTooltip],
  );
  const [pbPages, setPbPages] = useState<
    Array<{
      id: string;
      label: string;
      bg?: string;
      layout?: PbLayout;
      caption?: string;
      // Photo slots per page (index depends on page.layout)
      slotImages?: Array<string | undefined>;
      fontFamily?: string;
      pageTextStyle?: Partial<PbFabricTextStyle>;
      locked?: boolean;
      coverDesign?: PbCoverDesignId;
      layoutFrameGapEnabled?: boolean;
    }>
  >([
    {
      id: 'fc',
      label: 'Front Cover',
      bg: '#ffffff',
      layout: 'single',
      coverDesign: 'cover-full-page',
      caption: 'Our Beautiful Memories',
      slotImages: ['https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=600&auto=format&fit=crop&q=80'],
    },
    { id: 'bc', label: 'Back Cover', bg: '#ffffff', layout: 'blank', caption: '', slotImages: [] },
  ]);

  const pbHasInnerPages = useMemo(
    () => pbPages.some((p) => p.id !== 'fc' && p.id !== 'bc'),
    [pbPages],
  );

  const getPageRows = useCallback(() => {
    const rows: Array<Array<(typeof pbPages)[number]>> = [];
    if (pbPages.length === 0) return rows;

    let startIndex = 0;
    if (pbPages[0].id === 'fc') {
      rows.push([pbPages[0]]);
      startIndex = 1;
    }

    const endIndex = pbPages[pbPages.length - 1].id === 'bc' ? pbPages.length - 1 : pbPages.length;
    for (let i = startIndex; i < endIndex; i += 2) {
      const pair: Array<(typeof pbPages)[number]> = [];
      pair.push(pbPages[i]);
      if (i + 1 < endIndex) {
        pair.push(pbPages[i + 1]);
      }
      rows.push(pair);
    }

    if (pbPages[pbPages.length - 1].id === 'bc' && pbPages.length > 1) {
      rows.push([pbPages[pbPages.length - 1]]);
    }

    return rows;
  }, [pbPages]);

  const handModeToolbarClicksRef = useRef({ count: 0, lastTime: 0 });
  const handleToolbarActionsClickCapture = useCallback((e: React.MouseEvent) => {
    if (pbWorkspaceMode === 'hand') {
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      const clickData = handModeToolbarClicksRef.current;
      if (now - clickData.lastTime < 1000) {
        clickData.count += 1;
      } else {
        clickData.count = 1;
      }
      clickData.lastTime = now;

      if (clickData.count >= 2) {
        showToast('Move to select and retry', 'error');
      }
    }
  }, [pbWorkspaceMode, showToast]);

  const [pbActivePageIndex, setPbActivePageIndex] = useState(0);

  useEffect(() => {
    pbActivePageIdRef.current = pbPages[pbActivePageIndex]?.id ?? null;
  }, [pbPages, pbActivePageIndex]);

  const activatePbPage = useCallback((pageIndex: number) => {
    const page = pbPages[pageIndex];
    if (!page) return;
    const previousActiveId = pbActivePageIdRef.current;
    pbActivePageIdRef.current = page.id;
    setPbActivePageIndex(pageIndex);
    if (previousActiveId && previousActiveId !== page.id) {
      pbFabricApiRef.current[previousActiveId]?.clearSelection?.();
    }
  }, [pbPages]);

  const [pbPageBlinkId, setPbPageBlinkId] = useState<string | null>(null);
  const [pbPageListOverIndex, setPbPageListOverIndex] = useState<number | null>(null);
  const [pbPageListDragIndex, setPbPageListDragIndex] = useState<number | null>(null);
  const [pbPageListDragOffsetY, setPbPageListDragOffsetY] = useState(0);
  const [pbDeletePagePromptIndex, setPbDeletePagePromptIndex] = useState<number | null>(null);
  const [pbActivePhotoSlotIndex, setPbActivePhotoSlotIndex] = useState<number | null>(0);
  const [pbAddPageLayoutPickerOpen, setPbAddPageLayoutPickerOpen] = useState(false);
  const [pbLayoutPickerMode, setPbLayoutPickerMode] = useState<'add-page' | 'change-layout'>('add-page');
  const [pbChangeLayoutPageIndex, setPbChangeLayoutPageIndex] = useState<number | null>(null);
  const [pbLayoutChangeConfirm, setPbLayoutChangeConfirm] = useState<{
    pageIndex: number;
    layoutId?: PbLayoutId;
    coverDesignId?: PbCoverDesignId;
  } | null>(null);
  const [pbFrameAdjustPageId, setPbFrameAdjustPageId] = useState<string | null>(null);
  const [pbFrameAdjustZoom, setPbFrameAdjustZoom] = useState(1);
  const [pbFrameCropModal, setPbFrameCropModal] = useState<{
    pageId: string;
    frameId: string;
    sourceUrl: string;
    frameWidth: number;
    frameHeight: number;
    naturalWidth: number;
    naturalHeight: number;
    crop: PbFrameCrop;
  } | null>(null);
  const [pbDraggingGalleryUrl, setPbDraggingGalleryUrl] = useState<string | null>(null);
  const [pbSelectedFrameId, setPbSelectedFrameId] = useState<string | null>(null);
  const [pbSelectedFramePageId, setPbSelectedFramePageId] = useState<string | null>(null);
  const [pbAddPageAfterIndex, setPbAddPageAfterIndex] = useState<number | null>(null);
  const [pbTypographySearch, setPbTypographySearch] = useState('');
  const [pbEmojiTab, setPbEmojiTab] = useState<'emojis' | 'stickers'>('emojis');
  const [pbEmojiSearch, setPbEmojiSearch] = useState('');
  const pbEmojiPickerRef = useRef<HTMLElement | null>(null);
  const [pbUploadedImages, setPbUploadedImages] = useState<Array<{ id: string; url: string; name: string; bunnyUrl?: string }>>([]);
  const [pbGalleryGridCols, setPbGalleryGridCols] = useState<1 | 2 | 3>(2);
  const [pbDraggingGalleryIndex, setPbDraggingGalleryIndex] = useState<number | null>(null);
  const [pbStickerDragActive, setPbStickerDragActive] = useState(false);
  const [pbEditHover, setPbEditHover] = useState<PbEditHoverTarget | null>(null);
  const [pbEditCanvasPageSelected, setPbEditCanvasPageSelected] = useState(false);
  const [pbEditPageHeadlinePageId, setPbEditPageHeadlinePageId] = useState<string | null>(null);
  const [pbEditCropPageId, setPbEditCropPageId] = useState<string | null>(null);
  const pbImagesUploadInputRef = useRef<HTMLInputElement | null>(null);
  const pbDropZoneRef = useRef<HTMLDivElement | null>(null);
  const pbDropZoneNudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pbDropZoneNudgeActive, setPbDropZoneNudgeActive] = useState(false);
  const [pbImagesUploadDragOver, setPbImagesUploadDragOver] = useState(false);
  const pbImagesUploadDragDepthRef = useRef(0);
  const [pbCanvasToolMode, setPbCanvasToolMode] = useState<PbCanvasToolMode>('select');
  const [pbActiveSubTool, setPbActiveSubTool] = useState<'shapes' | 'lines' | 'draw' | null>(null);
  const [pbCanvasShape, setPbCanvasShape] = useState<string | null>(null);
  const [pbDrawPreset, setPbDrawPreset] = useState<'pencil' | 'marker' | 'highlighter' | 'eraser'>('marker');
  const [pbDrawColors, setPbDrawColors] = useState<Record<string, string>>({
    pencil: '#ff1e68',
    marker: '#000000',
    highlighter: '#ffd60a',
  });
  const pbDrawColor = pbDrawColors[pbDrawPreset] || '#ff1e68';
  const [pbDrawWeightsByPreset, setPbDrawWeightsByPreset] = useState<Record<string, number>>({
    pencil: 3,
    marker: 5,
    highlighter: 10,
    eraser: 14,
  });
  const [pbDrawOpacitiesByPreset, setPbDrawOpacitiesByPreset] = useState<Record<string, number>>({
    pencil: 100,
    marker: 100,
    highlighter: 100,
    eraser: 100,
  });
  const pbDrawWeight = pbDrawWeightsByPreset[pbDrawPreset] ?? 5;
  const pbDrawOpacity = pbDrawOpacitiesByPreset[pbDrawPreset] ?? 100;
  const [pbDrawSettingsOpen, setPbDrawSettingsOpen] = useState(false);
  const [pbDrawSettingsPopupPos, setPbDrawSettingsPopupPos] = useState<{ top: number; left: number } | null>(null);
  const pbSettingsPopupRef = useRef<HTMLDivElement>(null);
  const pbSettingsMenuBtnRef = useRef<HTMLDivElement>(null);
  const [pbLinePreset, setPbLinePreset] = useState<'straight' | 'curve' | 'zigzag' | null>(null);
  const [pbFabricByPageId, setPbFabricByPageId] = useState<Record<string, PbFabricSerialized | undefined>>({});
  const pbPageBlinkTimeoutRef = useRef<number | null>(null);

  const triggerPbPageNavigateBlink = useCallback((pageId: string) => {
    if (pbPageBlinkTimeoutRef.current) {
      window.clearTimeout(pbPageBlinkTimeoutRef.current);
    }
    setPbPageBlinkId(pageId);
    pbPageBlinkTimeoutRef.current = window.setTimeout(() => {
      setPbPageBlinkId(null);
      pbPageBlinkTimeoutRef.current = null;
    }, 1000);
  }, []);

  const scrollPbPageIntoView = useCallback(
    (pageId: string, options?: { blink?: boolean }) => {
      if (options?.blink) triggerPbPageNavigateBlink(pageId);
      const run = () => {
        const block = pbPageBlockRefs.current[pageId];
        const workspace = photobookMainWorkspaceRef.current;
        if (!block) return;
        if (workspace) {
          const br = block.getBoundingClientRect();
          const wr = workspace.getBoundingClientRect();
          const top = workspace.scrollTop + br.top - wr.top - 56;
          workspace.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        } else {
          block.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(run));
    },
    [triggerPbPageNavigateBlink],
  );

  const queueScrollToPbPage = useCallback(
    (pageId: string, options?: { blink?: boolean }) => {
      pendingPbScrollPageIdRef.current = pageId;
      if (options?.blink) triggerPbPageNavigateBlink(pageId);
    },
    [triggerPbPageNavigateBlink],
  );

  useLayoutEffect(() => {
    const pageId = pendingPbScrollPageIdRef.current;
    if (!pageId) return;
    if (pbStackZoomingRef.current) return;
    if (!pbPageBlockRefs.current[pageId]) return;
    pendingPbScrollPageIdRef.current = null;
    scrollPbPageIntoView(pageId);
  }, [pbPages, scrollPbPageIntoView]);

  const pbColorUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pbDrawColorAnchorRef = useRef<HTMLButtonElement>(null);
  const pbSidebarPropertiesRef = useRef<HTMLDivElement>(null);
  const [pbPreviewMode, setPbPreviewMode] = useState(false);
  const [pbPreviewFlipbookUrls, setPbPreviewFlipbookUrls] = useState<string[]>([]);
  const [pbPreviewPreparing, setPbPreviewPreparing] = useState(false);
  const [pbPreviewFadeActive, setPbPreviewFadeActive] = useState(false);
  const pbPreviewObjectUrlsRef = useRef<string[]>([]);
  pbPreviewModeRef.current = pbPreviewMode;
  pbPreviewPreparingRef.current = pbPreviewPreparing;

  useEffect(() => {
    if (photobookEditorState !== 'editor') return;
    requestAnimationFrame(() => {
      refreshAllPbFabricDisplayScale({
        cssOnly: pbPreviewModeRef.current,
        domZoom: pbZoomValRef.current / 100,
      });
    });
  }, [pbPreviewMode, photobookEditorState, refreshAllPbFabricDisplayScale]);
  const [pbShapesScrollAtTop, setPbShapesScrollAtTop] = useState(true);
  const [pbShapesScrollAtBottom, setPbShapesScrollAtBottom] = useState(true);

  useLayoutEffect(() => {
    if (photobookEditorState !== 'editor') return;

    const workspace = photobookMainWorkspaceRef.current;
    if (!workspace) return;

    const applyInitialFitZoom = () => {
      if (pbEditorInitialZoomDoneRef.current) return;
      if (workspace.clientHeight <= 0 || workspace.clientWidth <= 0) return;

      const fit = computePbInitialFitZoomPercent({
        workspaceHeight: workspace.clientHeight,
        workspaceWidth: workspace.clientWidth,
        pageWidthPx: pbPageSizePx.widthPx,
        pageHeightPx: pbPageSizePx.heightPx,
      });
      let clamped = Math.max(PB_ZOOM_MIN, Math.min(PB_ZOOM_MAX, fit));
      applyPbStackZoomToDom(clamped);

      const firstPageId = pbPages[0]?.id;
      const pageBlock = firstPageId ? pbPageBlockRefs.current[firstPageId] : null;
      if (pageBlock && pageBlock.offsetHeight > 0 && pageBlock.offsetWidth > 0) {
        const stack = pbCanvasStackRef.current;
        const stackTopPad = stack ? parseFloat(getComputedStyle(stack).paddingTop) || 0 : 0;
        const refined = refinePbFitZoomFromBlockMeasure({
          zoomPercent: clamped,
          blockHeight: pageBlock.offsetHeight + stackTopPad,
          blockWidth: pageBlock.offsetWidth,
          workspaceHeight: workspace.clientHeight,
          workspaceWidth: workspace.clientWidth,
        });
        if (refined < clamped - 0.05) {
          clamped = Math.max(PB_ZOOM_MIN, refined);
          applyPbStackZoomToDom(clamped);
        }
      }

      setPbZoomVal(clamped);
      pbEditorInitialZoomDoneRef.current = true;
      applyPbStackZoomLayout({ centerScrollX: true });
      const ws = photobookMainWorkspaceRef.current;
      if (ws) ws.scrollTop = 0;
    };

    const runLayout = () => {
      if (!pbEditorInitialZoomDoneRef.current) {
        applyInitialFitZoom();
        return;
      }
      applyPbStackZoomLayout({ centerScrollX: true });
    };

    let resizeObserver: ResizeObserver | null = null;
    if (!pbEditorInitialZoomDoneRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (!pbEditorInitialZoomDoneRef.current) {
          requestAnimationFrame(applyInitialFitZoom);
        }
      });
      resizeObserver.observe(workspace);
      requestAnimationFrame(() => requestAnimationFrame(applyInitialFitZoom));
    } else {
      runLayout();
    }

    return () => resizeObserver?.disconnect();
  }, [pbPages, pbPageSizePx, photobookEditorState, applyPbStackZoomLayout, applyPbStackZoomToDom]);

  useEffect(() => {
    if (!pbDrawSettingsOpen) return;
    const handleOutsideClick = (e: Event) => {
      const target = e.target as Node;
      if (!target) return;
      if (pbSettingsPopupRef.current?.contains(target)) return;
      if (pbSettingsMenuBtnRef.current?.contains(target)) return;
      setPbDrawSettingsOpen(false);
    };
    document.addEventListener('click', handleOutsideClick, true);
    return () => document.removeEventListener('click', handleOutsideClick, true);
  }, [pbDrawSettingsOpen]);

  useLayoutEffect(() => {
    if (!pbDrawSettingsOpen) {
      setPbDrawSettingsPopupPos(null);
      return;
    }
    const updatePos = () => {
      const anchor = pbSettingsMenuBtnRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setPbDrawSettingsPopupPos({
        top: rect.top + rect.height / 2,
        left: rect.right + 10,
      });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [pbDrawSettingsOpen, pbActiveTool, pbActiveSubTool]);

  useEffect(() => {
    return () => {
      if (pbColorUpdateTimeoutRef.current) {
        clearTimeout(pbColorUpdateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (pbCanvasToolMode !== 'shapes') return;
    const timer = setTimeout(() => {
      const grid = document.querySelector(`.${styles.pbShapesGrid}`);
      if (grid) {
        const atTop = grid.scrollTop <= 2;
        const atBottom = grid.scrollHeight - grid.scrollTop <= grid.clientHeight + 5;
        setPbShapesScrollAtTop(atTop);
        setPbShapesScrollAtBottom(atBottom);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [pbCanvasToolMode, pbActiveSubTool]);


  const pbGalleryDragActive = pbDraggingGalleryIndex !== null || pbStickerDragActive;
  const pbGalleryDropHandledRef = useRef(false);

  const handlePbPageGalleryDragOver = useCallback(
    (pageId: string, e: React.DragEvent<HTMLElement>) => {
      if (!pbGalleryDragActive) return;
      const types = e.dataTransfer.types;
      if (!types.includes('text/pb-gallery-image') && !types.includes('text/pb-sticker-image')) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      pbFabricApiRef.current[pageId]?.handleGalleryDragOver?.(pbDraggingGalleryUrl, e.nativeEvent);
    },
    [pbGalleryDragActive, pbDraggingGalleryUrl],
  );

  const handlePbPageGalleryDragLeave = useCallback(
    (pageId: string, e: React.DragEvent<HTMLElement>) => {
      if (!pbGalleryDragActive) return;
      const current = e.currentTarget;
      const related = e.relatedTarget as Node | null;
      if (related && current.contains(related)) return;
      pbFabricApiRef.current[pageId]?.handleGalleryDragLeave?.();
    },
    [pbGalleryDragActive],
  );

  const handlePbPageGalleryDrop = useCallback(
    (pageIndex: number, pageId: string, pageLocked: boolean, e: React.DragEvent<HTMLElement>) => {
      if (!pbGalleryDragActive || pageLocked || pageId === 'bc') return;
      e.preventDefault();
      e.stopPropagation();
      if (pbGalleryDropHandledRef.current) return;
      pbGalleryDropHandledRef.current = true;
      window.setTimeout(() => {
        pbGalleryDropHandledRef.current = false;
      }, 0);
      const url =
        e.dataTransfer.getData('text/pb-gallery-image') ||
        e.dataTransfer.getData('text/pb-sticker-image');
      if (!url) return;
      const isSticker =
        e.dataTransfer.types.includes('text/pb-sticker-image') ||
        /\/openmoji\//i.test(url) ||
        /\.svg($|[?#])/i.test(url);
      if (pageIndex !== pbActivePageIndex) {
        activatePbPage(pageIndex);
        setPbEditHover(null);
        setPbEditPageHeadlinePageId(null);
        setPbEditCanvasPageSelected(false);
        if (pbCanvasToolMode !== 'draw' && pbCanvasToolMode !== 'lines') {
          setPbActiveTool('edit');
        }
      }
      void pbFabricApiRef.current[pageId]?.handleGalleryDrop?.(url, e.nativeEvent, { isSticker });
    },
    [
      pbGalleryDragActive,
      pbActivePageIndex,
      activatePbPage,
      pbCanvasToolMode,
    ],
  );

  const handlePbFabricObjectSelectedRef = useRef<
    (info: { pageId: string; meta: PbFabricObjectEditMeta } | null) => void
  >(() => {});

  const openPbEditSidebar = useCallback(() => {
    setPbCanvasToolMode('select');
    setPbActiveSubTool(null);
    setPbActiveTool('edit');
  }, []);

  const openPbUploadImagesSidebar = useCallback(() => {
    setPbEditCanvasPageSelected(false);
    setPbEditPageHeadlinePageId(null);
    setPbEditHover(null);
    setPbCanvasToolMode('select');
    setPbActiveSubTool(null);
    setPbActiveTool('images');
  }, []);

  const triggerPbDropZoneNudge = useCallback(() => {
    if (pbDropZoneNudgeTimerRef.current) {
      clearTimeout(pbDropZoneNudgeTimerRef.current);
    }
    setPbDropZoneNudgeActive(false);
    requestAnimationFrame(() => {
      setPbDropZoneNudgeActive(true);
      pbDropZoneNudgeTimerRef.current = setTimeout(() => {
        setPbDropZoneNudgeActive(false);
        pbDropZoneNudgeTimerRef.current = null;
      }, 2500);
      requestAnimationFrame(() => {
        pbDropZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }, []);

  useEffect(
    () => () => {
      if (pbDropZoneNudgeTimerRef.current) {
        clearTimeout(pbDropZoneNudgeTimerRef.current);
      }
    },
    [],
  );

  const addPbUploadedImagesFromFiles = useCallback((files: FileList | File[]) => {
    const next = Array.from(files)
      .filter(isImageUploadFile)
      .slice(0, 24)
      .map((file) => {
        const id = `img_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        pbImageFileMapRef.current.set(id, file);
        return {
          id,
          url: URL.createObjectURL(file),
          name: file.name,
        };
      });
    if (next.length) setPbUploadedImages((prev) => [...next, ...prev]);
  }, []);

  useEffect(() => {
    const resetUploadDrag = () => {
      pbImagesUploadDragDepthRef.current = 0;
      setPbImagesUploadDragOver(false);
    };
    window.addEventListener('dragend', resetUploadDrag);
    window.addEventListener('drop', resetUploadDrag);
    return () => {
      window.removeEventListener('dragend', resetUploadDrag);
      window.removeEventListener('drop', resetUploadDrag);
    };
  }, []);

  const handlePbFabricObjectSelected = useCallback(
    (info: { pageId: string; meta: PbFabricObjectEditMeta } | null) => {
      if (!info) {
        setPbEditHover(null);
        return;
      }
      const pageIndex = pbPages.findIndex((p) => p.id === info.pageId);
      if (pageIndex >= 0) {
        activatePbPage(pageIndex);
      }
      if (info.meta.pbKind === 'image-frame') {
        setPbSelectedFrameId(info.meta.frameId ?? null);
        setPbSelectedFramePageId(info.pageId);
        if (!info.meta.frameFilled) {
          openPbUploadImagesSidebar();
          if (pbUploadedImages.length === 0) {
            triggerPbDropZoneNudge();
          }
          return;
        }
        setPbEditHover({ pageId: info.pageId, meta: info.meta });
        setPbEditCanvasPageSelected(false);
        setPbEditPageHeadlinePageId(null);
        openPbEditSidebar();
        return;
      }
      setPbEditHover({ pageId: info.pageId, meta: info.meta });
      setPbEditCanvasPageSelected(false);
      setPbEditPageHeadlinePageId(null);
      setPbSelectedFrameId(info.meta.frameId ?? null);
      setPbSelectedFramePageId(info.meta.frameId ? info.pageId : null);
      openPbEditSidebar();
    },
    [pbPages, openPbEditSidebar, openPbUploadImagesSidebar, activatePbPage, pbUploadedImages.length, triggerPbDropZoneNudge],
  );

  handlePbFabricObjectSelectedRef.current = handlePbFabricObjectSelected;

  const handlePbCanvasBackgroundClick = useCallback(() => {
    setPbEditHover(null);
    setPbEditPageHeadlinePageId(null);
    setPbSelectedFrameId(null);
    setPbSelectedFramePageId(null);
    setPbEditCanvasPageSelected(true);
    if (pbCanvasToolMode !== 'draw' && pbCanvasToolMode !== 'lines') {
      setPbActiveTool('edit');
    }
  }, [pbCanvasToolMode]);

  const openPbPageLayoutSidebar = useCallback(
    (pageIndex: number) => {
      const page = pbPages[pageIndex];
      if (!page || page.locked) return;
      activatePbPage(pageIndex);
      pbFabricApiRef.current[page.id]?.clearSelection?.();
      setPbEditHover(null);
      setPbEditPageHeadlinePageId(null);
      setPbSelectedFrameId(null);
      setPbSelectedFramePageId(null);
      setPbEditCanvasPageSelected(true);
      openPbEditSidebar();
    },
    [pbPages, activatePbPage, openPbEditSidebar],
  );

  const openPbCoverDesignSidebar = useCallback(
    (pageIndex: number) => {
      const page = pbPages[pageIndex];
      if (!page || page.locked || page.id !== 'fc') return;
      activatePbPage(pageIndex);
      pbFabricApiRef.current[page.id]?.clearSelection?.();
      setPbEditHover(null);
      setPbEditPageHeadlinePageId(null);
      setPbSelectedFrameId(null);
      setPbSelectedFramePageId(null);
      setPbEditCanvasPageSelected(true);
      openPbEditSidebar();
    },
    [pbPages, activatePbPage, openPbEditSidebar],
  );

  const getPbPageHeadlineStyle = useCallback((page: (typeof pbPages)[number]): PbFabricTextStyle => {
    const custom = page.pageTextStyle ?? {};
    return {
      fill: custom.fill ?? '#1f2937',
      fontSize: custom.fontSize ?? 28,
      fontFamily: custom.fontFamily ?? page.fontFamily ?? pbPhotobookFonts[0].family,
      bold: custom.bold ?? true,
      italic: custom.italic ?? false,
      underline: custom.underline ?? false,
      strikethrough: custom.strikethrough ?? false,
      textAlign: custom.textAlign ?? 'center',
      opacity: custom.opacity ?? 1,
      textTransform: custom.textTransform ?? 'none',
      letterSpacing: custom.letterSpacing ?? 0,
      lineHeight: custom.lineHeight ?? 1.16,
    };
  }, []);

  const applyPbPageHeadlineStyle = useCallback(
    (pageIndex: number, patch: Partial<PbFabricTextStyle>) => {
      setPbPages((pages) => {
        const page = pages[pageIndex];
        if (!page) return pages;
        const updated = [...pages];
        const prevStyle = page.pageTextStyle ?? {};
        const nextStyle = { ...prevStyle, ...patch };
        updated[pageIndex] = {
          ...page,
          pageTextStyle: nextStyle,
          ...(patch.fontFamily !== undefined ? { fontFamily: patch.fontFamily } : {}),
        };
        return updated;
      });
    },
    [],
  );

  const runPbEditAction = useCallback(
    (fn: (api: PbFabricPageApi) => void) => {
      const pageId = pbFrameAdjustPageId ?? pbEditCropPageId ?? pbEditHover?.pageId;
      if (!pageId) return;
      const api = pbFabricApiRef.current[pageId];
      if (api) fn(api);
    },
    [pbEditCropPageId, pbEditHover, pbFrameAdjustPageId],
  );

  useEffect(() => {
    if (photobookEditorState !== 'editor' || pbPreviewMode) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"], emoji-picker')
      ) {
        return;
      }
      if (pbCanvasDeleteKeyHandlerRef.current?.()) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [photobookEditorState, pbPreviewMode]);

  useEffect(() => {
    if (photobookEditorState === 'idle') return;

    const handleGlobalClick = (e: MouseEvent) => {
      if (!pbEditHover && !pbEditPageHeadlinePageId) return;

      const target = e.target as HTMLElement;
      if (!target || !document.contains(target)) return;

      if (
        target.closest('[data-color-picker-root]') ||
        target.closest('[data-color-picker-toggle]') ||
        document.body.hasAttribute('data-pb-color-picker-interacting')
      ) {
        return;
      }

      const clickedOnCanvasPage = 
        !!target.closest('[data-pb-page-id]') || 
        !!target.closest('canvas');

      const clickedOnSidebar = 
        !!target.closest('.' + styles.photobookLeftSidebar);
      
      const clickedOnTopbar = 
        !!target.closest('.' + styles.photobookTopbar);
      
      const clickedOnOverlay = 
        !!target.closest('.' + styles.pbAddPageLayoutOverlay) ||
        !!target.closest('.' + styles.pbDeletePageOverlay) ||
        !!target.closest('.' + styles.pbPasswordModalOverlay) ||
        !!target.closest('[role="dialog"]:not([data-photobook-editor])');

      if (!clickedOnCanvasPage && !clickedOnSidebar && !clickedOnTopbar && !clickedOnOverlay) {
        setPbEditHover(null);
        setPbEditPageHeadlinePageId(null);
        setPbEditCanvasPageSelected(false);
        
        const pageId = pbEditHover ? pbEditHover.pageId : pbEditPageHeadlinePageId;
        if (pageId) {
          const api = pbFabricApiRef.current[pageId];
          if (api && api.clearSelection) {
            api.clearSelection();
          }
        }
      }
    };

    document.addEventListener('mousedown', handleGlobalClick, { capture: true });
    return () => document.removeEventListener('mousedown', handleGlobalClick, { capture: true });
  }, [photobookEditorState, pbEditHover, pbEditPageHeadlinePageId]);

  type PbHistorySnapshot = {
    pages: typeof pbPages;
    fabric: Record<string, PbFabricSerialized | undefined>;
    activePageIndex: number;
    activeSlotIndex: number | null;
  };

  const pbHistoryPastRef = useRef<PbHistorySnapshot[]>([]);
  const pbHistoryFutureRef = useRef<PbHistorySnapshot[]>([]);
  const pbHistoryLastRef = useRef<PbHistorySnapshot | null>(null);
  const pbHistoryApplyRef = useRef(false);
  const pbHistoryDebounceRef = useRef<number | null>(null);
  const [pbHistoryRevision, setPbHistoryRevision] = useState(0);
  const refreshPbHistoryUi = useCallback(() => setPbHistoryRevision((n) => n + 1), []);
  const pbCanUndo = pbHistoryRevision >= 0 && pbHistoryPastRef.current.length > 0;
  const pbCanRedo = pbHistoryRevision >= 0 && pbHistoryFutureRef.current.length > 0;

  const pbMakeSnapshot = useCallback((): PbHistorySnapshot => {
    // clone pages shallowly + clone slotImages arrays
    const pagesClone = pbPages.map((p) => ({
      ...p,
      slotImages: p.slotImages ? [...p.slotImages] : p.slotImages,
    }));
    return {
      pages: pagesClone,
      fabric: { ...pbFabricByPageId },
      activePageIndex: pbActivePageIndex,
      activeSlotIndex: pbActivePhotoSlotIndex,
    };
  }, [pbActivePageIndex, pbActivePhotoSlotIndex, pbFabricByPageId, pbPages]);

  const pbPushHistorySnapshot = useCallback(
    (snap: PbHistorySnapshot) => {
      pbHistoryPastRef.current.push(snap);
      if (pbHistoryPastRef.current.length > 60) {
        pbHistoryPastRef.current = pbHistoryPastRef.current.slice(-60);
      }
      pbHistoryFutureRef.current = [];
      refreshPbHistoryUi();
    },
    [refreshPbHistoryUi],
  );

  const pbUndo = useCallback(() => {
    const current = pbHistoryLastRef.current ?? pbMakeSnapshot();
    const past = pbHistoryPastRef.current;
    if (past.length === 0) return;
    const prev = past.pop()!;

    pbHistoryApplyRef.current = true;
    pbHistoryFutureRef.current.unshift(current);
    setPbPages(prev.pages as any);
    setPbFabricByPageId(prev.fabric);
    setPbActivePageIndex(prev.activePageIndex);
    setPbActivePhotoSlotIndex(prev.activeSlotIndex);
    pbHistoryLastRef.current = prev;
    refreshPbHistoryUi();
    requestAnimationFrame(() => {
      pbHistoryApplyRef.current = false;
    });
  }, [pbMakeSnapshot, refreshPbHistoryUi]);

  const pbRedo = useCallback(() => {
    const future = pbHistoryFutureRef.current;
    if (future.length === 0) return;
    const current = pbHistoryLastRef.current ?? pbMakeSnapshot();
    const next = future.shift()!;

    pbHistoryApplyRef.current = true;
    pbHistoryPastRef.current.push(current);
    setPbPages(next.pages as any);
    setPbFabricByPageId(next.fabric);
    setPbActivePageIndex(next.activePageIndex);
    setPbActivePhotoSlotIndex(next.activeSlotIndex);
    pbHistoryLastRef.current = next;
    refreshPbHistoryUi();
    requestAnimationFrame(() => {
      pbHistoryApplyRef.current = false;
    });
  }, [pbMakeSnapshot, refreshPbHistoryUi]);

  useEffect(() => {
    if (photobookEditorState === 'editor') return;
    pbHistoryPastRef.current = [];
    pbHistoryFutureRef.current = [];
    pbHistoryLastRef.current = null;
    refreshPbHistoryUi();
  }, [photobookEditorState, refreshPbHistoryUi]);

  const handlePbFabricChange = useCallback((pageId: string, data: PbFabricSerialized) => {
    if (pageId === 'bc') return;
    setPbFabricByPageId((prev) => ({ ...prev, [pageId]: data }));
  }, []);

  const handlePbFabricRegisterApi = useCallback((pageId: string, api: PbFabricPageApi | null) => {
    if (api) {
      pbFabricApiRef.current[pageId] = api;
      if (pageId === 'bc') {
        api.applyLayout('blank');
      }
    } else {
      delete pbFabricApiRef.current[pageId];
    }
  }, []);

  const runPbFabricPageAction = useCallback((pageId: string, fn: (api: PbFabricPageApi) => void) => {
    const resolvedPageId = pageId || pbActivePageIdRef.current;
    if (!resolvedPageId || resolvedPageId === 'bc') return;
    const tryRun = () => {
      const api = pbFabricApiRef.current[resolvedPageId];
      if (api) {
        fn(api);
        return true;
      }
      return false;
    };
    if (tryRun()) return;
    let tries = 0;
    const retry = () => {
      if (tryRun() || tries >= 24) return;
      tries += 1;
      window.setTimeout(retry, 50);
    };
    retry();
  }, []);

  const handlePbFrameCropOpen = useCallback(
    (payload: {
      pageId: string;
      frameId: string;
      sourceUrl: string;
      frameWidth: number;
      frameHeight: number;
      naturalWidth: number;
      naturalHeight: number;
      crop: PbFrameCrop;
    }) => {
      setPbFrameCropModal(payload);
      setPbSelectedFrameId(payload.frameId);
      setPbSelectedFramePageId(payload.pageId);
      const pageIndex = pbPages.findIndex((p) => p.id === payload.pageId);
      if (pageIndex >= 0) {
        activatePbPage(pageIndex);
      }
    },
    [pbPages, activatePbPage],
  );

  const handlePbFrameCropApply = useCallback(
    (crop: PbFrameCrop) => {
      if (!pbFrameCropModal) return;
      runPbFabricPageAction(pbFrameCropModal.pageId, (api) => {
        api.applyFrameCrop(pbFrameCropModal.frameId, crop);
      });
      setPbFrameCropModal(null);
    },
    [pbFrameCropModal, runPbFabricPageAction],
  );

  const handlePbFrameCropCancel = useCallback(() => {
    setPbFrameCropModal(null);
  }, []);

  const handlePbEmojiPicked = useCallback(
    (e: Event) => {
      const detail = (e as CustomEvent<{ unicode?: string; emoji?: { unicode?: string } }>).detail;
      const emoji = detail?.unicode ?? detail?.emoji?.unicode;
      if (!emoji) return;
      const pageId = pbActivePageIdRef.current;
      const activePage = pageId ? pbPages.find((p) => p.id === pageId) : pbPages[pbActivePageIndex];
      if (!activePage || activePage.locked || activePage.id === 'bc') return;
      setPbCanvasToolMode('select');
      runPbFabricPageAction(activePage.id, (api) => {
        void api.addEmoji(emoji);
      });
      scrollPbPageIntoView(activePage.id);
    },
    [pbPages, pbActivePageIndex, runPbFabricPageAction, scrollPbPageIntoView],
  );

  const handlePbStickerPicked = useCallback(
    (asset: StickerAsset): Promise<void> => {
      const pageId = pbActivePageIdRef.current;
      const activePage = pageId ? pbPages.find((p) => p.id === pageId) : pbPages[pbActivePageIndex];
      if (!activePage || activePage.locked || activePage.id === 'bc') {
        return Promise.reject(new Error('page unavailable'));
      }
      setPbCanvasToolMode('select');
      scrollPbPageIntoView(activePage.id);

      return new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (ok: boolean, err?: unknown) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          if (ok) resolve();
          else reject(err);
        };

        const timeoutId = window.setTimeout(() => {
          showToast('Could not add this sticker. Try another one.', 'error');
          finish(false, new Error('canvas timeout'));
        }, 12000);

        runPbFabricPageAction(activePage.id, (api) => {
          void api
            .addImageFromUrl(asset.url, undefined, undefined, {
              maxSceneDimension: STICKER_INSERT_MAX_SCENE_PX,
              bringToFront: true,
            })
            .then(() => finish(true))
            .catch((err) => {
              showToast('Could not add this sticker. Try another one.', 'error');
              finish(false, err);
            });
        });
      });
    },
    [pbPages, pbActivePageIndex, runPbFabricPageAction, scrollPbPageIntoView, showToast],
  );

  const handlePbStickerDragStart = useCallback((asset: StickerAsset, e: React.DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData('text/pb-sticker-image', asset.url);
    e.dataTransfer.effectAllowed = 'copy';
    setPbStickerDragActive(true);
  }, []);

  const handlePbStickerDragEnd = useCallback(() => {
    setPbStickerDragActive(false);
  }, []);

  // Record history snapshots (debounced) while editing.
  useEffect(() => {
    if (photobookEditorState !== 'editor') return;
    if (pbHistoryApplyRef.current) return;
    if (pbPreviewMode) return;

    if (pbHistoryDebounceRef.current) window.clearTimeout(pbHistoryDebounceRef.current);
    pbHistoryDebounceRef.current = window.setTimeout(() => {
      const snap = pbMakeSnapshot();
      const last = pbHistoryLastRef.current;
      if (!last) {
        pbHistoryLastRef.current = snap;
        refreshPbHistoryUi();
        return;
      }
      pbPushHistorySnapshot(last);
      pbHistoryLastRef.current = snap;
      refreshPbHistoryUi();
    }, 220);

    return () => {
      if (pbHistoryDebounceRef.current) window.clearTimeout(pbHistoryDebounceRef.current);
      pbHistoryDebounceRef.current = null;
    };
  }, [pbPages, pbFabricByPageId, pbActivePageIndex, pbActivePhotoSlotIndex, photobookEditorState, pbPreviewMode, pbMakeSnapshot, pbPushHistorySnapshot, refreshPbHistoryUi]);
  const pbPagesListRef = useRef<HTMLUListElement>(null);
  const pbPagesListItemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const pbPagesListStrideRef = useRef(52);
  const pbPageListDragStartYRef = useRef(0);
  const [pbSaveStatus, setPbSaveStatus] = useState<'saved' | 'saving'>('saved');
  const pbSaveDebounceRef = useRef<number | null>(null);
  const pbSaveRequestRef = useRef(0);
  const pbEditorHydratedRef = useRef(false);
  const [pbProjectId, setPbProjectId] = useState<string | undefined>(initialPhotobookProjectId);
  const [pbIsLocked, setPbIsLocked] = useState(false);
  const [pbLoginOpen, setPbLoginOpen] = useState(false);
  const [savedPbProjectsForProduct, setSavedPbProjectsForProduct] = useState<PhotobookProjectRecord[]>([]);
  const [pbAddingToCart, setPbAddingToCart] = useState(false);
  const [pbAddToCartConfirmOpen, setPbAddToCartConfirmOpen] = useState(false);
  const [pbShowNoPagesModal, setPbShowNoPagesModal] = useState(false);
  const [pbMobileBlockOpen, setPbMobileBlockOpen] = useState(false);
  const [pbCloseEditorConfirmOpen, setPbCloseEditorConfirmOpen] = useState(false);
  const pbImageFileMapRef = useRef<Map<string, File>>(new Map());
  const pbPendingOpenAfterLoginRef = useRef(false);
  const pbPendingProjectLoadRef = useRef<string | undefined>(initialPhotobookProjectId);
  const pbPendingSaveAfterLoginRef = useRef(false);
  const pbResumeDismissedRef = useRef(false);
  const pbSuppressProjectUrlSyncRef = useRef(false);

  const PB_AUTOSAVE_MS = 7000;

  const buildPbPersistInput = useCallback(() => {
    const pageSizeCm = {
      width: pbPageSizePx.widthPx / PB_PX_PER_CM,
      height: pbPageSizePx.heightPx / PB_PX_PER_CM,
    };
    return {
      projectId: pbProjectId,
      productId: String(product.id),
      variationId: selectedVariationId || undefined,
      projectName: pbProjectName,
      quantity,
      pageSizeCm,
      pageSizePx: pbPageSizePx,
      selectedCustomizations,
      textPersonalizations,
      pages: pbPages.map((page) =>
        page.id === 'bc'
          ? { ...page, bg: '#ffffff', layout: 'blank' as const, caption: '', slotImages: [] }
          : page,
      ),
      fabricByPageId: pbFabricByPageId as Record<string, PbFabricSerialized>,
      uploadedImages: pbUploadedImages as PbUploadedImageEntry[],
      imageFileMap: pbImageFileMapRef.current,
      pageIds: pbPages.map((p) => p.id),
      status: 'draft' as const,
    };
  }, [
    pbProjectId,
    product.id,
    selectedVariationId,
    pbProjectName,
    quantity,
    pbPageSizePx,
    selectedCustomizations,
    textPersonalizations,
    pbPages,
    pbFabricByPageId,
    pbUploadedImages,
  ]);

  const captureLiveFabricByPageId = useCallback((): Record<string, PbFabricSerialized> => {
    const merged: Record<string, PbFabricSerialized> = {};
    for (const [pageId, data] of Object.entries(pbFabricByPageId)) {
      if (pageId === 'bc') continue;
      if (data) merged[pageId] = data;
    }
    for (const [pageId, api] of Object.entries(pbFabricApiRef.current)) {
      if (pageId === 'bc') continue;
      const snap = api.captureDocumentSnapshot?.();
      if (snap) merged[pageId] = snap;
    }
    return merged;
  }, [pbFabricByPageId]);

  const syncPbProjectUrl = useCallback((projectId: string) => {
    if (!projectId) return;
    const productId = String(product.id);
    const params = new URLSearchParams();
    params.set('pbProject', projectId);
    const targetUrl = `/product/${productId}?${params.toString()}`;

    if (typeof window !== 'undefined') {
      const currentProject = new URLSearchParams(window.location.search).get('pbProject');
      if (window.location.pathname === `/product/${productId}` && currentProject === projectId) {
        return;
      }
    }

    router.replace(targetUrl, { scroll: false });
  }, [product.id, router]);

  const clearPbProjectUrl = useCallback(() => {
    if (typeof window === 'undefined') return;
    const productId = String(product.id);
    if (window.location.pathname !== `/product/${productId}`) return;

    const params = new URLSearchParams(window.location.search);
    if (!params.has('pbProject')) return;

    params.delete('pbProject');
    const query = params.toString();
    router.replace(query ? `/product/${productId}?${query}` : `/product/${productId}`, { scroll: false });
  }, [product.id, router]);

  const runPbSave = useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
    if (pbIsLocked || (!isAuthenticated && !opts?.force)) return;
    const requestId = ++pbSaveRequestRef.current;
    setPbSaveStatus('saving');
    try {
      const saved = await persistPhotobookProject({
        ...buildPbPersistInput(),
        fabricByPageId: captureLiveFabricByPageId(),
      });
      if (requestId !== pbSaveRequestRef.current) return;
      setPbProjectId(saved.id);
      if (!pbSuppressProjectUrlSyncRef.current) {
        syncPbProjectUrl(saved.id);
      }
      setPbUploadedImages((prev) =>
        prev.map((img) => {
          const remote = saved.projectJson?.uploadedImages?.find((u) => u.id === img.id);
          if (!remote?.bunnyUrl) return img;
          return { ...img, url: remote.bunnyUrl, bunnyUrl: remote.bunnyUrl };
        }),
      );
      setPbSaveStatus('saved');
      return saved.id;
    } catch (err: unknown) {
      if (requestId !== pbSaveRequestRef.current) return;
      setPbSaveStatus('saved');
      if (opts?.silent) return;
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Failed to save design';
      showToast(message, 'error');
    }
  }, [pbIsLocked, isAuthenticated, buildPbPersistInput, captureLiveFabricByPageId, showToast, syncPbProjectUrl]);

  const schedulePbAutosave = useCallback(() => {
    if (pbIsLocked) return;
    if (pbSaveDebounceRef.current) clearTimeout(pbSaveDebounceRef.current);
    pbSaveDebounceRef.current = window.setTimeout(() => {
      pbSaveDebounceRef.current = null;
      void runPbSave();
    }, PB_AUTOSAVE_MS);
  }, [pbIsLocked, runPbSave]);

  useEffect(() => {
    if (!isAuthenticated || !pbPendingSaveAfterLoginRef.current) return;
    if (photobookEditorState !== 'editor' || pbIsLocked) return;
    pbPendingSaveAfterLoginRef.current = false;
    void runPbSave({ force: true });
  }, [isAuthenticated, photobookEditorState, pbIsLocked, runPbSave]);

  const schedulePbAutosaveRef = useRef(schedulePbAutosave);
  schedulePbAutosaveRef.current = schedulePbAutosave;


  const reorderPbPages = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setPbPages((prev) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) {
        return prev;
      }
      const fromPage = prev[fromIndex];
      const toPage = prev[toIndex];
      if (!fromPage || fromPage.id === 'fc' || fromPage.id === 'bc') return prev;
      if (toPage?.id === 'fc' || toPage?.id === 'bc') return prev;
      if (prev[0]?.id === 'fc' && toIndex === 0) return prev;
      if (prev[prev.length - 1]?.id === 'bc' && toIndex === prev.length - 1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setPbActivePageIndex((active) => {
      if (active === fromIndex) return toIndex;
      if (fromIndex < active && toIndex >= active) return active - 1;
      if (fromIndex > active && toIndex <= active) return active + 1;
      return active;
    });
  }, []);

  const requestDeletePbPageAt = useCallback(
    (pageIndex: number) => {
      const targetPage = pbPages[pageIndex];
      if (!targetPage) return;
      if (targetPage.id === 'fc' || targetPage.id === 'bc') {
        showToast('Cover pages cannot be deleted.', 'error');
        return;
      }
      setPbDeletePagePromptIndex(pageIndex);
    },
    [pbPages, showToast],
  );

  const confirmDeletePbPage = useCallback(() => {
    if (pbDeletePagePromptIndex === null) return;
    const pageIndex = pbDeletePagePromptIndex;
    const nextIndex =
      pbActivePageIndex === pageIndex
        ? Math.max(0, pageIndex - 1)
        : pbActivePageIndex > pageIndex
          ? pbActivePageIndex - 1
          : pbActivePageIndex;
    setPbPages((prev) => {
      const nextPages = prev.filter((_, idx) => idx !== pageIndex);
      const target = nextPages[nextIndex];
      if (target) queueScrollToPbPage(target.id, { blink: true });
      return nextPages;
    });
    setPbActivePageIndex(nextIndex);
    setPbDeletePagePromptIndex(null);
  }, [pbActivePageIndex, pbDeletePagePromptIndex, queueScrollToPbPage]);

  useEffect(() => {
    return () => {
      if (pbPageBlinkTimeoutRef.current) {
        window.clearTimeout(pbPageBlinkTimeoutRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (pbActiveTool !== 'pages') return;
    const firstPage = pbPages[0];
    if (!firstPage) return;
    const el = pbPagesListItemRefs.current[firstPage.id];
    if (!el) return;
    const height = el.getBoundingClientRect().height;
    pbPagesListStrideRef.current = height + 5.6;
  }, [pbActiveTool, pbPages]);

  const resolvePbPagesListOverIndex = useCallback(
    (clientY: number) => {
      for (let i = 0; i < pbPages.length; i += 1) {
        const page = pbPages[i];
        const el = pbPagesListItemRefs.current[page.id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) return i;
      }
      return Math.max(0, pbPages.length - 1);
    },
    [pbPages],
  );

  const getPbPagesListShift = useCallback(
    (index: number) => {
      if (pbPageListDragIndex === null || pbPageListOverIndex === null) return 0;
      const from = pbPageListDragIndex;
      const to = pbPageListOverIndex;
      const step = pbPagesListStrideRef.current;
      if (from === to) return 0;
      if (from < to) {
        if (index > from && index <= to) return -step;
      } else if (from > to) {
        if (index >= to && index < from) return step;
      }
      return 0;
    },
    [pbPageListDragIndex, pbPageListOverIndex],
  );

  const handlePbPageListDragStart = useCallback((index: number, e: React.PointerEvent<HTMLButtonElement>) => {
    const page = pbPages[index];
    if (page?.id === 'fc' || page?.id === 'bc') return;
    e.preventDefault();
    e.stopPropagation();
    pbPageListDragStartYRef.current = e.clientY;
    setPbPageListDragIndex(index);
    setPbPageListOverIndex(index);
    setPbPageListDragOffsetY(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pbPages]);

  const handlePbPageListDragMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (pbPageListDragIndex === null) return;
      setPbPageListDragOffsetY(e.clientY - pbPageListDragStartYRef.current);
      const over = resolvePbPagesListOverIndex(e.clientY);
      setPbPageListOverIndex((prev) => (prev === over ? prev : over));
    },
    [pbPageListDragIndex, resolvePbPagesListOverIndex],
  );

  const handlePbPageListDragEnd = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (pbPageListDragIndex === null) return;
      const from = pbPageListDragIndex;
      const to = pbPageListOverIndex ?? from;
      if (from !== to) reorderPbPages(from, to);
      setPbPageListDragIndex(null);
      setPbPageListOverIndex(null);
      setPbPageListDragOffsetY(0);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [pbPageListDragIndex, pbPageListOverIndex, reorderPbPages],
  );

  const flushPbSave = useCallback(() => {
    if (pbSaveDebounceRef.current) clearTimeout(pbSaveDebounceRef.current);
    void runPbSave();
  }, [runPbSave]);

  useEffect(() => {
    if (photobookEditorState !== 'editor') {
      pbEditorHydratedRef.current = false;
      return;
    }
    if (!pbEditorHydratedRef.current) {
      pbEditorHydratedRef.current = true;
      return;
    }
    schedulePbAutosaveRef.current();
  }, [pbPages, pbProjectName, pbFabricByPageId, photobookEditorState]);

  useEffect(() => {
    return () => {
      if (pbSaveDebounceRef.current) clearTimeout(pbSaveDebounceRef.current);
    };
  }, []);

  // Swipe/drag (desktop) + touch via native listeners on mainImageRef (avoids stale state / passive)
  const [mouseStart, setMouseStart] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const mainImageRef = useRef<HTMLDivElement>(null);

  // Custom button pen drawing refs & states
  const pbCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pbLastPos = useRef({ x: 0, y: 0 });

  const collageLenRef = useRef(0);
  const didSwipeRef = useRef(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const zoomScaleRef = useRef(1);
  zoomScaleRef.current = zoomScale;
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  // Pan offset for zoomed image drag
  const [zoomPan, setZoomPan] = useState({ x: 0, y: 0 });
  const zoomPanRef = useRef({ x: 0, y: 0 });
  zoomPanRef.current = zoomPan;
  const [isZoomPanning, setIsZoomPanning] = useState(false);
  const zoomPanStartRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  // Swipe-to-navigate in zoom overlay
  const [zoomSwipeOffset, setZoomSwipeOffset] = useState(0);
  const zoomSwipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [zoomSwiping, setZoomSwiping] = useState(false);
  const [zoomTransitioning, setZoomTransitioning] = useState(false);

  type ZoomOrigin = {
    tcx: number;
    tcy: number;
    s0: number;
    finalW: number;
    finalH: number;
    vw: number;
    vh: number;
  };
  const [zoomOrigin, setZoomOrigin] = useState<ZoomOrigin | null>(null);
  const [zoomAnimToCenter, setZoomAnimToCenter] = useState(false);

  // Membership subscription state
  const [showMembershipDetails, setShowMembershipDetails] = useState(false);
  const [membershipFrequency, setMembershipFrequency] = useState<'daily' | 'alternate' | 'weekly' | 'monthly'>('daily');
  const [membershipQuantity, setMembershipQuantity] = useState('1');
  const [membershipDuration, setMembershipDuration] = useState('30');
  const [showRatingDetailsPopup, setShowRatingDetailsPopup] = useState(false);
  const [ratingMeterAnimateIn, setRatingMeterAnimateIn] = useState(false);
  const [reviewSummaryAnimateIn, setReviewSummaryAnimateIn] = useState(false);
  const [animatedRating, setAnimatedRating] = useState(0);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const [expandedAccordions, setExpandedAccordions] = useState<Record<number, boolean>>({});
  const toggleAccordion = (index: number) => {
    setExpandedAccordions((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  useEffect(() => {
    if (!showRatingDetailsPopup) {
      setRatingMeterAnimateIn(false);
      return;
    }

    const frame = requestAnimationFrame(() => {
      setRatingMeterAnimateIn(true);
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [showRatingDetailsPopup]);

  // Ensure emoji picker web component is registered (client-only).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    import('emoji-picker-element').catch(() => {
      // ignore (picker will just not render)
    });
  }, []);

  // Customize emoji-picker-element shadow DOM (hide built-in search, prevent horizontal scrolling).
  // Important: run not only when switching emoji/sticker tabs, but also when opening the Emoji sidebar,
  // because the picker may mount with its default UI first.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pbActiveTool !== 'emoji') return;
    let cancelled = false;

    const isDark = pbEditorDarkMode;
    const categoryHeaderColor = isDark ? 'rgba(180, 180, 180, 0.75)' : 'rgba(107, 99, 105, 0.85)';
    const tabHoverBg = isDark ? 'rgba(120, 120, 120, 0.15)' : 'rgba(0, 0, 0, 0.06)';
    const tabActiveBg = isDark ? 'rgba(255, 216, 229, 0.35)' : 'rgba(255, 30, 104, 0.12)';

    const apply = () => {
      const picker = pbEmojiPickerRef.current as any;
      const root = picker?.shadowRoot as ShadowRoot | undefined;
      if (!root) return false;

      let style = root.getElementById('pb-emoji-picker-style') as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement('style');
        style.id = 'pb-emoji-picker-style';
        root.appendChild(style);
      }

      style.textContent = `
      /* Collapse built-in search row but keep skintone dropdown usable */
      .search-row {
        height: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: visible !important;
      }
      .pad-top {
        display: none !important;
      }
      .search-wrapper,
      input[type="search"],
      input.search {
        display: none !important;
      }

      /* Hide built-in skin tone (hand) control beside picker search */
      .skintone-button-wrapper,
      .skintone-button {
        display: none !important;
      }

      /* Grid: 7 columns, centered — avoid clipped cells at wrapper edges */
      .emoji-menu {
        overflow-x: hidden !important;
        justify-content: center !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      .emoji,
      button.emoji {
        overflow: visible !important;
      }

      /* Host defaults to width:min-content (nav row can exceed sidebar) */
      :host {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
      }

      /* Emoji category nav: scroll inside sidebar width */
      .nav {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        overflow-x: auto !important;
        scrollbar-width: none !important; /* Hide default scrollbar */
      }
      .nav::-webkit-scrollbar {
        display: none !important;
        height: 0 !important;
        width: 0 !important;
      }

      /* Highlight active category icon with rounded circle */
      .tab[aria-selected="true"] {
        background-color: ${tabActiveBg} !important;
        border-radius: 50% !important;
      }
      .tab {
        transition: background-color 0.2s ease, transform 0.2s ease !important;
        border-radius: 50% !important;
      }
      .tab:hover {
        background-color: ${tabHoverBg} !important;
        transform: scale(1.1) !important;
      }

      /* Remove the blue underline/indicator below nav categories */
      .indicator-wrapper,
      .indicator {
        display: none !important;
      }

      /* Custom Scrollbar for internal Emoji Picker Tab Panel */
      .tabpanel::-webkit-scrollbar {
        width: 6px !important;
        height: 6px !important;
      }
      .tabpanel::-webkit-scrollbar-track {
        background: transparent !important;
      }
      .tabpanel::-webkit-scrollbar-thumb {
        background-color: var(--pb-scrollbar-thumb, rgba(120, 120, 120, 0.4)) !important;
        border-radius: 99px !important;
        border: 1px solid transparent !important;
        background-clip: padding-box !important;
      }
      .tabpanel::-webkit-scrollbar-thumb:hover {
        background-color: var(--pb-scrollbar-thumb-hover, rgba(120, 120, 120, 0.6)) !important;
      }
      .tabpanel {
        scrollbar-width: thin !important;
        scrollbar-color: var(--pb-scrollbar-thumb, rgba(120, 120, 120, 0.4)) transparent !important;
      }

      /* Modern category header dividers */
      h2.category-header,
      .category-header {
        font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif !important;
        font-size: 0.72rem !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
        color: ${categoryHeaderColor} !important;
        background: transparent !important;
        padding: 10px 16px 4px 16px !important;
        margin: 0 !important;
        border: none !important;
        text-align: left !important;
      }

      /* Rounded picker container */
      .picker {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        border-radius: 18px !important;
        overflow: hidden !important;
      }
    `;

      // Set explicitly — do not copy from getComputedStyle (can read shadow defaults like 8 columns before our CSS applies).
      const host = picker as HTMLElement;
      host.style.setProperty('--num-columns', '7');
      host.style.setProperty('--emoji-size', '1.2rem');
      host.style.setProperty('--emoji-padding', '0.32rem');
      host.style.setProperty('--category-emoji-size', '1.1rem');
      host.style.setProperty('--category-emoji-padding', '0.28rem');
      if (isDark) {
        host.style.setProperty('--background', '#1c1c1c');
        host.style.setProperty('--border-color', '#2c2c2c');
        host.style.setProperty('--button-hover-background', '#363636');
        host.style.setProperty('--button-active-background', 'rgba(255, 216, 229, 0.2)');
        host.style.setProperty('--indicator-color', '#ffd8e5');
        host.style.setProperty('--category-indicator-color', '#ffd8e5');
        host.style.setProperty('--category-indicator-fill-color', '#ffd8e5');
        host.style.setProperty('--input-font-color', '#f5f5f5');
        host.style.setProperty('--category-font-color', '#a1a1a6');
        host.style.color = '#ffffff';
      } else {
        host.style.setProperty('--background', '#ffffff');
        host.style.setProperty('--border-color', '#f2f1f6');
        host.style.setProperty('--button-hover-background', '#f2f1f6');
        host.style.setProperty('--button-active-background', 'rgba(255, 30, 104, 0.12)');
        host.style.setProperty('--indicator-color', '#ff1e68');
        host.style.setProperty('--category-indicator-color', '#ff1e68');
        host.style.setProperty('--category-indicator-fill-color', '#ff1e68');
        host.style.setProperty('--input-font-color', '#1c1418');
        host.style.setProperty('--category-font-color', '#6b6369');
        host.style.color = '#1c1418';
      }
      return true;
    };

    // The ref is set after render; retry briefly until shadowRoot exists.
    let tries = 0;
    const tick = () => {
      if (cancelled) return;
      if (apply()) return;
      tries += 1;
      if (tries > 30) return;
      window.setTimeout(tick, 50);
    };
    tick();

    return () => {
      cancelled = true;
    };
  }, [pbEmojiTab, pbActiveTool, pbEditorDarkMode]);

  // emoji-picker-element is a web component — React onEmojiClick often never fires; use DOM listener.
  useEffect(() => {
    if (photobookEditorState !== 'editor' || pbPreviewMode) return;
    if (pbActiveTool !== 'emoji' || pbEmojiTab !== 'emojis') return;

    let attachedPicker: HTMLElement | null = null;
    let intervalId: number | undefined;

    const attach = () => {
      const picker = pbEmojiPickerRef.current;
      if (!picker || picker === attachedPicker) return !!picker;
      if (attachedPicker) {
        attachedPicker.removeEventListener('emoji-click', handlePbEmojiPicked);
      }
      picker.addEventListener('emoji-click', handlePbEmojiPicked);
      attachedPicker = picker;
      return true;
    };

    if (!attach()) {
      let tries = 0;
      intervalId = window.setInterval(() => {
        tries += 1;
        if (attach() || tries >= 30) {
          if (intervalId) window.clearInterval(intervalId);
        }
      }, 50);
    }

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      attachedPicker?.removeEventListener('emoji-click', handlePbEmojiPicked);
      attachedPicker = null;
    };
  }, [photobookEditorState, pbPreviewMode, pbActiveTool, pbEmojiTab, handlePbEmojiPicked]);

  const openPbEmojiSkinToneMenu = useCallback(() => {
    const picker = pbEmojiPickerRef.current as any;
    const root = picker?.shadowRoot as ShadowRoot | undefined;
    if (!root) return;

    // Try a few selectors across versions
    const btn =
      (root.getElementById('skintone-button') as HTMLButtonElement | null) ||
      (root.querySelector('button[aria-label*="skin tone"]') as HTMLButtonElement | null) ||
      (root.querySelector('button[aria-label*="Skin tone"]') as HTMLButtonElement | null) ||
      (root.querySelector('button[aria-label*="Skin tones"]') as HTMLButtonElement | null) ||
      (root.querySelector('.skin-tone-button') as HTMLButtonElement | null) ||
      (root.querySelector('button[title*="skin"]') as HTMLButtonElement | null);
    btn?.click();
  }, []);

  const isDeliverable = (pin: string) => {
    const cleaned = (pin || '').trim();
    if (!/^\d{6}$/.test(cleaned)) return false;
    const configs = getProductDeliveryConfigs(displayProduct);
    if (displayProduct.isNationwideDelivery) return true;
    return configs.some((entry) => entry.pincode === cleaned);
  };

  const getProductDeliveryConfigs = (source: Product | null | undefined) => {
    if (!source) return [] as Array<{ pincode: string; deliveryTimeText?: string }>;
    if (Array.isArray(source.deliveryPincodeConfigs) && source.deliveryPincodeConfigs.length > 0) {
      return source.deliveryPincodeConfigs
        .map((entry) => ({
          pincode: String(entry.pincode || '').trim(),
          deliveryTimeText: String(entry.deliveryTimeText || '').trim(),
        }))
        .filter((entry) => /^\d{6}$/.test(entry.pincode));
    }
    if (Array.isArray(source.deliveryPincodes) && source.deliveryPincodes.length > 0) {
      return source.deliveryPincodes
        .map((pincode) => ({ pincode: String(pincode || '').trim(), deliveryTimeText: '' }))
        .filter((entry) => /^\d{6}$/.test(entry.pincode));
    }
    return [];
  };

  const getDeliveryInfoText = (pin: string, source: Product | null | undefined) => {
    const cleaned = (pin || '').trim();
    if (!/^\d{6}$/.test(cleaned)) return '';
    const configs = getProductDeliveryConfigs(source);
    const matched = configs.find((entry) => entry.pincode === cleaned);
    if (matched) return matched.deliveryTimeText || '3-5 Days delivery';
    if (source?.isNationwideDelivery) return '3-5 Days delivery';
    return 'Not deliverable';
  };

  // Reset membership form when modal closes or product changes
  useEffect(() => {
    if (!isOpen) {
      setShowMembershipDetails(false);
      setMembershipFrequency('daily');
      setMembershipQuantity('1');
      setMembershipDuration('30');
      setShareMenuOpen(false);
    }
  }, [isOpen, product.id]);

  const isPhotobookExperienceOpen = photobookEditorState !== 'idle';

  const pbIsSaving = pbSaveStatus === 'saving';

  const closePhotobookEditor = useCallback(async (options?: { reloadPage?: boolean }) => {
    setPbCursorTooltip(null);
    setPbAddToCartConfirmOpen(false);
    setPbCloseEditorConfirmOpen(false);
    if (pbSaveDebounceRef.current) clearTimeout(pbSaveDebounceRef.current);
    pbSaveDebounceRef.current = null;
    pbResumeDismissedRef.current = true;
    pbPendingProjectLoadRef.current = undefined;
    pbSuppressProjectUrlSyncRef.current = true;
    clearPbProjectUrl();
    try {
      await runPbSave({ silent: true });
    } catch {
      // Still close even if the final save fails.
    }
    setPhotobookEditorState('idle');
    setPbPageSizePx(resolvePhotobookPageSizePx());
    if (options?.reloadPage && typeof window !== 'undefined') {
      window.location.reload();
    }
  }, [runPbSave, clearPbProjectUrl]);

  const requestClosePhotobookEditor = useCallback(() => {
    setPbCloseEditorConfirmOpen(true);
  }, []);

  const closeModal = () => {
    if (isPhotobookExperienceOpen) return;
    setShareMenuOpen(false);
    onClose();
  };

  const stopPhotobookOverlayBubble = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation();
  }, []);

  /** Fabric canvas layers often swallow wheel — scroll the workspace explicitly. */
  const onPbWorkspaceWheel = useCallback((e: React.WheelEvent<HTMLElement>) => {
    if (pbPreviewMode || pbPreviewPreparing) return;
    if (e.ctrlKey || e.metaKey) return;

    const workspace = e.currentTarget;
    const canScrollY = workspace.scrollHeight > workspace.clientHeight;
    const canScrollX = workspace.scrollWidth > workspace.clientWidth;
    if (!canScrollY && !canScrollX) return;

    const target = e.target;
    if (!(target instanceof Element)) return;
    const onFabricSurface = target.closest('.upper-canvas, .lower-canvas, .canvas-container');
    if (!onFabricSurface) return;

    if (canScrollY) workspace.scrollTop += e.deltaY;
    if (canScrollX) workspace.scrollLeft += e.deltaX;
    e.preventDefault();
  }, [pbPreviewMode, pbPreviewPreparing]);

  const resolveMarqueeTargetPage = useCallback(
    (clientX: number, clientY: number) => {
      const pageCandidates = pbPages.flatMap((p) => {
        if (p.locked || pbPreviewMode) return [];
        const c = getPbFabricCanvas(p.id);
        if (!c) return [];
        return [{ pageId: p.id, canvas: c }];
      });
      if (pageCandidates.length === 0) return null;

      let targetPageId = pbActivePageIdRef.current ?? pbPages[pbActivePageIndex]?.id ?? null;
      if (!targetPageId) return null;

      const canvasUnderPointer = findCanvasUnderPointer(
        clientX,
        clientY,
        pageCandidates.map(({ pageId, canvas }) => ({ pageId, canvas })),
      );

      if (canvasUnderPointer && canvasUnderPointer.pageId !== targetPageId) {
        const pageIdx = pbPages.findIndex((p) => p.id === canvasUnderPointer.pageId);
        if (pageIdx >= 0) {
          activatePbPage(pageIdx);
          targetPageId = canvasUnderPointer.pageId;
        }
      } else if (
        isPointerOutsideAllCanvases(
          clientX,
          clientY,
          pageCandidates.map((c) => c.canvas),
        )
      ) {
        const nearest = findNearestPageCanvas(
          clientX,
          clientY,
          pageCandidates.map(({ pageId, canvas }) => ({ pageId, canvas })),
        );
        if (nearest) {
          const pageIdx = pbPages.findIndex((p) => p.id === nearest.pageId);
          if (pageIdx >= 0) {
            activatePbPage(pageIdx);
            targetPageId = nearest.pageId;
          }
        }
      }

      const page = pbPages.find((p) => p.id === targetPageId);
      if (!page || page.locked || pbPreviewMode) return null;

      const canvas = getPbFabricCanvas(targetPageId);
      if (!canvas) return null;

      return { pageId: targetPageId, canvas };
    },
    [activatePbPage, pbPages, pbActivePageIndex, pbPreviewMode],
  );

  const shouldStartWorkspaceMarquee = useCallback(
    (canvas: ReturnType<typeof getPbFabricCanvas>, event: React.PointerEvent<HTMLElement>) => {
      if (!canvas) return false;
      if (pbEditCropPageId || pbFrameAdjustPageId) return false;
      if (hasCropOverlayOnCanvas(canvas)) return false;
      if (isPointerOnCropOverlay(canvas, event.nativeEvent)) return false;
      if (canvas._currentTransform || canvas.isDrawingMode) return false;
      if (!isPointerOverCanvas(canvas, event.clientX, event.clientY)) return true;
      return !findFabricUserTarget(canvas, event.nativeEvent);
    },
    [pbEditCropPageId, pbFrameAdjustPageId],
  );

  const endWorkspaceMarquee = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const state = workspaceMarqueeRef.current;
      if (!state?.active || state.pointerId !== event.pointerId) return;

      const canvas = getPbFabricCanvas(state.pageId);

      try {
        const dragRect = normalizeSceneRect(state.sceneStart, state.sceneCurrent);
        if (canvas && (dragRect.width > 2 || dragRect.height > 2)) {
          finishFabricSelection(canvas, state.sceneStart, state.sceneCurrent);
          const active = canvas.getActiveObject();
          if (active) {
            handlePbFabricObjectSelectedRef.current({
              pageId: state.pageId,
              meta: getObjectEditMeta(active),
            });
          } else {
            handlePbFabricObjectSelectedRef.current(null);
          }
        } else if (canvas) {
          const hit = findFabricUserTarget(canvas, event.nativeEvent);
          if (hit) {
            canvas.setActiveObject(hit);
            canvas.requestRenderAll();
            handlePbFabricObjectSelectedRef.current({
              pageId: state.pageId,
              meta: getObjectEditMeta(hit),
            });
          } else {
            canvas.discardActiveObject();
            canvas.requestRenderAll();
            handlePbFabricObjectSelectedRef.current(null);
          }
        }
      } finally {
        setMarqueeVisual(null);
        clearMarqueeDragPreview(canvas);
        workspaceMarqueeRef.current = null;
        try {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        } catch {
          // ignore
        }
      }
    },
    [],
  );

  const onPbWorkspacePointerDownCapture = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      if (!target) return;

      if (
        target.closest('[data-color-picker-root]') ||
        target.closest('[data-color-picker-toggle]') ||
        document.body.hasAttribute('data-pb-color-picker-interacting')
      ) {
        return;
      }

      const insideToolbar =
        target.closest('.' + styles.pbCanvasToolbar) ||
        target.closest('.' + styles.pbFabricObjectToolbar) ||
        target.closest('.' + styles.pbWorkspaceHeaderControls) ||
        target.closest('[class*="Toolbar"]') ||
        target.closest('button') ||
        target.closest('aside') ||
        target.closest('nav');

      if (insideToolbar || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (pbWorkspaceMode === 'hand') {
        e.preventDefault();
        e.stopPropagation();

        const workspace = photobookMainWorkspaceRef.current;
        if (!workspace) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const startScrollLeft = workspace.scrollLeft;
        const startScrollTop = workspace.scrollTop;
        const pointerId = e.pointerId;

        try {
          e.currentTarget.setPointerCapture(pointerId);
        } catch {}

        const onWindowMove = (ev: PointerEvent) => {
          workspace.scrollLeft = startScrollLeft - (ev.clientX - startX);
          workspace.scrollTop = startScrollTop - (ev.clientY - startY);
        };

        const onWindowUp = () => {
          window.removeEventListener('pointermove', onWindowMove);
          window.removeEventListener('pointerup', onWindowUp);
          window.removeEventListener('pointercancel', onWindowUp);
          try {
            workspace.releasePointerCapture(pointerId);
          } catch {}
        };

        window.addEventListener('pointermove', onWindowMove);
        window.addEventListener('pointerup', onWindowUp);
        window.addEventListener('pointercancel', onWindowUp);
        return;
      }

      if (pbCanvasToolMode === 'draw' || pbCanvasToolMode === 'lines') return;

      const resolved = resolveMarqueeTargetPage(e.clientX, e.clientY);
      if (!resolved) return;

      const { pageId, canvas } = resolved;
      if (!shouldStartWorkspaceMarquee(canvas, e)) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}

      const sceneStart = getFabricScenePointer(canvas, e.nativeEvent);
      workspaceMarqueeRef.current = {
        active: true,
        pointerId: e.pointerId,
        pageId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        currentClientX: e.clientX,
        currentClientY: e.clientY,
        sceneStart,
        sceneCurrent: sceneStart,
      };

      beginMarqueeDrag(pageId, canvas);
      setMarqueeVisual({
        active: true,
        startClientX: e.clientX,
        startClientY: e.clientY,
        currentClientX: e.clientX,
        currentClientY: e.clientY,
      });
    },
    [
      pbWorkspaceMode,
      pbCanvasToolMode,
      resolveMarqueeTargetPage,
      shouldStartWorkspaceMarquee,
    ],
  );

  const onPbWorkspacePointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const state = workspaceMarqueeRef.current;
    if (!state?.active || state.pointerId !== e.pointerId) return;

    const canvas = getPbFabricCanvas(state.pageId);
    if (!canvas) return;

    state.currentClientX = e.clientX;
    state.currentClientY = e.clientY;
    state.sceneCurrent = getFabricScenePointer(canvas, e.nativeEvent);

    setMarqueeVisual({
      active: true,
      startClientX: state.startClientX,
      startClientY: state.startClientY,
      currentClientX: state.currentClientX,
      currentClientY: state.currentClientY,
    });
    updateMarqueeDragPreview(state.pageId, canvas, state.sceneStart, state.sceneCurrent);
  }, []);

  const onPbWorkspacePointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      endWorkspaceMarquee(e);
    },
    [endWorkspaceMarquee],
  );

  const onPbWorkspacePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      endWorkspaceMarquee(e);
    },
    [endWorkspaceMarquee],
  );

  // Photobook is a dedicated full-screen layer — only the explicit close control dismisses it.
  useEffect(() => {
    if (!isPhotobookExperienceOpen) return;

    const blockEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', blockEscape, true);
    return () => document.removeEventListener('keydown', blockEscape, true);
  }, [isPhotobookExperienceOpen]);

  // Only the photobook canvas should scroll while the editor (or its loader) is open.
  useEffect(() => {
    if (!isPhotobookExperienceOpen) return;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isPhotobookExperienceOpen]);

  useEffect(() => {
    if (!shareMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = shareMenuRef.current;
      if (el && !el.contains(e.target as Node)) {
        setShareMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShareMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [shareMenuOpen]);

  useEffect(() => {
    if (photobookEditorState !== 'editor') {
      setPbEditorSkeletonVisible(false);
      pbEditorSkeletonShownRef.current = false;
      return;
    }
    // Show skeleton effect briefly (~700ms) on initial editor open, but never re-trigger once loaded
    if (!pbEditorSkeletonShownRef.current) {
      setPbEditorSkeletonVisible(true);
      const revealTimer = window.setTimeout(() => {
        setPbEditorSkeletonVisible(false);
        pbEditorSkeletonShownRef.current = true;
      }, 700);
      return () => window.clearTimeout(revealTimer);
    }
  }, [photobookEditorState]);

  // Load saved pincode when modal opens
  useEffect(() => {
    if (isOpen) {
      const savedPincode = readScopedPincode(pinUserId);

      if (savedPincode && savedPincode.length === 6) {
        setPincode(savedPincode);
        setIsPincodeAvailable(null);
      } else {
        setPincode('');
        setIsPincodeAvailable(null);
      }
    }
  }, [isOpen, pinUserId]);

  // Use product details if available, otherwise fallback to basic product
  const displayProduct = productDetails || product;

  const revokePbPreviewObjectUrls = useCallback(() => {
    pbPreviewObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    pbPreviewObjectUrlsRef.current = [];
    setPbPreviewFlipbookUrls([]);
  }, []);

  const togglePbPreviewMode = useCallback(async () => {
    if (pbPreviewPreparing) return;

    setPbPreviewFadeActive(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 280));

    if (pbPreviewMode) {
      revokePbPreviewObjectUrls();
      setPbPreviewMode(false);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      setPbPreviewFadeActive(false);
      return;
    }

    setPbPreviewPreparing(true);
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      const fabricByPageId = captureLiveFabricByPageId();
      const pageSizeCm = {
        width: pbPageSizePx.widthPx / PB_PX_PER_CM,
        height: pbPageSizePx.heightPx / PB_PX_PER_CM,
      };
      const objectUrls = await exportPhotobookPagesForFlipbookPreview(
        pbPages,
        fabricByPageId,
        pbPageSizePx.widthPx,
        pbPageSizePx.heightPx,
        pageSizeCm,
      );

      if (!objectUrls.length) {
        showToast('Could not generate book preview. Try again in a moment.', 'error');
        setPbPreviewFadeActive(false);
        return;
      }

      pbPreviewObjectUrlsRef.current = objectUrls;
      setPbPreviewFlipbookUrls(objectUrls);
      setPbPreviewMode(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    } finally {
      setPbPreviewPreparing(false);
      setPbPreviewFadeActive(false);
    }
  }, [
    pbPreviewMode,
    pbPreviewPreparing,
    pbPages,
    pbPageSizePx.widthPx,
    pbPageSizePx.heightPx,
    captureLiveFabricByPageId,
    revokePbPreviewObjectUrls,
    showToast,
  ]);

  useEffect(() => {
    if (photobookEditorState === 'editor') return;
    revokePbPreviewObjectUrls();
    setPbPreviewMode(false);
    setPbPreviewPreparing(false);
  }, [photobookEditorState, revokePbPreviewObjectUrls]);

  const scrollToReviewSummary = useCallback(() => {
    const section = reviewSummaryRef.current;
    if (!section) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

    if (isFlatPage) {
      section.scrollIntoView({ behavior, block: 'start' });
      return;
    }

    const scrollRoot = modalContentRef.current;
    if (!scrollRoot) {
      section.scrollIntoView({ behavior, block: 'start' });
      return;
    }

    const rootRect = scrollRoot.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const targetTop = scrollRoot.scrollTop + (sectionRect.top - rootRect.top) - 12;
    scrollRoot.scrollTo({ top: Math.max(0, targetTop), behavior });
  }, [isFlatPage]);

  // Desktop-only: set imageGrid padding-top via inline style on scroll
  useEffect(() => {
    if (!isFlatPage) return;
    const STICKY_TOP = 76; // matches top: 76px in CSS

    const onScroll = () => {
      // Read ref fresh every time — avoids stale closure after re-renders
      const el = imageSectionRef.current;
      if (!el) return;
      if (!window.matchMedia('(min-width: 969px)').matches) return;

      const imageGrid = imageGridRef.current;
      if (!imageGrid) return;

      if (window.scrollY > 0) {
        hasScrolledRef.current = true;
      }

      if (!hasScrolledRef.current) {
        imageGrid.style.setProperty('padding-top', '11px', 'important');
      } else {
        imageGrid.style.setProperty('padding-top', '0px', 'important');
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // apply correct state immediately on mount
    return () => window.removeEventListener('scroll', onScroll);
  }, [isFlatPage]);

  useEffect(() => {
    setReviewSummaryAnimateIn(false);
    setAnimatedRating(0);

    if (!displayProduct.feedbackAggregates) {
      return;
    }

    const section = reviewSummaryRef.current;
    if (!section) {
      return;
    }

    const scrollRoot = isFlatPage ? null : modalContentRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setReviewSummaryAnimateIn(true);
          observer.disconnect();
        }
      },
      {
        root: scrollRoot,
        threshold: 0.2,
      }
    );

    observer.observe(section);

    return () => observer.disconnect();
  }, [displayProduct.id, displayProduct.feedbackAggregates, isFlatPage, loadingDetails]);

  useEffect(() => {
    if (!reviewSummaryAnimateIn) {
      return;
    }

    const target = displayProduct.feedbackAggregates?.qualityStars ?? 0;
    if (target <= 0) {
      setAnimatedRating(0);
      return;
    }

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAnimatedRating(target);
      return;
    }

    const duration = 1400;
    const start = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedRating(target * eased);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        setAnimatedRating(target);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [reviewSummaryAnimateIn, displayProduct.feedbackAggregates?.qualityStars]);

  const loadSavedPbProjectsForProduct = useCallback(async () => {
    if (!isAuthenticated || !displayProduct.photobookEditorEnabled) {
      setSavedPbProjectsForProduct([]);
      return;
    }
    try {
      const rows = await photobookApi.listProjects();
      const productId = String(displayProduct.id);
      const matching = rows.filter(
        (project) =>
          String(project.productId) === productId
          && project.status !== 'purchased'
          && !project.isLocked,
      );
      setSavedPbProjectsForProduct(matching);
    } catch {
      setSavedPbProjectsForProduct([]);
    }
  }, [isAuthenticated, displayProduct.id, displayProduct.photobookEditorEnabled]);

  useEffect(() => {
    if (!isOpen) return;
    void loadSavedPbProjectsForProduct();
  }, [isOpen, loadSavedPbProjectsForProduct, pbProjectId]);

  const showPbEditSavedDesignsButton =
    displayProduct.photobookEditorEnabled
    && isAuthenticated
    && (savedPbProjectsForProduct.length > 0 || Boolean(pbProjectId));

  // Customization combinables and matchers
  const uploadsVariationGroup = useMemo(
    () => (displayProduct.customizationOptions || []).find((group) => group.type === 'uploads') ?? null,
    [displayProduct.customizationOptions],
  );

  const { polaroidEnabled: resolvedPolaroidUploadEnabled, stripEnabled: resolvedStripUploadEnabled } = useMemo(
    () => resolveUploadFlags(uploadsVariationGroup, displayProduct),
    [uploadsVariationGroup, displayProduct.polaroidUploadEnabled, displayProduct.stripUploadEnabled],
  );

  const maxImages = useMemo(() => {
    if (!uploadsVariationGroup || !uploadsVariationGroup.maxImagesMap) return undefined;

    const options = displayProduct.customizationOptions || [];
    const uploadsIndex = options.findIndex((group) => group.type === 'uploads');
    if (uploadsIndex === -1) return undefined;

    // Iterate backwards starting from uploadsIndex - 1 to find the closest preceding options group
    let precedingGroup = null;
    for (let i = uploadsIndex - 1; i >= 0; i--) {
      const g = options[i];
      if (g.type !== 'uploads' && g.type !== 'text_input') {
        precedingGroup = g;
        break;
      }
    }

    if (!precedingGroup) return undefined;

    const selectedValId = selectedCustomizations[precedingGroup.id];
    const selectedVal = precedingGroup.values?.find((v) => v.id === selectedValId);

    if (!selectedVal) return undefined;

    const cleanChosenVal = removePriceFromName(selectedVal.name).trim().toLowerCase();

    const mapEntry = uploadsVariationGroup.maxImagesMap.find(
      (entry) => removePriceFromName(entry.optionValue).trim().toLowerCase() === cleanChosenVal
    );

    return mapEntry ? mapEntry.maxImages : undefined;
  }, [uploadsVariationGroup, displayProduct.customizationOptions, selectedCustomizations]);

  const combinableGroups = useMemo(() => {
    if (!displayProduct.isCustomizable) return [];
    return (displayProduct.customizationOptions || []).filter(
      (g) => g.type !== 'text_input' && g.type !== 'uploads' && g.values && g.values.length > 0
    );
  }, [displayProduct.isCustomizable, displayProduct.customizationOptions]);

  const matchedCombination = useMemo(() => {
    if (!displayProduct.isCustomizable || !displayProduct.customizationCombinations) return null;

    const sortedGroupIds = Object.keys(selectedCustomizations).sort();
    const activeCombinables = sortedGroupIds.filter(gid =>
      combinableGroups.some(cg => cg.id === gid)
    );

    if (activeCombinables.length === 0) return null;

    const id = activeCombinables.map(gid => selectedCustomizations[gid]).join('-');

    return displayProduct.customizationCombinations.find(c => c.id === id) || null;
  }, [displayProduct.isCustomizable, displayProduct.customizationCombinations, selectedCustomizations, combinableGroups]);

  const loadPhotobookProjectIntoEditor = useCallback(async (projectId: string) => {
    const record = await photobookApi.getProject(projectId);
    if (record.isLocked) {
      showToast('This design has been purchased and can no longer be edited.', 'error');
      return false;
    }

    const json = record.projectJson as PhotobookProjectJson;
    setPbProjectId(record.id);
    syncPbProjectUrl(record.id);
    setPbIsLocked(false);
    setPbProjectName(json.projectName || record.projectName || 'My Project');
    setQuantity(json.quantity || record.quantity || 1);
    if (json.selectedCustomizations) setSelectedCustomizations(json.selectedCustomizations);
    if (json.textPersonalizations) setTextPersonalizations(json.textPersonalizations);
    if (json.variationId) setSelectedVariationId(String(json.variationId));
    if (json.pageSizePx) setPbPageSizePx(json.pageSizePx);
    if (json.pages?.length) {
      setPbPages(
        (json.pages as typeof pbPages).map((page) =>
          page.id === 'bc'
            ? { ...page, bg: '#ffffff', layout: 'blank', caption: '', slotImages: [] }
            : page,
        ),
      );
    }
    if (json.fabricByPageId) {
      const { bc: _bcFabric, ...fabricWithoutBackCover } = json.fabricByPageId;
      setPbFabricByPageId(fabricWithoutBackCover as typeof pbFabricByPageId);
    }
    setPbUploadedImages(hydrateUploadedImagesFromProject(json));
    pbImageFileMapRef.current.clear();
    setPbActivePageIndex(0);
    if (pbSaveDebounceRef.current) clearTimeout(pbSaveDebounceRef.current);
    pbSaveDebounceRef.current = null;
    setPbSaveStatus('saved');
    return true;
  }, [showToast, syncPbProjectUrl]);

  const openPhotobookEditor = useCallback(async (opts?: { projectId?: string }) => {
    if (isPhotobookMobileViewport()) {
      setPbMobileBlockOpen(true);
      return false;
    }

    pbSuppressProjectUrlSyncRef.current = false;

    const projectId = opts?.projectId || pbPendingProjectLoadRef.current;
    let resumedFromProject = false;

    if (projectId) {
      try {
        const loaded = await loadPhotobookProjectIntoEditor(projectId);
        if (!loaded) return false;
        resumedFromProject = true;
      } catch {
        showToast('Could not load your saved design.', 'error');
        return false;
      }
    }

    if (!resumedFromProject) {
      const gate = canOpenPhotobookEditor(displayProduct, selectedCustomizations);
      if (!gate.ok) {
        showToast(gate.message, 'error');
        return false;
      }
      setPbPageSizePx(gate.pageSize);
    }

    pbPendingProjectLoadRef.current = undefined;
    setPhotobookEditorState('editor');
    if (!resumedFromProject && !projectId) {
      if (isAuthenticated) {
        void runPbSave({ silent: true });
      } else {
        pbPendingSaveAfterLoginRef.current = true;
      }
    }
    return true;
  }, [displayProduct, selectedCustomizations, showToast, isAuthenticated, loadPhotobookProjectIntoEditor, runPbSave]);

  const beginPhotobookEditorShell = useCallback(() => {
    if (isPhotobookMobileViewport()) {
      setPbMobileBlockOpen(true);
      return false;
    }

    const resumingProject = Boolean(pbPendingProjectLoadRef.current || initialPhotobookProjectId);
    if (!resumingProject) {
      const gate = canOpenPhotobookEditor(displayProduct, selectedCustomizations);
      if (!gate.ok) {
        showToast(gate.message, 'error');
        return false;
      }
      setPbPageSizePx(gate.pageSize);
    }
    setPhotobookEditorState('editor');
    return true;
  }, [displayProduct, selectedCustomizations, showToast, initialPhotobookProjectId]);

  useEffect(() => {
    if (!isOpen || !initialPhotobookProjectId || photobookEditorState !== 'idle') return;
    if (pbResumeDismissedRef.current) return;
    pbPendingProjectLoadRef.current = initialPhotobookProjectId;
    if (!isAuthenticated) {
      pbPendingOpenAfterLoginRef.current = true;
      if (beginPhotobookEditorShell()) {
        setPbLoginOpen(true);
      }
      return;
    }
    void openPhotobookEditor({ projectId: initialPhotobookProjectId });
  }, [isOpen, initialPhotobookProjectId, isAuthenticated, photobookEditorState, openPhotobookEditor, beginPhotobookEditorShell]);

  // Initialize customizable options and text personalization fields
  useEffect(() => {
    if (!isOpen) return;
    setUploadedPrintItems([]);
    setUploadedPrintMode(resolvedPolaroidUploadEnabled ? 'polaroid' : 'strip');

    if (displayProduct && displayProduct.isCustomizable) {
      // Resuming a saved design restores customizations when the project loads.
      if (initialPhotobookProjectId) return;

      const initialCustomizations: Record<string, string> = {};
      const initialText: Record<string, string> = {};

      // Only initialise text fields — do NOT pre-select any option group.
      // The customer must actively choose each option (progressive unlock).
      const options = displayProduct.customizationOptions || [];
      options.forEach((group) => {
        if (group.type === 'text_input') {
          (group.values || []).forEach(val => {
            initialText[`${group.id}_${val.id}`] = '';
          });
        }
        // No pre-selection for colour_palette / image_selector / option_buttons
      });
      setSelectedCustomizations(initialCustomizations);
      setTextPersonalizations(initialText);
    }
  }, [isOpen, displayProduct?.id, displayProduct?.isCustomizable, resolvedPolaroidUploadEnabled, initialPhotobookProjectId]);

  const currentDeliveryInfoText = getDeliveryInfoText(pincode, displayProduct);
  const sharePageUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/product/${displayProduct.id}` : '';

  const effectiveCategoryId = displayProduct.categoryId ?? null;

  // Auto-evaluate availability once we have both pincode + config
  useEffect(() => {
    if (!isOpen) return;
    if (pincode.length !== 6) return;
    const cleaned = pincode.trim();
    const configs = getProductDeliveryConfigs(displayProduct);
    const ok = Boolean(displayProduct.isNationwideDelivery) || configs.some((entry) => entry.pincode === cleaned);
    setIsPincodeAvailable(ok);
  }, [isOpen, pincode, displayProduct]);

  // Listen for storage events (for cross-tab sync only)
  useEffect(() => {
    if (!isOpen) return;

    const handleStorageChange = (e: StorageEvent) => {
      const pk = scopedPincodeKey(pinUserId);
      if (e.key === pk || e.key === 'milko_delivery_pincode') {
        setPincode((e.newValue || readScopedPincode(pinUserId) || '').trim());
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isOpen, pinUserId]);

  // Listen for pincode-updated event from Header modal
  useEffect(() => {
    if (!isOpen) return;

    const handlePincodeUpdated = (e: CustomEvent) => {
      const detail = e.detail as { pincode?: string; status?: string } | undefined;
      if (detail?.pincode) {
        setPincode(detail.pincode);
        setIsPincodeAvailable(detail.status === 'available');
      }
    };

    window.addEventListener('milko:pincode-updated', handlePincodeUpdated as EventListener);

    return () => {
      window.removeEventListener('milko:pincode-updated', handlePincodeUpdated as EventListener);
    };
  }, [isOpen]);

  // Save pincode to localStorage when changed
  const handlePincodeChange = (val: string) => {
    // Update state first
    setPincode(val);
    // Reset availability when pincode changes
    setIsPincodeAvailable(null);
    // Save to localStorage (use setTimeout to avoid blocking input)
    setTimeout(() => {
      const pk = scopedPincodeKey(pinUserId);
      const sk = scopedPincodeStatusKey(pinUserId);
      if (val.length > 0) {
        localStorage.setItem(pk, val);
      } else {
        localStorage.removeItem(pk);
        localStorage.removeItem(sk);
      }
    }, 0);
  };

  // Load favorites state from user-scoped localStorage when modal opens or product changes
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      setIsFavorite(false);
      return;
    }
    if (!user) {
      setIsFavorite(false);
      return;
    }
    const favKey = `milko_favorites_u_${user.id}`;
    const favsRaw = localStorage.getItem(favKey);
    if (favsRaw) {
      try {
        const favs = JSON.parse(favsRaw);
        setIsFavorite(!!favs[displayProduct.id]);
      } catch (e) {
        console.error(e);
      }
    } else {
      setIsFavorite(false);
    }
  }, [isOpen, displayProduct.id, user?.id]);

  const handleToggleFavorite = () => {
    if (!user) {
      showToast('Please login to add favorites', 'error');
      return;
    }
    if (typeof window === 'undefined') return;
    const favKey = `milko_favorites_u_${user.id}`;
    let favs: Record<string, boolean> = {};
    const favsRaw = localStorage.getItem(favKey);
    if (favsRaw) {
      try {
        favs = JSON.parse(favsRaw);
      } catch (e) {
        console.error(e);
      }
    }
    const nextVal = !isFavorite;
    if (nextVal) {
      favs[displayProduct.id] = true;
    } else {
      delete favs[displayProduct.id];
    }
    localStorage.setItem(favKey, JSON.stringify(favs));
    setIsFavorite(nextVal);
    showToast(
      nextVal
        ? `Added ${displayProduct.name} to favorites`
        : `Removed ${displayProduct.name} from favorites`,
      'success'
    );
    // Dispatch custom event to notify other mounted components to reload favorites
    window.dispatchEvent(new Event('favorites-updated'));
  };

  // Check pincode availability
  const handleCheckPincode = async () => {
    if (pincode.length !== 6) return;

    setIsCheckingPincode(true);
    setIsPincodeAvailable(null);

    setTimeout(() => {
      const isAvailable = isDeliverable(pincode);
      setIsPincodeAvailable(isAvailable);
      setIsCheckingPincode(false);
      if (pincode.length === 6) {
        writeScopedPincode(pinUserId, pincode, isAvailable ? 'available' : 'unavailable');
      }
    }, 800); // Simulate network delay
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen && !isFlatPage) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Disable body scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      // Cleanup function to restore scroll when modal closes
      return () => {
        const scrollY = document.body.style.top;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        // Restore scroll position
        if (scrollY) {
          const savedScrollY = Math.abs(parseInt(scrollY.replace('px', '') || '0', 10));
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            window.scrollTo(0, savedScrollY);
          });
        }
      };
    }
  }, [isOpen, isFlatPage]);

  // Prevent body, page, and parent container scroll when zoom overlay is active
  useEffect(() => {
    if (isZoomOpen) {
      const scrollY = window.scrollY;
      const prevBodyPosition = document.body.style.position;
      const prevBodyTop = document.body.style.top;
      const prevBodyWidth = document.body.style.width;
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;

      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      const preventScrollEvent = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      };

      window.addEventListener('wheel', preventScrollEvent, { passive: false });
      window.addEventListener('touchmove', preventScrollEvent, { passive: false });

      return () => {
        window.removeEventListener('wheel', preventScrollEvent);
        window.removeEventListener('touchmove', preventScrollEvent);

        document.body.style.position = prevBodyPosition;
        document.body.style.top = prevBodyTop;
        document.body.style.width = prevBodyWidth;
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;

        if (scrollY) {
          window.scrollTo(0, scrollY);
        }
      };
    }
  }, [isZoomOpen]);

  useEffect(() => {
    if (!isPrintUploadOpen || isFlatPage) return;

    const el = modalContentRef.current;
    if (!el) return;

    const savedScrollTop = el.scrollTop;

    const freezeScroll = () => {
      if (el.scrollTop !== savedScrollTop) {
        el.scrollTop = savedScrollTop;
      }
    };

    const blockWheel = (e: WheelEvent) => {
      e.preventDefault();
    };

    const blockTouchMove = (e: TouchEvent) => {
      e.preventDefault();
    };

    el.addEventListener('scroll', freezeScroll);
    el.addEventListener('wheel', blockWheel, { passive: false });
    el.addEventListener('touchmove', blockTouchMove, { passive: false });

    return () => {
      el.removeEventListener('scroll', freezeScroll);
      el.removeEventListener('wheel', blockWheel);
      el.removeEventListener('touchmove', blockTouchMove);
    };
  }, [isPrintUploadOpen, isFlatPage]);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setSelectedVariationId(null);
      setIsZoomOpen(false);
      setZoomScale(1);
      setZoomOrigin(null);
      setZoomAnimToCenter(false);
      pinchRef.current = null;
      setExpandedAccordions(isFlatPage ? { 0: true } : {});
      // Fetch product details with images, variations, and reviews
      const fetchDetails = async () => {
        const isFirstLoad = !productDetailsLoadedRef.current;
        if (isFirstLoad) {
          setLoadingDetails(true);
        }
        try {
          const details = await productsApi.getById(product.id, true);
          setProductDetails(details);
          if (getOrderedProductImageUrls(details).length > 0) {
            setSelectedImageIndex(0);
          }
        } catch (error) {
          console.error('Failed to fetch product details:', error);
          // Fallback to basic product data
          setProductDetails(product);
        } finally {
          const holdDelay = isFirstLoad ? 650 : 0;
          setTimeout(() => {
            setLoadingDetails(false);
            productDetailsLoadedRef.current = true;
          }, holdDelay);
        }
      };

      fetchDetails();
    } else {
      productDetailsLoadedRef.current = false;
    }
  }, [isOpen, product.id]);

  // Related products should be same category only (or none)
  useEffect(() => {
    if (!isOpen) return;
    if (!effectiveCategoryId) {
      setRelatedProducts([]);
      setLoadingRelated(false);
      return;
    }

    const fetchRelated = async () => {
      setLoadingRelated(true);
      try {
        const all = await productsApi.getAll();
        const filtered = all
          .filter((p) => p.id !== product.id)
          .filter((p) => (p.categoryId ?? null) === effectiveCategoryId)
          .slice(0, 4);
        setRelatedProducts(filtered);
      } catch (error) {
        console.error('Failed to fetch related products:', error);
        setRelatedProducts([]);
      } finally {
        setLoadingRelated(false);
      }
    };

    fetchRelated();
  }, [isOpen, product.id, effectiveCategoryId]);

  const productImages = getOrderedProductImageUrls(displayProduct);

  const collageItems = productImages;
  collageLenRef.current = collageItems.length;

  const minSwipeDistance = 40;

  const isFromMainImageNavButton = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest('button'));

  /* Capture phase + layout timing so touches on the inner <img> still hit our logic; touch-action:none on CSS stops the browser taking horizontal pans. */
  useLayoutEffect(() => {
    const el = mainImageRef.current;
    if (!el || !isOpen || loadingDetails) return;

    let startX = 0;
    let startY = 0;
    let endX = 0;
    let tracking = false;

    const onStart = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return;
      if (isFromMainImageNavButton(ev.target)) return;
      tracking = true;
      startX = ev.touches[0].clientX;
      startY = ev.touches[0].clientY;
      endX = startX;
      didSwipeRef.current = false;
    };

    const onMove = (ev: TouchEvent) => {
      if (!tracking || ev.touches.length !== 1) return;
      const t = ev.touches[0];
      endX = t.clientX;
      const dx = Math.abs(t.clientX - startX);
      const dy = Math.abs(t.clientY - startY);
      if (dx > dy && dx > 10) {
        didSwipeRef.current = true;
        ev.preventDefault();
      }
    };

    const onEnd = (ev: TouchEvent) => {
      if (!tracking) return;
      const cx = ev.changedTouches[0]?.clientX;
      if (cx !== undefined) endX = cx;
      tracking = false;

      const len = collageLenRef.current;
      if (len <= 1) return;
      const distance = startX - endX;
      if (distance > minSwipeDistance) {
        setSelectedImageIndex((i) => (i + 1) % len);
      } else if (distance < -minSwipeDistance) {
        setSelectedImageIndex((i) => (i - 1 + len) % len);
      }
    };

    const onCancel = () => {
      tracking = false;
    };

    const cap = { capture: true } as const;
    el.addEventListener('touchstart', onStart, { ...cap, passive: true });
    el.addEventListener('touchmove', onMove, { ...cap, passive: false });
    el.addEventListener('touchend', onEnd, { ...cap, passive: true });
    el.addEventListener('touchcancel', onCancel, { ...cap, passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart, cap);
      el.removeEventListener('touchmove', onMove, cap);
      el.removeEventListener('touchend', onEnd, cap);
      el.removeEventListener('touchcancel', onCancel, cap);
    };
  }, [isOpen, loadingDetails, collageItems.length]);

  const openImageZoom = useCallback(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 700;
    const finalW = Math.min(980, vw - 32);
    const finalH = Math.min(720, vh - 32);
    const el = mainImageRef.current;
    if (el) {
      const thumb = el.getBoundingClientRect();
      const tcx = thumb.left + thumb.width / 2;
      const tcy = thumb.top + thumb.height / 2;
      let s0 = Math.min(thumb.width / finalW, thumb.height / finalH, 1);
      if (s0 < 0.12) s0 = 0.12;
      s0 *= 0.96;
      setZoomOrigin({ tcx, tcy, s0, finalW, finalH, vw, vh });
    } else {
      setZoomOrigin({ tcx: vw / 2, tcy: vh / 2, s0: 0.88, finalW, finalH, vw, vh });
    }
    setZoomAnimToCenter(false);
    setZoomScale(1);
    setIsZoomOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setZoomAnimToCenter(true));
    });
  }, []);

  const closeImageZoom = useCallback(() => {
    setIsZoomOpen(false);
    setZoomAnimToCenter(false);
    setZoomOrigin(null);
    setZoomScale(1);
    setZoomPan({ x: 0, y: 0 });
    setZoomSwipeOffset(0);
    setZoomSwiping(false);
    setZoomTransitioning(false);
    pinchRef.current = null;
  }, []);

  const touchPinchDist = (a: React.Touch, b: React.Touch) =>
    Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const onZoomPinchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = {
        distance: touchPinchDist(e.touches[0], e.touches[1]),
        scale: zoomScaleRef.current,
      };
    }
  };

  const onZoomPinchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !pinchRef.current) return;
    const d = touchPinchDist(e.touches[0], e.touches[1]);
    if (d < 1) return;
    const next = pinchRef.current.scale * (d / pinchRef.current.distance);
    setZoomScale(Math.min(4, Math.max(1, Number(next.toFixed(3)))));
  };

  const onZoomPinchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
  };

  // Mouse wheel zoom
  const onZoomWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoomScale((prev) => {
      const next = Math.min(4, Math.max(1, Number((prev + delta).toFixed(3))));
      if (next <= 1) setZoomPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Mouse drag to pan (when zoomed in)
  const onZoomMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoomScale <= 1) return;
    e.preventDefault();
    e.stopPropagation();
    zoomPanStartRef.current = {
      mx: e.clientX,
      my: e.clientY,
      px: zoomPanRef.current.x,
      py: zoomPanRef.current.y,
    };
    setIsZoomPanning(true);
  }, [zoomScale]);

  const onZoomMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isZoomPanning || !zoomPanStartRef.current) return;
    e.preventDefault();
    const dx = e.clientX - zoomPanStartRef.current.mx;
    const dy = e.clientY - zoomPanStartRef.current.my;
    setZoomPan({
      x: zoomPanStartRef.current.px + dx,
      y: zoomPanStartRef.current.py + dy,
    });
  }, [isZoomPanning]);

  const onZoomMouseUp = useCallback((e?: React.MouseEvent) => {
    if (zoomPanStartRef.current && e) {
      const dx = e.clientX - zoomPanStartRef.current.mx;
      const dy = e.clientY - zoomPanStartRef.current.my;
      if (Math.hypot(dx, dy) < 6) {
        // Single click when zoomed in -> zoom out back to 1x smoothly
        setZoomTransitioning(true);
        setZoomScale(1);
        setZoomPan({ x: 0, y: 0 });
        setTimeout(() => setZoomTransitioning(false), 320);
      }
    }
    zoomPanStartRef.current = null;
    setIsZoomPanning(false);
  }, []);

  // Swipe-to-navigate: start (mouse & touch)
  const onZoomSwipeStart = useCallback((clientX: number, clientY: number) => {
    if (zoomScale > 1) return; // only swipe at 1x zoom
    zoomSwipeStartRef.current = { x: clientX, y: clientY, time: Date.now() };
    setZoomSwiping(true);
    setZoomTransitioning(false);
  }, [zoomScale]);

  // Swipe-to-navigate: move (mouse & touch)
  const onZoomSwipeMove = useCallback((clientX: number) => {
    if (!zoomSwiping || !zoomSwipeStartRef.current) return;
    const dx = clientX - zoomSwipeStartRef.current.x;
    setZoomSwipeOffset(dx);
  }, [zoomSwiping]);

  // Swipe-to-navigate: end (mouse & touch)
  const onZoomSwipeEnd = useCallback((clientX: number, clientY?: number) => {
    if (!zoomSwiping || !zoomSwipeStartRef.current) {
      setZoomSwiping(false);
      return;
    }
    const dx = clientX - zoomSwipeStartRef.current.x;
    const dy = clientY !== undefined ? clientY - zoomSwipeStartRef.current.y : 0;
    const dist = Math.hypot(dx, dy);
    const dt = Date.now() - zoomSwipeStartRef.current.time;

    // Single click when at 1x zoom -> zoom in to 2.5x
    if (dist < 8 && dt < 400) {
      setZoomTransitioning(true);
      setZoomSwipeOffset(0);
      setZoomScale(2.5);
      setTimeout(() => setZoomTransitioning(false), 300);
      zoomSwipeStartRef.current = null;
      setZoomSwiping(false);
      return;
    }

    const velocity = Math.abs(dx) / (dt || 1);
    const threshold = window.innerWidth * 0.15; // 15% of viewport
    const shouldNavigate = Math.abs(dx) > threshold || velocity > 0.35;

    setZoomTransitioning(true);

    if (shouldNavigate && collageItems.length > 1) {
      if (dx > 0 && selectedImageIndex > 0) {
        // Swiped right → previous image
        setSelectedImageIndex((i) => i - 1);
      } else if (dx < 0 && selectedImageIndex < collageItems.length - 1) {
        // Swiped left → next image
        setSelectedImageIndex((i) => i + 1);
      }
    }

    setZoomSwipeOffset(0);
    setTimeout(() => {
      setZoomTransitioning(false);
    }, 300);

    zoomSwipeStartRef.current = null;
    setZoomSwiping(false);
  }, [zoomSwiping, collageItems.length, selectedImageIndex]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (isFromMainImageNavButton(e.target)) return;
    setIsDragging(true);
    setMouseStart(e.clientX);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || mouseStart === null) return;
    // Prevent text selection while dragging
    e.preventDefault();
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (isFromMainImageNavButton(e.target)) {
      if (isDragging) {
        setIsDragging(false);
        setMouseStart(null);
      }
      return;
    }
    if (!isDragging || mouseStart === null) return;

    const distance = mouseStart - e.clientX;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    const len = collageLenRef.current;
    if (isLeftSwipe && len > 1) {
      didSwipeRef.current = true;
      setSelectedImageIndex((i) => (i + 1) % len);
    }
    if (isRightSwipe && len > 1) {
      didSwipeRef.current = true;
      setSelectedImageIndex((i) => (i - 1 + len) % len);
    }

    setIsDragging(false);
    setMouseStart(null);
  };

  const onMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setMouseStart(null);
    }
  };

  // Get variations from product details (only show if they exist)
  const variations = (displayProduct.variations && displayProduct.variations.length > 0)
    ? displayProduct.variations
    : [];
  const availableVariations = variations.filter((v) => v.isAvailable);

  useEffect(() => {
    if (!isOpen) return;
    if (availableVariations.length === 0) {
      setSelectedVariationId(null);
      return;
    }
    // Do not auto-select first available variation by default so user has to explicitly choose
    if (selectedVariationId && !availableVariations.some((v) => v.id === selectedVariationId)) {
      setSelectedVariationId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, displayProduct.id, availableVariations.map((v) => v.id).join(',')]);

  const selectedVariation =
    selectedVariationId ? (availableVariations.find((v) => v.id === selectedVariationId) || null) : null;
  const productMaxQuantity = Number.isFinite(displayProduct.maxQuantity) && Number(displayProduct.maxQuantity) > 0
    ? Math.max(1, Math.min(99, Number(displayProduct.maxQuantity)))
    : 99;
  const quantityAlreadyInCart = items.reduce((sum, item) => (
    item.productId === displayProduct.id ? sum + item.quantity : sum
  ), 0);
  const productQuantity = typeof displayProduct.quantity === 'number' ? displayProduct.quantity : null;

  const isCustomOutOfStock = displayProduct.isCustomizable && matchedCombination
    ? (!matchedCombination.isActive || (matchedCombination.stock !== undefined && matchedCombination.stock !== null && matchedCombination.stock <= 0))
    : false;
  const isProductOutOfStock = displayProduct.isActive === false ||
    (productQuantity !== null && productQuantity <= 0) ||
    isCustomOutOfStock;

  const maxComboQty = displayProduct.isCustomizable && matchedCombination && matchedCombination.stock !== undefined && matchedCombination.stock !== null
    ? matchedCombination.stock
    : productMaxQuantity;
  const effectiveMaxQty = displayProduct.isCustomizable
    ? Math.min(productMaxQuantity, maxComboQty)
    : productMaxQuantity;

  const remainingCartCapacity = Math.max(0, effectiveMaxQty - quantityAlreadyInCart);
  const safeQty = Math.max(1, Math.min(quantity, remainingCartCapacity > 0 ? remainingCartCapacity : 1));
  const isAtMaxQuantity = remainingCartCapacity <= 0 || safeQty >= remainingCartCapacity;

  // Customization group state evaluation: only enable the next group when the previous is filled
  const isGroupEnabled = useCallback((idx: number) => {
    const options = displayProduct.customizationOptions || [];
    for (let i = 0; i < idx; i++) {
      const prevGroup = options[i];
      if (prevGroup.type === 'uploads') {
        if (isUploadsVariationActive(prevGroup) && !printUploadCompleted) {
          return false;
        }
        continue;
      }
      if (prevGroup.type === 'text_input') {
        const hasText = (prevGroup.values || []).some(v => {
          const key = `${prevGroup.id}_${v.id}`;
          return (textPersonalizations[key] || '').trim().length > 0 && textPersonalizationDone[key];
        });
        if (!hasText) return false;
      } else {
        if (!selectedCustomizations[prevGroup.id]) {
          return false;
        }
      }
    }
    return true;
  }, [
    displayProduct.customizationOptions,
    selectedCustomizations,
    textPersonalizations,
    textPersonalizationDone,
    printUploadCompleted,
  ]);

  const CUSTOMIZATION_REVEAL_STAGGER_S = 0.07;
  const CUSTOMIZATION_REVEAL_DURATION_MS = 380;
  const prevGroupEnabledRef = useRef<Record<string, boolean>>({});
  const [revealingGroupIds, setRevealingGroupIds] = useState<Set<string>>(new Set());

  const isGroupRevealing = useCallback(
    (groupId: string, groupEnabled: boolean) =>
      revealingGroupIds.has(groupId) ||
      (groupEnabled && prevGroupEnabledRef.current[groupId] === false),
    [revealingGroupIds],
  );

  useEffect(() => {
    prevGroupEnabledRef.current = {};
    setRevealingGroupIds(new Set());
  }, [displayProduct.id]);

  useLayoutEffect(() => {
    if (!isOpen) {
      prevGroupEnabledRef.current = {};
      setRevealingGroupIds(new Set());
      return;
    }

    const options = displayProduct.customizationOptions || [];
    const newlyRevealing: string[] = [];

    options.forEach((group, idx) => {
      const enabled = isGroupEnabled(idx);
      const wasEnabled = prevGroupEnabledRef.current[group.id];

      if (enabled && wasEnabled === false) {
        newlyRevealing.push(group.id);
      }

      prevGroupEnabledRef.current[group.id] = enabled;
    });

    if (newlyRevealing.length === 0) return;

    setRevealingGroupIds((prev) => {
      const next = new Set(prev);
      newlyRevealing.forEach((id) => next.add(id));
      return next;
    });

    const maxItems = Math.max(
      ...newlyRevealing.map((id) => {
        const group = options.find((g) => g.id === id);
        if (!group) return 1;
        if (group.type === 'uploads') return 1;
        return group.values?.length || 1;
      }),
    );
    const timeoutMs =
      maxItems * CUSTOMIZATION_REVEAL_STAGGER_S * 1000 + CUSTOMIZATION_REVEAL_DURATION_MS + 50;

    const timer = window.setTimeout(() => {
      setRevealingGroupIds((prev) => {
        const next = new Set(prev);
        newlyRevealing.forEach((id) => next.delete(id));
        return next;
      });
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [
    isOpen,
    isGroupEnabled,
    displayProduct.customizationOptions,
    selectedCustomizations,
    textPersonalizations,
    textPersonalizationDone,
    printUploadCompleted,
  ]);

  const getCustomizationOptionRevealStyle = useCallback(
    (groupId: string, groupEnabled: boolean, index: number): CSSProperties | undefined =>
      isGroupRevealing(groupId, groupEnabled)
        ? { animationDelay: `${index * CUSTOMIZATION_REVEAL_STAGGER_S}s` }
        : undefined,
    [isGroupRevealing],
  );

  const allCustomizationsCompleted = useMemo(() => {
    if (!displayProduct.isCustomizable) return true;
    const options = displayProduct.customizationOptions || [];
    return options.every(group => {
      if (group.type === 'uploads') {
        if (!isUploadsVariationActive(group)) {
          return true;
        }
        return printUploadCompleted;
      }
      if (group.type === 'text_input') {
        return (group.values || []).some(v => {
          const key = `${group.id}_${v.id}`;
          return (textPersonalizations[key] || '').trim().length > 0 && textPersonalizationDone[key];
        });
      } else {
        return !!selectedCustomizations[group.id];
      }
    });
  }, [
    displayProduct.isCustomizable,
    displayProduct.customizationOptions,
    selectedCustomizations,
    textPersonalizations,
    textPersonalizationDone,
    printUploadCompleted,
  ]);

  const requiresCustomizationCompletion =
    displayProduct.isCustomizable &&
    Boolean(displayProduct.customizationOptions?.length) &&
    !allCustomizationsCompleted;

  const isAnyOptionSelected = useMemo(() => {
    const hasCustomizationOptions = displayProduct.isCustomizable && Boolean(displayProduct.customizationOptions?.length);
    const hasVariations = Boolean(variations?.length);

    if (!hasCustomizationOptions && !hasVariations) {
      return true;
    }

    if (hasVariations && selectedVariationId !== null) {
      return true;
    }

    if (hasCustomizationOptions) {
      const selectedKeys = Object.keys(selectedCustomizations).filter(key => !!selectedCustomizations[key]);
      if (selectedKeys.length > 0) return true;
      if (Object.values(textPersonalizations).some(val => val.trim().length > 0)) return true;
      if (printUploadCompleted) return true;
    }

    return false;
  }, [
    displayProduct.isCustomizable,
    displayProduct.customizationOptions,
    variations,
    selectedVariationId,
    selectedCustomizations,
    textPersonalizations,
    printUploadCompleted
  ]);

  // Fire the one-shot glow whenever all customizations become complete
  useEffect(() => {
    if (allCustomizationsCompleted) {
      setGlowActive(true);
      const t = setTimeout(() => setGlowActive(false), 3000);
      return () => clearTimeout(t);
    } else {
      setGlowActive(false);
    }
  }, [allCustomizationsCompleted]);

  useEffect(() => {
    if (!isOpen) return;
    if (remainingCartCapacity <= 0) {
      if (quantity !== 1) setQuantity(1);
      return;
    }
    if (quantity > remainingCartCapacity) {
      setQuantity(remainingCartCapacity);
    }
  }, [isOpen, quantity, remainingCartCapacity]);

  // Reviews should only show real, approved customer reviews
  const reviews = (displayProduct.reviews || []).filter((r: ProductReview) => r.isApproved);

  const formatReviewRelativeDate = (iso: string): string => {
    const created = new Date(iso);
    if (Number.isNaN(created.getTime())) return '';
    const diffMs = Date.now() - created.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
  };

  const renderReviewStars = (rating: number) => (
    <div className={styles.reviewRating} data-rating={rating} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${styles.reviewStarIcon} ${star <= rating ? styles.reviewStarFilled : styles.reviewStarEmpty}`}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557L3.04 10.385a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z" />
        </svg>
      ))}
    </div>
  );
  const isTrialMode = mode === 'trial';

  // Get feedback aggregates (from order feedback)
  const feedback = displayProduct.feedbackAggregates;

  // Calculate average rating from "Quality of the product" only (for circular badge)
  const qualityRating = feedback?.qualityStars ?? null;

  // Calculate average rating from reviews (fallback for product header display)
  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : (qualityRating ?? 0);

  // Rating meter helpers for inline detailed ratings display
  const RATING_METER_SEGMENT_COLORS = ['#fde2ea', '#f9b8d0', '#f58cb5', '#ef4f86', '#d81b60'];
  const RATING_METER_STROKE_WIDTH = 8;

  const buildRatingMeterArcPath = (
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ) => {
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy - radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy - radius * Math.sin(endAngle);
    return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
  };

  const renderSingleRatingMeter = (
    rating: number | null | undefined,
    key: string,
    label: string,
    animateIn: boolean
  ) => {
    const value = rating ?? 0;
    const displayValue = value > 0 ? value.toFixed(1) : '0';
    const segmentCount = RATING_METER_SEGMENT_COLORS.length;
    const clampedValue = Math.min(segmentCount, Math.max(0, value));
    const fullSegments = Math.floor(clampedValue);
    const partialFraction = clampedValue - fullSegments;

    return (
      <div key={key} className={styles.ratingMeterCard} title={label}>
        <div className={styles.ratingMeterShell}>
          <svg
            className={styles.ratingMeterSvg}
            viewBox="0 0 100 62"
            role="img"
            aria-label={`${label}: ${displayValue} out of 5`}
          >
            {RATING_METER_SEGMENT_COLORS.map((_, index) => {
              const startAngle = Math.PI - (index / segmentCount) * Math.PI;
              const endAngle = Math.PI - ((index + 1) / segmentCount) * Math.PI;

              return (
                <path
                  key={`${key}-bg-${index}`}
                  className={styles.ratingMeterSegmentBg}
                  d={buildRatingMeterArcPath(50, 48, 38, startAngle, endAngle)}
                  fill="none"
                  strokeWidth={RATING_METER_STROKE_WIDTH}
                  strokeLinecap="butt"
                />
              );
            })}
            {RATING_METER_SEGMENT_COLORS.map((color, index) => {
              const startAngle = Math.PI - (index / segmentCount) * Math.PI;
              const endAngle = Math.PI - ((index + 1) / segmentCount) * Math.PI;
              const isFull = index < fullSegments;
              const isPartial = index === fullSegments && partialFraction > 0;
              const shouldShow = isFull || isPartial;

              if (!shouldShow) {
                return null;
              }

              const targetFill = isPartial ? partialFraction : 1;

              return (
                <path
                  key={`${key}-segment-${index}`}
                  className={`${styles.ratingMeterSegment}${animateIn ? ` ${styles.ratingMeterSegmentFilled}` : ''}`}
                  d={buildRatingMeterArcPath(50, 48, 38, startAngle, endAngle)}
                  fill="none"
                  stroke={color}
                  strokeWidth={RATING_METER_STROKE_WIDTH}
                  strokeLinecap="butt"
                  pathLength={1}
                  style={{
                    ['--segment-fill' as string]: targetFill,
                    ['--segment-fill-gap' as string]: 1 - targetFill,
                    ['--segment-delay' as string]: `${index * 180}ms`,
                  }}
                />
              );
            })}
          </svg>
          <span className={styles.ratingMeterValue}>{displayValue}</span>
        </div>
        <span className={styles.ratingMeterLabel}>{label}</span>
      </div>
    );
  };

  const descriptionHtml = toSafeHtml(displayProduct.description || '');

  // Measures the pixel width of a text string at the inlineSelect font (bold 1.25rem Inter)
  const measureSelectWidth = (text: string): string => {
    if (typeof window === 'undefined') return 'auto';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'auto';
    ctx.font = 'bold 1.25rem Inter, -apple-system, sans-serif';
    const textWidth = ctx.measureText(text).width;
    // Add padding-left (0.25rem≈4px) + arrow area (1.4rem≈22px) + a small buffer
    const totalPx = Math.ceil(textWidth) + 4 + 24;
    return `${totalPx}px`;
  };

  const baseSelling = (displayProduct.sellingPrice !== null && displayProduct.sellingPrice !== undefined)
    ? displayProduct.sellingPrice
    : displayProduct.pricePerLitre;
  const baseCompare = (displayProduct.compareAtPrice !== null && displayProduct.compareAtPrice !== undefined)
    ? displayProduct.compareAtPrice
    : null;

  let unitPrice = baseSelling;
  let originalUnitPrice: number | null = baseCompare;
  let unitLabel = 'unit';

  if (displayProduct.isCustomizable) {
    let sellingSum = baseSelling;
    let compareSum = baseCompare;

    if (matchedCombination && matchedCombination.price !== undefined && matchedCombination.price !== null) {
      sellingSum = matchedCombination.price;
    } else {
      // Sum base price + active selections additional price
      (displayProduct.customizationOptions || []).forEach(group => {
        if (group.type !== 'text_input') {
          const selectedValId = selectedCustomizations[group.id];
          const val = (group.values || []).find(v => v.id === selectedValId);
          if (val && typeof val.price === 'number') {
            sellingSum += val.price;
          }
        }
      });
    }

    // Text input additional price addition (if customer typed text)
    (displayProduct.customizationOptions || []).forEach(group => {
      if (group.type === 'text_input') {
        (group.values || []).forEach(val => {
          const textVal = textPersonalizations[`${group.id}_${val.id}`] || '';
          if (textVal.trim() && typeof val.price === 'number') {
            sellingSum += val.price;
          }
        });
      }
    });

    if (matchedCombination && matchedCombination.compareAtPrice !== undefined && matchedCombination.compareAtPrice !== null) {
      compareSum = matchedCombination.compareAtPrice;
    } else if (baseCompare !== null) {
      compareSum = baseCompare;
      // Add the same extra prices to compareAtPrice as well
      (displayProduct.customizationOptions || []).forEach(group => {
        if (group.type !== 'text_input') {
          const selectedValId = selectedCustomizations[group.id];
          const val = (group.values || []).find(v => v.id === selectedValId);
          if (val && typeof val.price === 'number') {
            compareSum! += val.price;
          }
        }
      });

      (displayProduct.customizationOptions || []).forEach(group => {
        if (group.type === 'text_input') {
          (group.values || []).forEach(val => {
            const textVal = textPersonalizations[`${group.id}_${val.id}`] || '';
            if (textVal.trim() && typeof val.price === 'number') {
              compareSum! += val.price;
            }
          });
        }
      });
    }

    unitPrice = sellingSum;
    originalUnitPrice = compareSum;
  } else {
    const unitMultiplier = selectedVariation?.priceMultiplier ?? 1;
    unitLabel = selectedVariation?.size ?? 'litre';
    unitPrice = selectedVariation?.price ?? (baseSelling * unitMultiplier);
    const variationCompare =
      selectedVariation &&
        selectedVariation.compareAtPrice !== null &&
        selectedVariation.compareAtPrice !== undefined &&
        Number.isFinite(Number(selectedVariation.compareAtPrice))
        ? Number(selectedVariation.compareAtPrice)
        : null;
    originalUnitPrice =
      variationCompare !== null
        ? variationCompare
        : baseCompare !== null
          ? baseCompare * unitMultiplier
          : null;
  }

  const unitOff = originalUnitPrice !== null ? (originalUnitPrice - unitPrice) : 0;

  const priceRange = useMemo(() => {
    const baseSelling = (displayProduct.sellingPrice !== null && displayProduct.sellingPrice !== undefined)
      ? displayProduct.sellingPrice
      : displayProduct.pricePerLitre;

    if (displayProduct.isCustomizable) {
      const combos = displayProduct.customizationCombinations || [];
      const activeCombos = combos.filter(c => c.isActive !== false);
      
      if (activeCombos.length > 0) {
        const prices = activeCombos
          .map(c => c.price)
          .filter((p): p is number => p !== undefined && p !== null);
        
        if (prices.length > 0) {
          return {
            min: Math.min(...prices),
            max: Math.max(...prices)
          };
        }
      }
      
      // Fallback: sum of min/max options
      let minAdd = 0;
      let maxAdd = 0;
      (displayProduct.customizationOptions || []).forEach(group => {
        if (group.type !== 'text_input' && group.values?.length) {
          const activeValues = group.values.filter(v => v.isActive !== false);
          const valPrices = activeValues
            .map(v => v.price)
            .filter((p): p is number => typeof p === 'number');
          
          if (valPrices.length > 0) {
            minAdd += Math.min(...valPrices);
            maxAdd += Math.max(...valPrices);
          }
        }
      });
      return {
        min: baseSelling + minAdd,
        max: baseSelling + maxAdd
      };
    } else {
      const vars = displayProduct.variations || [];
      const activeVars = vars.filter(v => v.isAvailable !== false);
      
      if (activeVars.length > 0) {
        const prices = activeVars.map(v => {
          return v.price ?? (baseSelling * (v.priceMultiplier || 1));
        });
        return {
          min: Math.min(...prices),
          max: Math.max(...prices)
        };
      }
      return {
        min: baseSelling,
        max: baseSelling
      };
    }
  }, [displayProduct]);

  const hasSelectedPrice = displayProduct.isCustomizable
    ? Object.keys(selectedCustomizations).length > 0 || Object.keys(textPersonalizations).length > 0 || matchedCombination !== null
    : selectedVariationId !== null;

  const isRangeAvailable = priceRange.min < priceRange.max;
  const showRange = isRangeAvailable && !hasSelectedPrice;

  // Reset animatedPrice when product changes
  useEffect(() => {
    setAnimatedPrice(null);
  }, [displayProduct.id]);

  // Price Tweening Animation Effect
  useEffect(() => {
    if (animatedPriceRef.current === null) {
      setAnimatedPrice(unitPrice);
      return;
    }

    let startTimestamp: number | null = null;
    const startValue = animatedPriceRef.current;
    const endValue = unitPrice;
    const duration = 50; // ms for ultra-fast responsive feel

    if (startValue === endValue) return;

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing: easeOutQuad
      const easedProgress = progress * (2 - progress);
      const currentValue = startValue + (endValue - startValue) * easedProgress;
      
      setAnimatedPrice(currentValue);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [unitPrice]);

  useEffect(() => {
    if (prevUnitPriceRef.current !== unitPrice && prevUnitPriceRef.current !== 0) {
      const diff = unitPrice - prevUnitPriceRef.current;
      setPriceDirY(diff >= 0 ? 1 : -1);
      setPriceAnimKey((prev) => prev + 1);
    }
    prevUnitPriceRef.current = unitPrice;
  }, [unitPrice]);

  const getPhotobookAuthReturnPath = useCallback(() => {
    const base = `/product/${displayProduct.id}`;
    const projectId = pbProjectId || pbPendingProjectLoadRef.current || initialPhotobookProjectId;
    if (!projectId) return base;
    return `${base}?pbProject=${encodeURIComponent(projectId)}`;
  }, [displayProduct.id, pbProjectId, initialPhotobookProjectId]);

  const handlePbAddToCartClick = useCallback(() => {
    if (pbIsLocked) {
      showToast('This design has been purchased.', 'error');
      return;
    }
    setPbAddToCartConfirmOpen(true);
  }, [pbIsLocked, showToast]);

  const handlePbAddToCart = useCallback(async () => {
    if (pbIsLocked) {
      showToast('This design has been purchased.', 'error');
      return;
    }
    if (!isAuthenticated) {
      setPbAddToCartConfirmOpen(false);
      setPbLoginOpen(true);
      return;
    }

    setPbAddingToCart(true);
    try {
      if (pbSaveDebounceRef.current) clearTimeout(pbSaveDebounceRef.current);
      const saved = await persistPhotobookProject({
        ...buildPbPersistInput(),
        fabricByPageId: captureLiveFabricByPageId(),
        status: 'cart',
      });
      await photobookApi.addToCart(saved.id);
      setPbProjectId(saved.id);

      addItem({
        productId: String(product.id),
        variationId: selectedVariationId || undefined,
        quantity: saved.quantity || quantity,
        customizations: {
          selectedOptions: selectedCustomizations,
          textPersonalization: textPersonalizations,
          photobookProject: {
            projectId: saved.id,
            previewUrl: saved.previewUrl || '',
            projectName: saved.projectName,
            pageCount: saved.pageCount,
            productId: String(product.id),
            variationId: selectedVariationId || undefined,
          },
        },
      }, effectiveMaxQty);

      showToast('Added to cart', 'success');
      setPbAddToCartConfirmOpen(false);
      await closePhotobookEditor();
      router.push('/cart');
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Could not add to cart';
      showToast(message, 'error');
    } finally {
      setPbAddingToCart(false);
    }
  }, [
    pbIsLocked,
    isAuthenticated,
    buildPbPersistInput,
    captureLiveFabricByPageId,
    addItem,
    product.id,
    selectedVariationId,
    quantity,
    selectedCustomizations,
    textPersonalizations,
    showToast,
    effectiveMaxQty,
    closePhotobookEditor,
    router,
  ]);

  if (!isOpen) return null;

  const zMotion = zoomOrigin;
  const zoomContentMotionStyle: CSSProperties =
    isZoomOpen && zMotion
      ? !zoomAnimToCenter
        ? {
          position: 'fixed',
          left: '50%',
          top: '50%',
          width: zMotion.finalW,
          height: zMotion.finalH,
          transform: `translate(calc(-50% + ${zMotion.tcx - zMotion.vw / 2}px), calc(-50% + ${zMotion.tcy - zMotion.vh / 2}px)) scale(${zMotion.s0})`,
          transition: 'none',
          willChange: 'transform',
        }
        : {
          position: 'fixed',
          left: '50%',
          top: '50%',
          width: zMotion.finalW,
          height: zMotion.finalH,
          transform: 'translate(-50%, -50%) scale(1)',
          transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }
      : {};

  const zoomOverlayMotionStyle: CSSProperties =
    isZoomOpen && zMotion
      ? {
        opacity: zoomAnimToCenter ? 1 : 0.32,
        transition: 'opacity 340ms ease',
      }
      : {};

  const renderRelatedSection = (isDesktopLayout = false) => {
    if (isTrialMode) return null;
    const gridClassName = isDesktopLayout ? styles.desktopRelatedProductsGrid : styles.relatedProductsGrid;

    if (loadingRelated) {
      return (
        <div className={`${styles.relatedSection} ${isDesktopLayout ? styles.relatedSectionDesktopOnly : styles.relatedSectionMobileOnly}`}>
          <h3 className={styles.sectionTitle}>Related Products</h3>
          <div className={`${cardStyles.productsGrid} ${gridClassName}`}>
            {[1, 2, 3, 4].slice(0, isDesktopLayout ? 4 : 2).map((i) => (
              <div key={i} className={cardStyles.productCardShimmer}>
                <div className={cardStyles.productImageShimmer}>
                  <div className={`${cardStyles.assuredBadgeShimmer} ${cardStyles.shimmer}`} aria-hidden />
                  <div className={`${cardStyles.imageShimmerFill} ${cardStyles.shimmer}`} aria-hidden />
                </div>
                <div className={cardStyles.productInfoShimmer}>
                  <div className={`${cardStyles.categoryShimmer} ${cardStyles.shimmer}`} aria-hidden />
                  <div className={cardStyles.titleRowShimmer}>
                    <div className={`${cardStyles.nameShimmer} ${cardStyles.shimmer}`} aria-hidden />
                    <div className={`${cardStyles.ratingShimmer} ${cardStyles.shimmer}`} aria-hidden />
                  </div>
                  <div className={`${cardStyles.discountOffShimmer} ${cardStyles.shimmer}`} aria-hidden />
                  <div className={cardStyles.addToCartRowShimmer}>
                    <div className={cardStyles.priceShimmerGroup}>
                      <div className={`${cardStyles.priceAmountShimmer} ${cardStyles.shimmer}`} aria-hidden />
                      <div className={`${cardStyles.priceUnitShimmer} ${cardStyles.shimmer}`} aria-hidden />
                    </div>
                    <div className={`${cardStyles.addButtonShimmer} ${cardStyles.shimmer}`} aria-hidden />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (relatedProducts.length === 0) return null;

    // For desktop we show up to 4, for mobile up to 2
    const displayedProducts = isDesktopLayout ? relatedProducts.slice(0, 4) : relatedProducts.slice(0, 2);

    return (
      <div className={`${styles.relatedSection} ${isDesktopLayout ? styles.relatedSectionDesktopOnly : styles.relatedSectionMobileOnly}`}>
        <h3 className={styles.sectionTitle}>Related Products</h3>
        <div className={`${cardStyles.productsGrid} ${gridClassName}`}>
          {displayedProducts.map((relatedProduct) => {
            const isRelatedProductOutOfStock =
              relatedProduct.isActive === false ||
              (typeof relatedProduct.quantity === 'number' && relatedProduct.quantity <= 0);

            const categoryLabel = relatedProduct.categoryId ? (categoryMap.get(relatedProduct.categoryId) || 'Dairy') : 'Dairy';
            const unitLabel = getProductDisplayUnitLabel(relatedProduct);
            const productImage = getPrimaryProductImageUrl(relatedProduct);
            const averageRating = getAverageProductRating(relatedProduct);

            return (
              <div
                key={relatedProduct.id}
                className={`${cardStyles.productCard} ${isRelatedProductOutOfStock ? cardStyles.productCardOutOfStock : ''}`}
                onClick={() => {
                  if (onRelatedProductClick) {
                    onRelatedProductClick(relatedProduct);
                  } else {
                    window.location.href = `/product/${relatedProduct.id}`;
                  }
                }}
              >
                <div className={cardStyles.productImage}>
                  {isRelatedProductOutOfStock ? (
                    <div className={cardStyles.outOfStockBadge}>Out of stock</div>
                  ) : null}
                  {relatedProduct.isCustomizable ? (
                    <div className={`${cardStyles.assuredBadge} ${cardStyles.customizableBadge}`}>
                      <svg className={cardStyles.verifiedIcon} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                          <g fill="currentColor">
                            <g>
                              <path d="M14.775,1.206 L13.73,4.289 L15.676,6.896 L12.422,6.855 L10.543,9.511 L9.577,6.404 L6.471,5.439 L9.127,3.559 L9.086,0.305 L11.692,2.251 L14.775,1.206 Z"></path>
                              <path d="M1.852,15.533 C1.462,15.924 0.93,16.025 0.664,15.759 L0.258,15.354 C-0.008,15.088 0.094,14.557 0.485,14.166 L10.788,3.863 C11.179,3.472 11.71,3.371 11.976,3.636 L12.382,4.042 C12.648,4.308 12.547,4.839 12.155,5.23 L1.852,15.533 L1.852,15.533 Z"></path>
                              <path d="M13.511,13.949 C13.511,13.949 13.673,12.89 12.901,12.126 C12.128,11.364 11.031,11.5 11.031,11.5 C11.031,11.5 12.297,11.52 12.926,10.897 C13.557,10.274 13.512,9.05 13.512,9.05 C13.512,9.05 13.645,10.4 14.146,10.897 C14.651,11.393 15.993,11.5 15.993,11.5 C15.993,11.5 14.732,11.602 14.174,12.152 C13.614,12.705 13.511,13.949 13.511,13.949 L13.511,13.949 Z"></path>
                              <path d="M8.511,15.949 C8.511,15.949 8.673,14.89 7.901,14.126 C7.128,13.364 6.031,13.5 6.031,13.5 C6.031,13.5 7.297,13.52 7.926,12.897 C8.557,12.274 8.512,11.05 8.512,11.05 C8.512,11.05 8.645,12.4 9.146,12.897 C9.651,13.393 10.993,13.5 10.993,13.5 C10.993,13.5 9.732,13.602 9.174,14.152 C8.614,14.705 8.511,15.949 8.511,15.949 L8.511,15.949 Z"></path>
                              <path d="M3.511,4.949 C3.511,4.949 3.673,3.89 2.901,3.126 C2.128,2.364 1.031,2.5 1.031,2.5 C1.031,2.5 2.297,2.52 2.926,1.897 C3.557,1.274 3.512,0.05 3.512,0.05 C3.512,0.05 3.645,1.4 4.146,1.897 C4.651,2.393 5.993,2.5 5.993,2.5 C5.993,2.5 4.732,2.602 4.174,3.152 C3.614,3.705 3.511,4.949 3.511,4.949 L3.511,4.949 Z"></path>
                            </g>
                          </g>
                        </g>
                      </svg>
                      <span>Customizable</span>
                    </div>
                  ) : null}
                  {productImage ? (
                    <div className="product-card-image-wrapper">
                      <Image
                        src={productImage}
                        alt={relatedProduct.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 968px) 50vw, (max-width: 1200px) 25vw, 25vw"
                        style={{ objectFit: 'contain' }}
                      />
                      {relatedProduct.hoverNextImage && getOrderedProductImageUrls(relatedProduct)[1] && (
                        <div className="product-card-hover-image-container">
                          <Image
                            src={getOrderedProductImageUrls(relatedProduct)[1]}
                            alt={relatedProduct.name}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 968px) 50vw, (max-width: 1200px) 25vw, 25vw"
                            style={{ objectFit: 'contain' }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={cardStyles.placeholderImage}>
                      <img src="/scribble-logo-bw.png" alt="Scribble Logo" className={cardStyles.placeholderLogo} />
                    </div>
                  )}
                </div>
                <div className={cardStyles.productInfo}>
                  {/* Row 1: Product Name and Price */}
                  <div className={cardStyles.productTitleRow}>
                    <h3 className={cardStyles.productName}>{relatedProduct.name}</h3>
                    <span className={cardStyles.productPrice}>{getCardPriceDisplay(relatedProduct, '₹')}</span>
                  </div>

                  {/* Row 2: Category and rating */}
                  <div className={cardStyles.productCategoryRow}>
                    <div className={cardStyles.productCategory}>
                      {categoryLabel}
                    </div>
                    <div className={cardStyles.productRatingCompact}>
                      {(getProductReviewCount(relatedProduct)) > 0 ? (
                        <>
                          <svg className={cardStyles.starIconSmall} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                          </svg>
                          <span>{averageRating.toFixed(1)}</span>
                        </>
                      ) : (
                        <>
                          <svg className={cardStyles.starIconSmall} style={{ color: '#cbd5e1' }} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                          </svg>
                          <span style={{ color: '#94a3b8' }}>0.0</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handlePbMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isAnyOptionSelected) return;
    const canvas = pbCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    pbLastPos.current = { x, y };
  };

  const handlePbMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isAnyOptionSelected) return;
    const canvas = pbCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(pbLastPos.current.x, pbLastPos.current.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#ff1e68'; // Pink pen (matches cursor rgb(255, 30, 104) exactly!)
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    pbLastPos.current = { x, y };
  };

  const handlePbPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPbPasswordError('');
    setIsVerifyingPbPassword(true);
    try {
      await apiClient.post('/api/auth/verify-admin-password', { password: pbPassword });

      // Set bypass cookie
      const BYPASS_MAX_AGE = 86400; // 24 hours
      document.cookie = `${COMING_SOON_BYPASS_COOKIE}=1; path=/; max-age=${BYPASS_MAX_AGE}; samesite=lax`;

      setShowPbPasswordModal(false);
      void openPhotobookEditor();
    } catch (err: any) {
      console.error('Password verification failed:', err);
      setPbPasswordError(err?.message || 'Incorrect password. Please try again.');
      setPbPassword('');
    } finally {
      setIsVerifyingPbPassword(false);
    }
  };

  const handlePbClick = () => {
    if (isPhotobookMobileViewport()) {
      setPbMobileBlockOpen(true);
      return;
    }

    if (!isAuthenticated) {
      if (beginPhotobookEditorShell()) {
        pbPendingOpenAfterLoginRef.current = true;
        setPbLoginOpen(true);
      }
      return;
    }

    const hasBypass = typeof document !== 'undefined' && document.cookie.includes(`${COMING_SOON_BYPASS_COOKIE}=1`);
    if (hasBypass) {
      void openPhotobookEditor();
      return;
    }
    setPhotobookEditorState('loading');
  };

  const handlePbLoginSuccess = async () => {
    setPbLoginOpen(false);
    pbSuppressProjectUrlSyncRef.current = false;
    pbPendingSaveAfterLoginRef.current = false;

    const pendingProjectId = pbPendingProjectLoadRef.current;
    pbPendingProjectLoadRef.current = undefined;
    const wasPendingEditorOpen = pbPendingOpenAfterLoginRef.current;
    pbPendingOpenAfterLoginRef.current = false;

    if (wasPendingEditorOpen && isPhotobookMobileViewport()) {
      setPbMobileBlockOpen(true);
      return;
    }

    if (pendingProjectId) {
      if (photobookEditorState === 'editor') {
        await loadPhotobookProjectIntoEditor(pendingProjectId);
      } else {
        await openPhotobookEditor({ projectId: pendingProjectId });
      }
      return;
    }

    const shouldPersistInEditor = photobookEditorState === 'editor' || wasPendingEditorOpen;

    if (shouldPersistInEditor) {
      if (photobookEditorState !== 'editor') {
        const hasBypass = typeof document !== 'undefined' && document.cookie.includes(`${COMING_SOON_BYPASS_COOKIE}=1`);
        if (hasBypass) {
          const opened = await openPhotobookEditor();
          if (!opened) return;
        } else {
          setPhotobookEditorState('loading');
          return;
        }
      }
      await runPbSave({ force: true });
      return;
    }
  };

  const renderPhotobookExperience = () => {
    if (photobookEditorState === 'idle') return null;

    if (photobookEditorState === 'loading') {
      return (
        <div
          className={styles.photobookLoadingOverlay}
          role="status"
          aria-live="polite"
          aria-modal="true"
          data-photobook-editor
          data-lenis-prevent
          onClick={stopPhotobookOverlayBubble}
          onMouseDown={stopPhotobookOverlayBubble}
        >
          <div className={styles.photobookGradientField} />

          <div className={styles.photobookLoadingTextWrap}>
            <h2 className={styles.photobookComingSoonTitle}>Coming soon</h2>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setPbPasswordError('');
                setPbPassword('');
                setShowPbPasswordModal(true);
              }}
              className={styles.photobookPasswordLink}
            >
              access through password
            </a>
          </div>

          {showPbPasswordModal && (
            <div className={styles.pbPasswordModalOverlay} onClick={() => setShowPbPasswordModal(false)}>
              <div
                className={styles.pbPasswordModal}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className={styles.pbPasswordModalTitle}>Access through password</h3>
                <form onSubmit={handlePbPasswordSubmit} className={styles.pbPasswordForm}>
                  <input
                    type="password"
                    value={pbPassword}
                    onChange={(e) => setPbPassword(e.target.value)}
                    placeholder="Enter password"
                    className={styles.pbPasswordInput}
                    disabled={isVerifyingPbPassword}
                    autoFocus
                  />
                  {pbPasswordError && <p className={styles.pbPasswordError}>{pbPasswordError}</p>}
                  <div className={styles.pbPasswordModalActions}>
                    <button
                      type="button"
                      className={styles.pbPasswordCancelBtn}
                      onClick={() => setShowPbPasswordModal(false)}
                      disabled={isVerifyingPbPassword}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={styles.pbPasswordSubmitBtn}
                      disabled={isVerifyingPbPassword || !pbPassword}
                    >
                      {isVerifyingPbPassword ? 'Verifying…' : 'Access'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      );
    }

    const activePage = pbPages[pbActivePageIndex] || pbPages[0];
    const isPageLocked = !!activePage.locked || activePage.id === 'bc';

    const focusPbPage = (pageIndex: number, options?: { blink?: boolean }) => {
      activatePbPage(pageIndex);
      const page = pbPages[pageIndex];
      if (!page) return;
      scrollPbPageIntoView(page.id, options);
    };

    const getPbCanvasPageLabelFor = (pageIndex: number) => {
      const page = pbPages[pageIndex];
      if (!page) return 'Page';
      if (page.id === 'fc') return 'Front Cover';
      if (page.id === 'bc') return 'Back Cover';
      const pageNum = pbPages.slice(0, pageIndex + 1).filter((p) => p.id !== 'fc' && p.id !== 'bc').length;
      return `Page ${pageNum}`;
    };

    const isPbCoverPage = (page: (typeof pbPages)[number]) => page.id === 'fc' || page.id === 'bc';
    const isPbFrontCoverPage = (page: (typeof pbPages)[number]) => page.id === 'fc';
    const isPbBackCoverPage = (page: (typeof pbPages)[number]) => page.id === 'bc';

    const canMovePbPageUp = (pageIndex: number) => {
      if (pageIndex <= 0) return false;
      const page = pbPages[pageIndex];
      const prevPage = pbPages[pageIndex - 1];
      if (!page || page.id === 'fc' || page.id === 'bc') return false;
      if (prevPage?.id === 'fc') return false;
      return true;
    };

    const canMovePbPageDown = (pageIndex: number) => {
      if (pageIndex >= pbPages.length - 1) return false;
      const page = pbPages[pageIndex];
      const nextPage = pbPages[pageIndex + 1];
      if (!page || page.id === 'fc' || page.id === 'bc') return false;
      if (nextPage?.id === 'bc') return false;
      return true;
    };

    const getPbLayoutSlotCount = (layout?: PbLayout) => {
      const l = normalizeLayoutId(layout ?? 'single');
      switch (l) {
        case 'single':
        case 'center-inset':
        case 'blank':
          return l === 'blank' ? 0 : 1;
        case 'double-center-inset':
        case 'two-vertical':
        case 'stacked-horizontal':
          return 2;
        case 'three-vertical':
        case 'three-horizontal':
          return 3;
        case 'four-vertical':
          return 4;
        case 'text-top':
        case 'text-bottom':
          return 1;
        case 'grid-4':
          return 4;
        case 'grid-6':
          return 6;
        case 'left-full-right-2':
        case 'left-2-right-full':
          return 3;
        default:
          return 1;
      }
    };

    const applyPbPageLayout = (pageIndex: number, layoutId: PbLayoutId) => {
      const page = pbPages[pageIndex];
      if (!page || page.locked) return;
      const pageId = page.id;
      const slotCount = getPbLayoutSlotCount(layoutId as PbLayout);
      setPbPages((prev) => {
        const updated = [...prev];
        updated[pageIndex] = {
          ...updated[pageIndex],
          layout: layoutId as PbLayout,
          slotImages: slotCount > 0 ? Array.from({ length: slotCount }, () => undefined) : [],
        };
        return updated;
      });
      runPbFabricPageAction(pageId, (api) =>
        api.applyLayout(layoutId, page.layoutFrameGapEnabled !== false),
      );
    };

    const setPbPageLayoutFrameGap = (pageIndex: number, enabled: boolean) => {
      const page = pbPages[pageIndex];
      if (!page || page.locked || page.id === 'fc' || page.id === 'bc') return;
      const layoutId = normalizeLayoutId(page.layout);
      if (layoutId === 'blank' || !layoutHasMultipleFrames(layoutId, pbPageSizePx.widthPx, pbPageSizePx.heightPx)) {
        return;
      }
      setPbPages((prev) => {
        const updated = [...prev];
        updated[pageIndex] = {
          ...updated[pageIndex],
          layoutFrameGapEnabled: enabled,
        };
        return updated;
      });
      runPbFabricPageAction(page.id, (api) => api.applyLayout(layoutId, enabled));
    };

    const applyPbCoverDesign = (pageIndex: number, designId: PbCoverDesignId) => {
      const page = pbPages[pageIndex];
      if (!page || page.locked || page.id !== 'fc') return;
      const pageId = page.id;
      setPbPages((prev) => {
        const updated = [...prev];
        updated[pageIndex] = {
          ...updated[pageIndex],
          coverDesign: designId,
          slotImages: [undefined],
        };
        return updated;
      });
      runPbFabricPageAction(pageId, (api) => api.applyCoverDesign(designId));
    };

    const requestPbPageLayoutChange = (pageIndex: number, layoutId: PbLayoutId) => {
      const page = pbPages[pageIndex];
      if (!page || page.locked || page.id === 'fc' || page.id === 'bc') return;
      const current = normalizeLayoutId(page.layout);
      if (current === layoutId) return;
      runPbFabricPageAction(page.id, (api) => {
        if (api.hasFilledFrames()) {
          setPbLayoutChangeConfirm({ pageIndex, layoutId });
        } else {
          applyPbPageLayout(pageIndex, layoutId);
        }
      });
    };

    const requestPbCoverDesignChange = (pageIndex: number, designId: PbCoverDesignId) => {
      const page = pbPages[pageIndex];
      if (!page || page.locked || page.id !== 'fc') return;
      const current = normalizeCoverDesignId(page.coverDesign);
      if (current === designId) return;
      runPbFabricPageAction(page.id, (api) => {
        if (api.hasFilledFrames()) {
          setPbLayoutChangeConfirm({ pageIndex, coverDesignId: designId });
        } else {
          applyPbCoverDesign(pageIndex, designId);
        }
      });
    };

    const setPbSlotImage = (pageIndex: number, slotIndex: number, imgUrl?: string) => {
      const updated = [...pbPages];
      const page = updated[pageIndex];
      if (!page || page.locked) return;

      const slotCount = getPbLayoutSlotCount(page.layout);
      if (slotIndex < 0 || slotIndex >= slotCount) return;

      const nextSlotImages = Array.from({ length: slotCount }, (_, i) => page.slotImages?.[i]);
      nextSlotImages[slotIndex] = imgUrl;

      updated[pageIndex] = {
        ...page,
        slotImages: nextSlotImages,
      };
      setPbPages(updated);
    };

    const setPbPageFontFamily = (fontFamily: string) => {
      if (isPageLocked) return;
      const updated = [...pbPages];
      if (!updated[pbActivePageIndex]) return;
      updated[pbActivePageIndex] = {
        ...updated[pbActivePageIndex],
        fontFamily,
      };
      setPbPages(updated);
    };

    const handleSelectSampleImage = (imgUrl: string) => {
      if (isPageLocked) return;

      if (!pbHasInnerPages) {
        setPbShowNoPagesModal(true);
        return;
      }

      const targetPageId =
        pbSelectedFramePageId ??
        pbPages[pbActivePageIndex]?.id ??
        null;
      const page = targetPageId ? pbPages.find((p) => p.id === targetPageId) : pbPages[pbActivePageIndex];
      if (!page || !targetPageId) return;
      const layoutId = normalizeLayoutId(page.layout);
      runPbFabricPageAction(targetPageId, async (api) => {
        let placed = false;
        if (pbSelectedFrameId) {
          placed = await api.placeImageInFrameById(pbSelectedFrameId, imgUrl);
        }
        if (!placed && layoutId !== 'blank') {
          placed = await api.placeImageInFirstEmptyFrame(imgUrl);
        }
        if (!placed && layoutId === 'blank') {
          await api.addImageFromUrl(imgUrl);
          placed = true;
        }
        if (!placed) {
          showToast('Select a photo frame, or choose a layout with frames.', 'info');
        } else {
          setPbSelectedFrameId(null);
          setPbSelectedFramePageId(null);
          scrollPbPageIntoView(targetPageId);
        }
      });
    };

    const handleSelectBg = (colorVal: string) => {
      if (isPageLocked) return;
      const updated = [...pbPages];
      if (updated[pbActivePageIndex]) {
        updated[pbActivePageIndex].bg = colorVal;
        setPbPages(updated);
      }
    };

    const insertNewPageAt = (layoutType: PbLayout, insertAt: number) => {
      const newPageNum = pbPages.filter((p) => p.label.startsWith('Page')).length + 1;
      const usesHeadlineLayout = layoutType === 'text-top' || layoutType === 'text-bottom';
      const newPage = {
        id: `p_new_${Date.now()}`,
        label: `Page ${newPageNum}`,
        bg: '#ffffff',
        layout: layoutType,
        caption: usesHeadlineLayout ? 'Add headline here...' : '',
        slotImages: Array.from({ length: getPbLayoutSlotCount(layoutType) }, () => undefined),
      };
      const updatedPages = [...pbPages];
      const safeInsertAt = Math.max(0, Math.min(insertAt, updatedPages.length));
      updatedPages.splice(safeInsertAt, 0, newPage);
      setPbPages(updatedPages);
      setPbActivePageIndex(safeInsertAt);
      queueScrollToPbPage(newPage.id, { blink: true });
      const normalizedLayout = normalizeLayoutId(layoutType);
      window.setTimeout(() => {
        runPbFabricPageAction(newPage.id, (api) => api.applyLayout(normalizedLayout));
      }, 100);
    };

    const handleAddPage = (layoutType: PbLayout = 'single') => {
      insertNewPageAt(layoutType, pbPages.length - 1);
    };

    const openPbAddPageLayoutPicker = (afterPageIndex?: number) => {
      setPbLayoutPickerMode('add-page');
      setPbChangeLayoutPageIndex(null);
      setPbAddPageAfterIndex(afterPageIndex ?? null);
      setPbAddPageLayoutPickerOpen(true);
    };

    const handlePbLayoutPickerSelect = (layoutId: PbLayoutId) => {
      if (pbLayoutPickerMode === 'change-layout') {
        const pageIndex = pbChangeLayoutPageIndex ?? pbActivePageIndex;
        setPbAddPageLayoutPickerOpen(false);
        setPbChangeLayoutPageIndex(null);
        requestPbPageLayoutChange(pageIndex, layoutId);
        return;
      }
      confirmPbAddPageLayout(layoutId as PbLayout);
    };

    const confirmPbAddPageLayout = (layoutType: PbLayout) => {
      setPbAddPageLayoutPickerOpen(false);
      let insertAt = pbPages.length - 1;
      if (pbAddPageAfterIndex !== null) {
        const anchor = pbPages[pbAddPageAfterIndex];
        insertAt = anchor?.id === 'bc' ? pbAddPageAfterIndex : pbAddPageAfterIndex + 1;
      }
      insertNewPageAt(layoutType, insertAt);
      setPbAddPageAfterIndex(null);
    };

    const duplicatePageAt = (pageIndex: number) => {
      const source = pbPages[pageIndex];
      if (!source || source.id === 'fc' || source.id === 'bc') return;

      const newId = `p_dup_${Date.now()}`;
      const newPageNum = pbPages.filter((p) => p.label.startsWith('Page')).length + 1;
      const newPage = {
        ...source,
        id: newId,
        label: `Page ${newPageNum}`,
        locked: false,
        slotImages: source.slotImages ? [...source.slotImages] : undefined,
      };

      const fabricSnap = pbFabricByPageId[source.id];
      if (fabricSnap) {
        setPbFabricByPageId((prev) => ({
          ...prev,
          [newId]: JSON.parse(JSON.stringify(fabricSnap)) as PbFabricSerialized,
        }));
      }

      const insertAt = pageIndex + 1;
      const updatedPages = [...pbPages];
      updatedPages.splice(insertAt, 0, newPage);
      setPbPages(updatedPages);
      setPbActivePageIndex(insertAt);
      queueScrollToPbPage(newId, { blink: true });
    };

    const handleDeletePageAt = (pageIndex: number) => {
      requestDeletePbPageAt(pageIndex);
    };

    const movePageUp = (pageIndex: number) => {
      if (!canMovePbPageUp(pageIndex)) return;
      const updated = [...pbPages];
      [updated[pageIndex - 1], updated[pageIndex]] = [updated[pageIndex], updated[pageIndex - 1]];
      setPbPages(updated);
      focusPbPage(pageIndex - 1);
    };

    const movePageDown = (pageIndex: number) => {
      if (!canMovePbPageDown(pageIndex)) return;
      const updated = [...pbPages];
      [updated[pageIndex], updated[pageIndex + 1]] = [updated[pageIndex + 1], updated[pageIndex]];
      setPbPages(updated);
      focusPbPage(pageIndex + 1);
    };

    const togglePageLock = (pageIndex: number) => {
      const updated = [...pbPages];
      if (!updated[pageIndex]) return;
      updated[pageIndex] = {
        ...updated[pageIndex],
        locked: !updated[pageIndex].locked,
      };
      setPbPages(updated);
      setPbActivePageIndex(pageIndex);
    };

    const sampleImages: string[] = [];

    const swatches = [
      { name: 'White', value: '#ffffff' },
      { name: 'Light Gray', value: '#e5e7eb' },
      { name: 'Medium Gray', value: '#9ca3af' },
      { name: 'Charcoal', value: '#4b5563' },
      { name: 'Black', value: '#111827' },
      { name: 'Beige', value: '#d7c49e' },

      { name: 'Red', value: '#ef4444' },
      { name: 'Orange', value: '#f97316' },
      { name: 'Yellow', value: '#eab308' },
      { name: 'Lime Green', value: '#84cc16' },
      { name: 'Green', value: '#22c55e' },
      { name: 'Deep Green', value: '#15803d' },

      { name: 'Teal', value: '#06b6d4' },
      { name: 'Sky Blue', value: '#3b82f6' },
      { name: 'Royal Blue', value: '#1d4ed8' },
      { name: 'Navy', value: '#1e3a8a' },
      { name: 'Purple', value: '#6d28d9' },
      { name: 'Lavender', value: '#a78bfa' },

      { name: 'Hot Pink', value: '#ec4899' },
      { name: 'Peach', value: '#ffedd5' },
      { name: 'Mint', value: '#d1fae5' },
      { name: 'Cream', value: '#fef3c7' },
      { name: 'Plum', value: '#831843' },
    ];
    const presetBgValues = new Set(swatches.map((s) => s.value));
    const activeBg = activePage.bg || '#ffffff';
    const isCustomBgActive = !presetBgValues.has(activeBg);
    const customBgPickerValue = /^#[0-9a-f]{6}$/i.test(activeBg) ? activeBg : '#ffffff';

    const pbEditHeadlinePageIndex =
      pbEditPageHeadlinePageId !== null ? pbPages.findIndex((p) => p.id === pbEditPageHeadlinePageId) : -1;
    const pbEditHeadlinePage = pbEditHeadlinePageIndex >= 0 ? pbPages[pbEditHeadlinePageIndex] : null;

    const focusPbPageHeadline = (pageId: string, pageIndex: number) => {
      setPbActivePageIndex(pageIndex);
      setPbActiveTool('edit');
      setPbEditHover(null);
      setPbEditCanvasPageSelected(false);
      setPbEditPageHeadlinePageId(pageId);
    };

    pbCanvasDeleteKeyHandlerRef.current = () => {
      const page = pbPages[pbActivePageIndex];
      if (!page || page.locked) return false;

      const fabricApi = pbFabricApiRef.current[page.id];
      if (fabricApi?.removeActiveObject()) return true;

      const slotIndex = pbActivePhotoSlotIndex ?? 0;
      if (page.slotImages?.[slotIndex]) {
        setPbSlotImage(pbActivePageIndex, slotIndex, undefined);
        return true;
      }
      return false;
    };

    return (
      <div
        ref={photobookEditorRootRef}
        className={`${styles.photobookEditorOverlay} ${pbEditorDarkMode ? styles.photobookEditorOverlayDark : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Photobook editor"
        aria-busy={pbEditorSkeletonVisible}
        data-lenis-prevent
        data-photobook-editor
        data-pb-theme={pbEditorDarkMode ? 'dark' : 'light'}
        onClick={stopPhotobookOverlayBubble}
        onMouseDown={stopPhotobookOverlayBubble}
      >
        {pbEditorSkeletonVisible ? (
          <div className={styles.photobookEditorSkeleton} role="status" aria-live="polite" aria-label="Loading photobook editor">
            <div className={styles.pbSkeletonTopbar}>
              <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonBrand}`} />
              <div className={styles.pbSkeletonTopbarCenter}>
                <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonLine} ${styles.pbSkeletonProductType}`} />
                <div className={styles.pbSkeletonDivider}>•</div>
                <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonLine} ${styles.pbSkeletonProjectName}`} />
              </div>
              <div className={styles.pbSkeletonTopbarActions}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={`pb-sk-top-${i}`} className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonIcon}`} />
                ))}
                <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonCartBtn}`} />
                <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonIcon}`} />
              </div>
            </div>
            <div className={styles.pbSkeletonBody}>
              <div className={styles.pbSkeletonLeftSidebar}>
                <div className={styles.pbSkeletonSidebarNav}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={`pb-sk-nav-${i}`} className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonNavBtn}`} />
                  ))}
                </div>
                <div className={styles.pbSkeletonSidebarPanel}>
                  <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonPanelTitle}`} />
                  <div className={styles.pbSkeletonDropZone}>
                    <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonDropZoneIcon}`} />
                    <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonDropZoneLine1}`} />
                    <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonDropZoneLine2}`} />
                    <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonDropZoneBtn}`} />
                  </div>
                </div>
              </div>
              <div className={styles.pbSkeletonWorkspace}>
                <div className={styles.pbSkeletonWorkspaceInner}>
                  <div className={styles.pbSkeletonCanvasToolbar}>
                    <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonLine} ${styles.pbSkeletonLinePage}`} />
                    <div className={styles.pbSkeletonCanvasTools}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={`pb-sk-tool-${i}`} className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonIcon}`} />
                      ))}
                    </div>
                  </div>
                  <div
                    className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonCanvas}`}
                    style={{
                      aspectRatio: `${pbPageSizePx.widthPx} / ${pbPageSizePx.heightPx}`,
                    }}
                  />
                  
                  {/* Floating Workspace Controls (Sticky Bottom Bar) Skeleton */}
                  <div className={`${styles.pbWorkspaceControlsBar} ${styles.pbSkeletonControlsBar}`}>
                    <div className={styles.pbWorkspaceControlsGroup}>
                      <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonControlBtn}`} />
                      <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonControlBtn}`} />
                    </div>
                    <div className={styles.pbWorkspaceControlsDivider} />
                    <div className={styles.pbWorkspaceControlsGroup}>
                      <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonControlBtn}`} />
                      <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonZoomLabel}`} />
                      <div className={`${styles.pbSkeletonBlock} ${styles.pbSkeletonControlBtn}`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div
          className={`${styles.photobookEditorShell} ${pbEditorSkeletonVisible ? styles.photobookEditorShellSkeletonHidden : styles.photobookEditorShellRevealed}`}
        >
          {/* Zone 1: Top Navbar */}
          <header className={styles.photobookTopbar}>
            <div className={styles.photobookBrand}>
              <span className={styles.photobookBrandDot} aria-hidden="true" />
              <span className={styles.photobookBrandText}>Spectrum</span>
              <span className={styles.photobookBrandBeta}>Beta</span>
            </div>

            <div className={styles.photobookHeaderCenter}>
              <span className={styles.photobookProductType}>{removePriceFromName(displayProduct.name)}</span>
              <span className={styles.photobookProjectDivider}>•</span>
              <span className={styles.photobookProjectNameField}>
                <span ref={pbProjectNameMeasureRef} className={styles.photobookProjectNameMeasure} aria-hidden="true" />
                <input
                  ref={pbProjectNameInputRef}
                  type="text"
                  className={styles.photobookProjectNameInput}
                  value={pbProjectName}
                  onChange={(e) => setPbProjectName(e.target.value)}
                  placeholder={PB_PROJECT_NAME_PLACEHOLDER}
                  aria-label="Edit Project name"
                  {...pbTip('Edit Project name')}
                />
              </span>
            </div>

            <div className={styles.photobookActions}>
              <div
                className={`${styles.photobookSaveStatus} ${pbSaveStatus === 'saved' ? styles.photobookSaveStatusSaved : ''} ${pbSaveStatus === 'saved' ? styles.photobookSaveStatusTooltip : ''}`}
                role="status"
                aria-live="polite"
                aria-label={pbSaveStatus === 'saving' ? 'Saving changes' : 'Changes are saved'}
                {...(pbSaveStatus === 'saved' ? pbTip('Changes are saved') : {})}
              >
                {pbSaveStatus === 'saving' ? (
                  <svg className={styles.photobookSaveStatusSpinner} viewBox="25 25 50 50" aria-hidden="true">
                    <circle className={styles.photobookSpinnerTrack} cx="50" cy="50" r="18" fill="none" />
                    <circle className={styles.photobookSpinnerHead} cx="50" cy="50" r="18" fill="none" />
                  </svg>
                ) : (
                  <svg className={styles.photobookSaveStatusIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path
                      d="M9 13.2222L10.8462 15L15 11M8.4 19C5.41766 19 3 16.6044 3 13.6493C3 11.2001 4.8 8.9375 7.5 8.5C8.34694 6.48637 10.3514 5 12.6893 5C15.684 5 18.1317 7.32251 18.3 10.25C19.8893 10.9449 21 12.6503 21 14.4969C21 16.9839 18.9853 19 16.5 19L8.4 19Z"
                      stroke="currentColor"
                      strokeWidth={1.453}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <PbEditorHelpPanel
                darkMode={pbEditorDarkMode}
                productId={displayProduct.id}
                projectId={pbProjectId}
                pbTip={pbTip}
              />
              <button
                type="button"
                className={styles.photobookIconButton}
                aria-label={pbEditorDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-pressed={pbEditorDarkMode}
                onClick={() => setPbEditorDarkMode((prev) => !prev)}
                {...pbTip(pbEditorDarkMode ? 'Light mode' : 'Dark mode')}
              >
                {pbEditorDarkMode ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className={styles.photobookIconButton}
                aria-label="Undo"
                {...pbTip('Undo')}
                onClick={pbUndo}
                disabled={pbPreviewMode || !pbCanUndo}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
                </svg>
              </button>
              <button
                type="button"
                className={styles.photobookIconButton}
                aria-label="Redo"
                {...pbTip('Redo')}
                onClick={pbRedo}
                disabled={pbPreviewMode || !pbCanRedo}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 7v6h-6M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7" />
                </svg>
              </button>
              <button type="button" className={styles.photobookIconButton} aria-label="Save project" {...pbTip('Save project')} onClick={flushPbSave} disabled={pbIsSaving}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
              </button>
              <button
                type="button"
                className={`${styles.photobookIconButton} ${pbPreviewMode ? styles.photobookIconButtonActive : ''}`}
                aria-label={pbPreviewMode ? 'Exit preview' : 'Preview project'}
                aria-pressed={pbPreviewMode}
                {...pbTip(pbPreviewMode ? 'Exit preview' : 'Preview project')}
                onClick={togglePbPreviewMode}
                disabled={pbPreviewPreparing}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </button>

              <button
                type="button"
                className={styles.photobookCartButton}
                {...pbTip('Add to cart')}
                onClick={handlePbAddToCartClick}
                disabled={pbAddingToCart || pbIsLocked || pbIsSaving}
              >
                <svg
                  className={styles.photobookCartButtonIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M17 12L7 12M17 12L13 16M17 12L13 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Add to cart</span>
              </button>

              <button
                type="button"
                className={styles.photobookCloseButton}
                onClick={requestClosePhotobookEditor}
                aria-label="Close editor"
                {...pbTip('Close editor')}
                disabled={pbIsSaving}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </header>

          {/* Outer container taking up 100% height below header */}
          <div className={`${styles.photobookWorkspaceLayout} ${pbPreviewMode ? styles.photobookWorkspaceLayoutPreview : ''} ${pbActiveTool === 'tools' ? styles.photobookWorkspaceLayoutToolsMode : ''}`}>

            <aside
              className={[
                styles.photobookLeftSidebar,
                pbActiveTool === 'tools' ? styles.pbLeftSidebarToolsMode : '',
                pbPreviewMode ? styles.photobookLeftSidebarPreviewHidden : '',
              ].filter(Boolean).join(' ')}
              aria-hidden={pbPreviewMode ? true : undefined}
            >
                <nav
                  className={[
                    styles.pbSidebarNav,
                    (pbActiveTool === 'tools' && ['shapes', 'lines', 'draw'].includes(pbActiveSubTool || '')) ? styles.pbSidebarNavDimmed : '',
                    pbActiveTool !== 'tools' ? styles.pbSidebarNavNoTools : ''
                  ].filter(Boolean).join(' ')}
                  aria-label="Photobook tools"
                >
                  {(() => {
                    const toolIndexMap: Record<string, number> = {
                      images: 0,
                      emoji: 1,
                      edit: 2,
                      pages: 3,
                      texts: 4,
                      tools: 5,
                    };
                    const activeIndex = pbActiveTool ? toolIndexMap[pbActiveTool] : -1;
                    return (
                      <div
                        className={styles.pbSidebarNavIndicator}
                        style={{
                          transform: activeIndex >= 0 ? `translateY(${activeIndex * 46}px)` : 'translateY(0px)',
                          opacity: activeIndex >= 0 ? 1 : 0,
                        }}
                      />
                    );
                  })()}
                  <button
                    type="button"
                    className={`${styles.pbSidebarNavBtn} ${pbActiveTool === 'images' ? styles.pbSidebarNavBtnActive : ''}`}
                    onClick={() => togglePbSidebarTool('images')}
                    aria-label="Upload images"
                    data-pb-sidebar-tip="Upload images"
                    aria-pressed={pbActiveTool === 'images'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`${styles.pbSidebarNavBtn} ${pbActiveTool === 'emoji' ? styles.pbSidebarNavBtnActive : ''}`}
                    onClick={() => togglePbSidebarTool('emoji')}
                    aria-label="Stickers and emoji"
                    data-pb-sidebar-tip="Stickers & emoji"
                    aria-pressed={pbActiveTool === 'emoji'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`${styles.pbSidebarNavBtn} ${pbActiveTool === 'edit' ? styles.pbSidebarNavBtnActive : ''}`}
                    onClick={() => togglePbSidebarTool('edit')}
                    aria-label="Edit objects"
                    data-pb-sidebar-tip="Edit"
                    aria-pressed={pbActiveTool === 'edit'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`${styles.pbSidebarNavBtn} ${pbActiveTool === 'pages' ? styles.pbSidebarNavBtnActive : ''}`}
                    onClick={() => togglePbSidebarTool('pages')}
                    aria-label="Organize pages"
                    data-pb-sidebar-tip="Organize pages"
                    aria-pressed={pbActiveTool === 'pages'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`${styles.pbSidebarNavBtn} ${pbActiveTool === 'texts' ? styles.pbSidebarNavBtnActive : ''}`}
                    onClick={() => togglePbSidebarTool('texts')}
                    aria-label="Typography"
                    data-pb-sidebar-tip="Typography"
                    aria-pressed={pbActiveTool === 'texts'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="4 7 4 4 20 4 20 7" />
                      <line x1="9" y1="20" x2="15" y2="20" />
                      <line x1="12" y1="4" x2="12" y2="20" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`${styles.pbSidebarNavBtn} ${pbActiveTool === 'tools' ? styles.pbSidebarNavBtnActive : ''}`}
                    onClick={() => togglePbSidebarTool('tools')}
                    aria-label="Canvas tools"
                    data-pb-sidebar-tip="Canvas tools"
                    aria-pressed={pbActiveTool === 'tools'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                    </svg>
                  </button>
                  <div
                    className={[
                      styles.pbSidebarNavSubGroup,
                      pbActiveTool === 'tools' ? styles.pbSidebarNavSubGroupActive : ''
                    ].filter(Boolean).join(' ')}
                  >
                    <button
                      type="button"
                      className={[
                        styles.pbSidebarNavSubBtn,
                        styles.pbSidebarNavSubBtnShapes,
                        pbActiveSubTool === 'shapes' ? styles.pbSidebarNavSubBtnActive : ''
                      ].filter(Boolean).join(' ')}
                      onClick={() => {
                        const openingShapes = pbActiveSubTool !== 'shapes';
                        setPbActiveSubTool(prev => prev === 'shapes' ? null : 'shapes');
                        setPbCanvasToolMode(prev => prev === 'shapes' ? 'select' : 'shapes');
                        if (openingShapes) setPbCanvasShape(null);
                      }}
                      aria-label="Shapes"
                      title="Shapes"
                      data-pb-sidebar-tip="Shapes"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="10" height="10" rx="1" />
                        <circle cx="15" cy="15" r="5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={[
                        styles.pbSidebarNavSubBtn,
                        styles.pbSidebarNavSubBtnLines,
                        pbActiveSubTool === 'lines' ? styles.pbSidebarNavSubBtnActive : ''
                      ].filter(Boolean).join(' ')}
                      onClick={() => {
                        setPbActiveSubTool(prev => {
                          if (prev === 'lines') {
                            setPbLinePreset(null);
                            return null;
                          } else {
                            setPbLinePreset(null);
                            return 'lines';
                          }
                        });
                        setPbCanvasToolMode(prev => prev === 'lines' ? 'select' : 'lines');
                      }}
                      aria-label="Lines"
                      title="Lines"
                      data-pb-sidebar-tip="Lines"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="5" y1="19" x2="19" y2="5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={[
                        styles.pbSidebarNavSubBtn,
                        styles.pbSidebarNavSubBtnDraw,
                        pbActiveSubTool === 'draw' ? styles.pbSidebarNavSubBtnActive : ''
                      ].filter(Boolean).join(' ')}
                      onClick={() => {
                        setPbActiveSubTool(prev => prev === 'draw' ? null : 'draw');
                        setPbCanvasToolMode(prev => prev === 'draw' ? 'select' : 'draw');
                      }}
                      aria-label="Draw"
                      title="Draw"
                      data-pb-sidebar-tip="Draw"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                  </div>
                </nav>

                {pbActiveTool ? (
                  <div className={styles.pbThumbScrollbarHost}>
                    <div
                      ref={pbSidebarPropertiesRef}
                      className={[
                        styles.pbSidebarProperties,
                        styles.pbNativeScrollHidden,
                        pbActiveTool === 'tools' ? styles.pbSidebarPropertiesShrunk : '',
                        pbActiveTool === 'tools' && pbActiveSubTool === null ? styles.pbSidebarPropertiesHidden : '',
                      ].filter(Boolean).join(' ')}
                      data-lenis-prevent
                    >
                    {pbActiveTool === 'images' && (
                      <div
                        className={[
                          styles.pbSidebarPanel,
                          styles.pbImagesSidebarPanel,
                          pbImagesUploadDragOver ? styles.pbImagesSidebarPanelDragOver : '',
                        ].filter(Boolean).join(' ')}
                        onDragEnter={(e) => {
                          if (!isFileDragTransfer(e.dataTransfer)) return;
                          e.preventDefault();
                          pbImagesUploadDragDepthRef.current += 1;
                          setPbImagesUploadDragOver(true);
                        }}
                        onDragOver={(e) => {
                          if (!isFileDragTransfer(e.dataTransfer)) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'copy';
                          setPbImagesUploadDragOver(true);
                        }}
                        onDragLeave={(e) => {
                          if (!isFileDragTransfer(e.dataTransfer)) return;
                          pbImagesUploadDragDepthRef.current = Math.max(0, pbImagesUploadDragDepthRef.current - 1);
                          if (pbImagesUploadDragDepthRef.current === 0) {
                            setPbImagesUploadDragOver(false);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          pbImagesUploadDragDepthRef.current = 0;
                          setPbImagesUploadDragOver(false);
                          if (e.dataTransfer.files?.length) {
                            addPbUploadedImagesFromFiles(e.dataTransfer.files);
                          } else {
                            const dropped = getFilesFromDataTransfer(e.dataTransfer);
                            if (dropped.length) addPbUploadedImagesFromFiles(dropped);
                          }
                        }}
                      >
                        {pbImagesUploadDragOver ? (
                          <div className={styles.pbImagesSidebarDropOverlay} aria-hidden="true">
                            <span className={styles.pbImagesSidebarDropLabel}>Drop here</span>
                          </div>
                        ) : null}
                        <h3 className={styles.pbPanelTitle}>Upload Images</h3>
                        {pbUploadedImages.length === 0 ? (
                          <div
                            ref={pbDropZoneRef}
                            className={[
                              styles.photobookDropZone,
                              styles.photobookDropZoneEmpty,
                              pbDropZoneNudgeActive ? styles.photobookDropZoneNudge : '',
                              pbImagesUploadDragOver ? styles.photobookDropZoneDragOver : '',
                            ].filter(Boolean).join(' ')}
                          >
                            <div className={styles.photobookUploadIcon}>
                              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 19V12M12 12L9.75 14.3333M12 12L14.25 14.3333M6.6 17.8333C4.61178 17.8333 3 16.1917 3 14.1667C3 12.498 4.09438 11.0897 5.59198 10.6457C5.65562 10.6268 5.7 10.5 5.7 10.5C5.7 7.46243 8.11766 5 11.1 5C14.0823 5 16.5 7.46243 16.5 10.5C16.5 10.5582 16.5536 10.6014 16.6094 10.5887C16.8638 10.5306 17.1284 10.5 17.4 10.5C19.3882 10.5 21 12.1416 21 14.1667C21 16.1917 19.3882 17.8333 17.4 17.8333" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
                              </svg>
                            </div>
                            <p>Drag and drop images or upload from your computer. Max 5MB each.</p>
                            <button
                              type="button"
                              className={styles.pbUploadBtn}
                              onClick={() => pbImagesUploadInputRef.current?.click()}
                            >
                              Upload images
                            </button>
                            <input
                              ref={pbImagesUploadInputRef}
                              type="file"
                              accept="image/*"
                              multiple
                              className={styles.pbImagesUploadInput}
                              onChange={(e) => {
                                const files = e.target.files;
                                if (!files || files.length === 0) return;
                                addPbUploadedImagesFromFiles(files);
                                e.currentTarget.value = '';
                              }}
                            />
                          </div>
                        ) : (
                          <>
                            <div ref={pbDropZoneRef} className={styles.pbImagesUploadStickyBar}>
                              <button
                                type="button"
                                className={styles.pbUploadBtn}
                                onClick={() => pbImagesUploadInputRef.current?.click()}
                              >
                                Upload more images
                              </button>
                              <input
                                ref={pbImagesUploadInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className={styles.pbImagesUploadInput}
                                onChange={(e) => {
                                  const files = e.target.files;
                                  if (!files || files.length === 0) return;
                                  addPbUploadedImagesFromFiles(files);
                                  e.currentTarget.value = '';
                                }}
                              />
                            </div>
                            <div className={styles.pbMockGallery}>
                            <div className={styles.pbGallerySubtitleRow}>
                              <span className={styles.pbGallerySubtitle}>Uploaded Images</span>
                              <div className={styles.pbGalleryViewModes} role="group" aria-label="Change grid view">
                                <button
                                  type="button"
                                  className={`${styles.pbGalleryViewBtn} ${pbGalleryGridCols === 1 ? styles.pbGalleryViewBtnActive : ''}`}
                                  onClick={() => setPbGalleryGridCols(1)}
                                  aria-pressed={pbGalleryGridCols === 1}
                                  title="Single column"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.pbGalleryViewBtn} ${pbGalleryGridCols === 2 ? styles.pbGalleryViewBtnActive : ''}`}
                                  onClick={() => setPbGalleryGridCols(2)}
                                  aria-pressed={pbGalleryGridCols === 2}
                                  title="Two columns"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <rect x="5" y="5" width="6.5" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                                    <rect x="12.5" y="5" width="6.5" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.pbGalleryViewBtn} ${pbGalleryGridCols === 3 ? styles.pbGalleryViewBtnActive : ''}`}
                                  onClick={() => setPbGalleryGridCols(3)}
                                  aria-pressed={pbGalleryGridCols === 3}
                                  title="Three columns"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <rect x="5" y="5" width="4" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                                    <rect x="10" y="5" width="4" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                                    <rect x="15" y="5" width="4" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div
                              className={`${styles.pbGalleryGrid} ${pbGalleryGridCols === 1
                                ? styles.pbGalleryGridCols1
                                : pbGalleryGridCols === 2
                                  ? styles.pbGalleryGridCols2
                                  : styles.pbGalleryGridCols3
                                }`}
                              style={{ gridTemplateColumns: `repeat(${pbGalleryGridCols}, 1fr)` }}
                            >
                              {pbUploadedImages.map((u, idx) => {
                                const img = u.url;
                                return (
                                  <div
                                    key={u.id}
                                    className={`${styles.pbGalleryItem} ${pbDraggingGalleryIndex === idx ? styles.pbGalleryItemDragging : ''}`}
                                    onClick={() => handleSelectSampleImage(img)}
                                    draggable={!isPageLocked}
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('text/pb-gallery-image', img);
                                      e.dataTransfer.effectAllowed = 'copy';
                                      setPbDraggingGalleryIndex(idx);
                                      setPbDraggingGalleryUrl(img);

                                      // Show only the image as the drag preview (not the whole framed tile)
                                      try {
                                        const dragImg = document.createElement('img');
                                        dragImg.src = img;
                                        dragImg.alt = '';
                                        dragImg.draggable = false;
                                        dragImg.style.width = '96px';
                                        dragImg.style.height = '96px';
                                        dragImg.style.objectFit = 'contain';
                                        dragImg.style.background = 'transparent';
                                        dragImg.style.borderRadius = '0px';
                                        dragImg.style.boxShadow = '0 18px 34px rgba(0,0,0,0.28)';
                                        dragImg.style.transform = 'rotate(-14deg) scale(1.08)';
                                        dragImg.style.transformOrigin = 'center';
                                        dragImg.style.position = 'fixed';
                                        dragImg.style.top = '-1000px';
                                        dragImg.style.left = '-1000px';
                                        dragImg.style.pointerEvents = 'none';
                                        document.body.appendChild(dragImg);
                                        e.dataTransfer.setDragImage(dragImg, 48, 48);
                                        window.setTimeout(() => {
                                          dragImg.remove();
                                        }, 0);
                                      } catch {
                                        // ignore – default drag image will be used
                                      }
                                    }}
                                    onDragEnd={() => {
                                      setPbDraggingGalleryIndex(null);
                                      setPbDraggingGalleryUrl(null);
                                    }}
                                    title={
                                      pbSelectedFrameId
                                        ? 'Click to place in the selected frame'
                                        : 'Drag onto any page or click to place on active page'
                                    }
                                  >
                                    <img src={img} alt={u.name || `Uploaded image ${idx + 1}`} className={styles.pbGalleryImg} />
                                    <button
                                      type="button"
                                      className={styles.pbGalleryItemDeleteBtn}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPbUploadedImages((prev) => prev.filter((imgObj) => imgObj.id !== u.id));
                                      }}
                                      title="Delete image"
                                      aria-label="Delete image"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                      </svg>
                                    </button>
                                    <div
                                      className={`${styles.pbGalleryHoverOverlay} ${pbDraggingGalleryIndex === idx ? styles.pbGalleryHoverOverlayForceVisible : ''
                                        }`}
                                    >
                                      <span>Place ✦</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          </>
                        )}
                      </div>
                    )}

                    {pbActiveTool === 'emoji' && (
                      <div className={styles.pbSidebarPanel}>
                        <h3 className={styles.pbPanelTitle}>Stickers & Emoji</h3>
                        <p className={styles.pbPanelDesc}>Search and add emojis or OpenMoji stickers to the canvas.</p>

                        <div className={styles.pbEmojiTabs}>
                          <div
                            className={styles.pbEmojiTabsBg}
                            style={{
                              transform: pbEmojiTab === 'emojis' ? 'translateX(0)' : 'translateX(100%)',
                            }}
                          />
                          <button
                            type="button"
                            className={`${styles.pbEmojiTabBtn} ${pbEmojiTab === 'emojis' ? styles.pbEmojiTabBtnActive : ''}`}
                            onClick={() => setPbEmojiTab('emojis')}
                            aria-pressed={pbEmojiTab === 'emojis'}
                          >
                            Emojis
                          </button>
                          <button
                            type="button"
                            className={`${styles.pbEmojiTabBtn} ${pbEmojiTab === 'stickers' ? styles.pbEmojiTabBtnActive : ''}`}
                            onClick={() => setPbEmojiTab('stickers')}
                            aria-pressed={pbEmojiTab === 'stickers'}
                          >
                            Stickers
                          </button>
                        </div>

                        <div className={styles.pbSidebarSearchRow}>
                          <div className={styles.pbSidebarSearchWrap}>
                            <span className={styles.pbSidebarSearchIcon} aria-hidden="true">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M20 20l-3.2-3.2"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                            <input
                              type="text"
                              className={styles.pbSidebarSearchInput}
                              value={pbEmojiSearch}
                              onChange={(e) => {
                                const next = e.target.value;
                                setPbEmojiSearch(next);
                                const picker = pbEmojiPickerRef.current as any;
                                const searchInput = picker?.shadowRoot?.querySelector?.('input[type="search"]') as HTMLInputElement | null;
                                if (searchInput) {
                                  searchInput.value = next;
                                  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                                }
                              }}
                              placeholder={pbEmojiTab === 'emojis' ? 'Search emojis…' : 'Search Stickers...'}
                              aria-label={pbEmojiTab === 'emojis' ? 'Search emojis' : 'Search stickers'}
                            />
                            {pbEmojiTab === 'emojis' ? (
                              <button
                                type="button"
                                className={styles.pbSidebarSearchRightBtn}
                                aria-label="Choose skin tone"
                                title="Choose skin tone"
                                onClick={openPbEmojiSkinToneMenu}
                              >
                                🖐️
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {pbEmojiTab === 'emojis' ? (
                          <div className={styles.pbEmojiPickerWrap}>
                            {/* Full emoji list with built-in categories + search (we proxy search above) */}
                            <emoji-picker
                              ref={(el: HTMLElement | null) => {
                                pbEmojiPickerRef.current = el;
                              }}
                              className={styles.pbEmojiPickerEl}
                            />
                          </div>
                        ) : (
                          <StickerSidebar
                            searchQuery={pbEmojiSearch}
                            disabled={isPageLocked}
                            onStickerSelect={handlePbStickerPicked}
                            onStickerDragStart={handlePbStickerDragStart}
                            onStickerDragEnd={handlePbStickerDragEnd}
                          />
                        )}
                      </div>
                    )}

                    {pbActiveTool === 'edit' && (
                      <>
                      {pbEditCanvasPageSelected && !pbEditHover && pbEditCropPageId === null && pbFrameAdjustPageId === null ? (
                        pbPages[pbActivePageIndex]?.id === 'fc' ? (
                          <div className={styles.pbSidebarPanel}>
                            <h3 className={styles.pbPanelTitle}>Cover Designs</h3>
                            <p className={styles.pbPanelDesc}>Choose a cover layout. Drag photos from your gallery into the frame.</p>
                            <PbCoverDesignPickerGrid
                              activeDesignId={normalizeCoverDesignId(pbPages[pbActivePageIndex]?.coverDesign)}
                              onSelect={(designId) => requestPbCoverDesignChange(pbActivePageIndex, designId)}
                              className={styles.pbLayoutsGridSidebar}
                            />
                          </div>
                        ) : pbPages[pbActivePageIndex]?.id !== 'bc' ? (
                          <div className={styles.pbSidebarPanel}>
                            <h3 className={styles.pbPanelTitle}>Page layout</h3>
                            <p className={styles.pbPanelDesc}>Choose a layout for this page. Photos drop into frames.</p>
                            <PbLayoutPickerGrid
                              activeLayoutId={normalizeLayoutId(pbPages[pbActivePageIndex]?.layout)}
                              onSelect={(layoutId) => requestPbPageLayoutChange(pbActivePageIndex, layoutId)}
                              className={styles.pbLayoutsGridSidebar}
                            />
                            {(() => {
                              const activePage = pbPages[pbActivePageIndex];
                              const activeLayoutId = normalizeLayoutId(activePage?.layout);
                              if (
                                !activePage
                                || !layoutHasMultipleFrames(activeLayoutId, pbPageSizePx.widthPx, pbPageSizePx.heightPx)
                              ) {
                                return null;
                              }
                              const frameGapEnabled = activePage.layoutFrameGapEnabled !== false;
                              return (
                                <div className={styles.pbLayoutFrameGapToggle}>
                                  <div className={styles.figmaToggleRow}>
                                    <span className={styles.figmaToggleLabel}>Enable space in between the frames</span>
                                    <button
                                      type="button"
                                      className={`${styles.figmaToggleSwitch} ${frameGapEnabled ? styles.figmaToggleSwitchActive : ''}`}
                                      onClick={() => setPbPageLayoutFrameGap(pbActivePageIndex, !frameGapEnabled)}
                                      aria-label="Enable space in between the frames"
                                      aria-pressed={frameGapEnabled}
                                    >
                                      <span
                                        className={`${styles.figmaToggleKnob} ${frameGapEnabled ? styles.figmaToggleKnobActive : ''}`}
                                      />
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : null
                      ) : null}
                      <PbEditSidebarPanel
                        hover={pbEditHover}
                        cropActive={pbEditCropPageId !== null}
                        frameAdjustActive={pbFrameAdjustPageId !== null}
                        frameAdjustZoom={pbFrameAdjustZoom}
                        pageBackground={
                          pbEditCropPageId === null &&
                          pbFrameAdjustPageId === null &&
                            !pbEditHover &&
                            !pbEditPageHeadlinePageId &&
                            pbEditCanvasPageSelected &&
                            pbPages[pbActivePageIndex]?.id !== 'bc'
                            ? {
                              swatches,
                              activeBg,
                              isCustomBgActive,
                              customBgPickerValue,
                              customBgInputRef: pbCustomBgColorInputRef,
                              onSelectBg: handleSelectBg,
                            }
                            : null
                        }
                        pageHeadlineEdit={
                          pbEditCropPageId === null && pbFrameAdjustPageId === null && !pbEditHover && pbEditHeadlinePage && pbEditHeadlinePage.id !== 'bc'
                            ? {
                              style: getPbPageHeadlineStyle(pbEditHeadlinePage),
                              text: pbEditHeadlinePage.caption || '',
                              onApply: (patch) => applyPbPageHeadlineStyle(pbEditHeadlinePageIndex, patch),
                              onUpdateText: (val) => {
                                setPbPages((pages) => {
                                  const updated = [...pages];
                                  if (updated[pbEditHeadlinePageIndex]) {
                                    updated[pbEditHeadlinePageIndex] = {
                                      ...updated[pbEditHeadlinePageIndex],
                                      caption: val,
                                    };
                                  }
                                  return updated;
                                });
                              },
                            }
                            : null
                        }
                        fonts={pbPhotobookFonts}
                        pbTip={pbTip}
                        onFillColorChange={(color) => runPbEditAction((api) => api.setActiveObjectFill(color))}
                        onApplyTextStyle={(patch, skipPersist) => runPbEditAction((api) => api.applyActiveTextStyle(patch, skipPersist))}
                        onApplyShapeStyle={(patch, skipPersist) => runPbEditAction((api) => api.applyActiveObjectStyle(patch, skipPersist))}
                        onToggleLock={() => runPbEditAction((api) => api.toggleLockActiveObject())}
                        onDuplicate={() => runPbEditAction((api) => api.duplicateActiveObject())}
                        onDelete={() => runPbEditAction((api) => api.removeActiveObject())}
                        onCrop={() => runPbEditAction((api) => api.cropActiveImage())}
                        onApplyCrop={() => runPbEditAction((api) => api.applyImageCrop())}
                        onCancelCrop={() => runPbEditAction((api) => api.cancelImageCrop())}
                        onFrameAdjust={() => runPbEditAction((api) => api.openFrameCropModal())}
                        onApplyFrameAdjust={() => runPbEditAction((api) => api.applyFrameAdjust())}
                        onCancelFrameAdjust={() => runPbEditAction((api) => api.cancelFrameAdjust())}
                        onFrameAdjustZoomChange={(scale) => {
                          setPbFrameAdjustZoom(scale);
                          runPbEditAction((api) => api.setFrameAdjustZoom(scale));
                        }}
                        onApplyFrameImageStyle={(patch, skipPersist) =>
                          runPbEditAction((api) => api.applyFrameImageStyle(patch))
                        }
                      />
                      </>
                    )}

                    {pbActiveTool === 'pages' && (
                      <div className={styles.pbSidebarPanel}>
                        <h3 className={styles.pbPanelTitle}>Pages</h3>
                        <p className={styles.pbPanelDesc}>Jump to any page or drag to reorder.</p>
                        <ul
                          ref={pbPagesListRef}
                          className={`${styles.pbPagesList} ${pbPageListDragIndex !== null ? styles.pbPagesListDragging : ''}`}
                        >
                          {pbPages.map((page, idx) => {
                            const pageListLabel = getPbCanvasPageLabelFor(idx);
                            const pageListTitle = page.caption?.trim();
                            const isCoverPage = isPbCoverPage(page);
                            const isDragging = pbPageListDragIndex === idx;
                            const isGapTarget =
                              pbPageListDragIndex !== null &&
                              pbPageListOverIndex === idx &&
                              pbPageListDragIndex !== idx;
                            const shiftY = getPbPagesListShift(idx);
                            const itemTransform = isDragging
                              ? `translate3d(0, ${pbPageListDragOffsetY}px, 0) scale(1.03)`
                              : `translate3d(0, ${shiftY}px, 0)`;

                            return (
                              <li
                                key={page.id}
                                ref={(el) => {
                                  pbPagesListItemRefs.current[page.id] = el;
                                }}
                                className={`${styles.pbPagesListItem} ${isDragging ? styles.pbPagesListItemDraggingLift : ''} ${isGapTarget ? styles.pbPagesListItemGapTarget : ''}`}
                                style={{
                                  transform: itemTransform,
                                  transition: isDragging
                                    ? 'none'
                                    : 'transform 0.26s cubic-bezier(0.2, 0.85, 0.25, 1)',
                                }}
                              >
                                <button
                                  type="button"
                                  className={`${styles.pbPagesListBtn} ${isCoverPage ? styles.pbPagesListBtnCover : ''} ${idx === pbActivePageIndex ? styles.pbPagesListBtnActive : ''}`}
                                  onClick={() => {
                                    if (pbPageListDragIndex !== null) return;
                                    focusPbPage(idx, { blink: true });
                                  }}
                                >
                                  <span className={styles.pbPagesListLabel}>{pageListLabel}</span>
                                  {pageListTitle && !isCoverPage ? (
                                    <span className={styles.pbPagesListTitle}>{pageListTitle}</span>
                                  ) : null}
                                </button>
                                {page.id !== 'fc' && page.id !== 'bc' ? (
                                <button
                                  type="button"
                                  className={styles.pbPagesListDragHandle}
                                  aria-label={`Drag ${pageListLabel} to reorder`}
                                  title="Drag to reorder"
                                  onClick={(e) => e.stopPropagation()}
                                  onPointerDown={(e) => handlePbPageListDragStart(idx, e)}
                                  onPointerMove={handlePbPageListDragMove}
                                  onPointerUp={handlePbPageListDragEnd}
                                  onPointerCancel={handlePbPageListDragEnd}
                                >
                                  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                    <circle cx="5.5" cy="5.5" r="1.35" />
                                    <circle cx="10.5" cy="5.5" r="1.35" />
                                    <circle cx="5.5" cy="10.5" r="1.35" />
                                    <circle cx="10.5" cy="10.5" r="1.35" />
                                  </svg>
                                </button>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {pbActiveTool === 'texts' && (
                      <div className={styles.pbSidebarPanel}>
                        <h3 className={styles.pbPanelTitle}>Typography</h3>
                        <p className={styles.pbPanelDesc}>Click to change page title style or add quick details.</p>

                        <div className={styles.pbTextButtonsColumn}>
                          <button
                            type="button"
                            className={styles.pbAddTextBtn}
                            onClick={() => {
                              if (isPageLocked) return;
                              const pageId = pbActivePageIdRef.current ?? pbPages[pbActivePageIndex]?.id;
                              if (!pageId) return;
                              setPbActiveTool('edit');
                              runPbFabricPageAction(pageId, (api) => void api.addTextPreset('heading'));
                              scrollPbPageIntoView(pageId);
                            }}
                          >
                            Add a Heading
                          </button>
                          <button
                            type="button"
                            className={styles.pbAddTextBtn}
                            onClick={() => {
                              if (isPageLocked) return;
                              const pageId = pbActivePageIdRef.current ?? pbPages[pbActivePageIndex]?.id;
                              if (!pageId) return;
                              setPbActiveTool('edit');
                              runPbFabricPageAction(pageId, (api) => void api.addTextPreset('caption'));
                              scrollPbPageIntoView(pageId);
                            }}
                          >
                            Add a Subheading
                          </button>
                        </div>
                      </div>
                    )}

                    {pbActiveTool === 'tools' && pbActiveSubTool !== null && (
                      <div className={`${styles.pbSidebarPanel} ${styles.pbSidebarPanelToolsRail}`}>
                        <div className={styles.pbToolsRailBtnGroup}>
                          <div className={[
                            styles.pbShapesWrapper,
                            pbActiveSubTool === 'shapes' ? styles.pbShapesWrapperVisible : styles.pbShapesWrapperHidden
                          ].filter(Boolean).join(' ')}>
                            <div
                              className={`${styles.pbShapesGrid} ${styles.pbShapesGridNoScrollbar}`}
                              onScroll={(e) => {
                                const target = e.currentTarget;
                                const atTop = target.scrollTop <= 2;
                                const atBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 5;
                                setPbShapesScrollAtTop(atTop);
                                setPbShapesScrollAtBottom(atBottom);
                              }}
                            >
                              {[
                                'Circle',
                                'Square',
                                'Rectangle',
                                'Triangle',
                                'Right Triangle',
                                'Equilateral Triangle',
                                'Isosceles Triangle',
                                'Oval',
                                'Diamond',
                                'Parallelogram',
                                'Trapezoid',
                                'Pentagon',
                                'Hexagon',
                                'Heptagon',
                                'Octagon',
                                'Nonagon',
                                'Decagon',
                                'Dodecagon',
                                'Semi-circle',
                                'Quarter circle',
                                'Ring / Donut',
                                'Pill / Capsule',
                                'Crescent',
                              ].map((shape) => (
                                <button
                                  key={shape}
                                  type="button"
                                  className={`${styles.pbShapeBtn} ${pbCanvasShape === shape ? styles.pbShapeBtnActive : ''}`}
                                  onClick={() => {
                                    if (isPageLocked) return;
                                    setPbCanvasShape(shape);
                                    setPbActiveTool('tools');
                                    const pageId = pbActivePageIdRef.current ?? pbPages[pbActivePageIndex]?.id;
                                    if (!pageId) return;
                                    runPbFabricPageAction(pageId, (api) => {
                                      void api.addShape(shape);
                                      setPbCanvasToolMode('select');
                                      setPbActiveSubTool(null);
                                    });
                                    scrollPbPageIntoView(pageId);
                                  }}
                                  aria-pressed={pbCanvasShape === shape}
                                  aria-label={shape}
                                  title={shape}
                                  {...pbTip(shape, 'right')}
                                >
                                  <svg className={styles.pbShapeIcon} viewBox="0 0 24 24" aria-hidden="true">
                                    {(() => {
                                      const s = shape.toLowerCase();
                                      if (s === 'circle') return <circle cx="12" cy="12" r="7" />;
                                      if (s === 'square') return <rect x="6" y="6" width="12" height="12" rx="1" />;
                                      if (s === 'rectangle') return <rect x="5" y="7" width="14" height="10" rx="1" />;
                                      if (s === 'oval') return <ellipse cx="12" cy="12" rx="8" ry="6" />;
                                      if (s === 'diamond') return <path d="M12 4L20 12L12 20L4 12Z" />;
                                      if (s.includes('right triangle')) return <path d="M6 6H18V18Z" />;
                                      if (s.includes('triangle')) return <path d="M12 5L20 19H4Z" />;
                                      if (s === 'parallelogram') return <path d="M8 6H20L16 18H4Z" />;
                                      if (s === 'trapezoid') return <path d="M8 6H16L20 18H4Z" />;
                                      if (s === 'pentagon') return <path d="M12 4l8 6-3 10H7L4 10z" />;
                                      if (s === 'hexagon') return <path d="M8 4h8l4 8-4 8H8L4 12z" />;
                                      if (s === 'heptagon') return <path d="M12 3l7 4 2 7-5 7H8L3 14l2-7z" />;
                                      if (s === 'octagon') return <path d="M8 3h8l3 3v8l-3 3H8l-3-3V6z" />;
                                      if (s === 'nonagon') return <path d="M12 3l6 2 3 5-1 6-4 4H8l-4-4-1-6 3-5z" />;
                                      if (s === 'decagon') return <path d="M12 3l6 2 3 4v6l-3 4-6 2-6-2-3-4V9l3-4z" />;
                                      if (s === 'dodecagon') return <path d="M12 3l4 1 3 3 1 4-1 4-3 3-4 1-4-1-3-3-1-4 1-4 3-3z" />;
                                      if (s === 'semi-circle') return <path d="M5 14a7 7 0 0 1 14 0v5H5z" />;
                                      if (s === 'quarter circle') return <path d="M6 18V6h12a12 12 0 0 1-12 12z" />;
                                      if (s === 'ring / donut') return (
                                        <>
                                          <circle cx="12" cy="12" r="7" />
                                          <circle cx="12" cy="12" r="3.5" />
                                        </>
                                      );
                                      if (s === 'pill / capsule') return <rect x="5" y="8" width="14" height="8" rx="4" />;
                                      if (s === 'crescent') return <path d="M14 4a7 7 0 1 0 0 16 6 6 0 1 1 0-16z" />;
                                      return <rect x="6" y="6" width="12" height="12" rx="2" />;
                                    })()}
                                  </svg>
                                </button>
                              ))}
                            </div>
                            <div className={[
                              styles.pbShapesFadeTop,
                              pbShapesScrollAtTop ? styles.pbShapesFadeHidden : ''
                            ].filter(Boolean).join(' ')} />
                            <div className={[
                              styles.pbShapesFadeBottom,
                              pbShapesScrollAtBottom ? styles.pbShapesFadeHidden : ''
                            ].filter(Boolean).join(' ')} />
                          </div>

                          <div className={[
                            styles.pbSketchToolDock,
                            pbActiveSubTool === 'draw' ? styles.pbSketchToolDockVisible : styles.pbSketchToolDockHidden,
                            pbCanvasToolMode !== 'draw' ? styles.pbSketchToolDockNoCheck : ''
                          ].filter(Boolean).join(' ')}>
                            <button
                              type="button"
                              className={[
                                styles.pbSketchToolBtn,
                                pbCanvasToolMode === 'draw' && pbDrawPreset === 'marker' ? styles.pbSketchToolBtnActive : ''
                              ].filter(Boolean).join(' ')}
                              onClick={() => {
                                setPbDrawPreset('marker');
                                setPbCanvasToolMode('draw');
                              }}
                              aria-pressed={pbCanvasToolMode === 'draw' && pbDrawPreset === 'marker'}
                              title="Marker"
                              {...pbTip('Pen / Marker', 'right')}
                            >
                              <div className={`${styles.pbToolSketch} ${styles.pbToolSketchMarker}`}>
                                <div className={styles.pbMarkerCap} />
                                <div
                                  className={styles.pbMarkerTip}
                                  style={{
                                    backgroundColor: pbDrawColors['marker']
                                  }}
                                />
                                <svg
                                  className={styles.pbMarkerSquiggle}
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke={pbDrawColors['marker']}
                                  strokeWidth="2.5"
                                >
                                  <path d="M4 12c3-5 5 5 8 0s5-5 8 0" />
                                </svg>
                              </div>
                              {pbCanvasToolMode === 'draw' && pbDrawPreset === 'marker' && pbDrawSettingsOpen && (
                                <div className={styles.pbDrawBrushPreview}>
                                  <div
                                    className={styles.pbDrawBrushPreviewInner}
                                    style={{
                                      width: `${pbDrawWeight * (pbZoomVal / 100)}px`,
                                      height: `${pbDrawWeight * (pbZoomVal / 100)}px`,
                                      backgroundColor: pbDrawColors['marker'],
                                      opacity: pbDrawOpacity / 100,
                                    }}
                                  />
                                </div>
                              )}
                            </button>
                            <button
                              type="button"
                              className={[
                                styles.pbSketchToolBtn,
                                pbCanvasToolMode === 'draw' && pbDrawPreset === 'highlighter' ? styles.pbSketchToolBtnActive : ''
                              ].filter(Boolean).join(' ')}
                              onClick={() => {
                                setPbDrawPreset('highlighter');
                                setPbCanvasToolMode('draw');
                              }}
                              aria-pressed={pbCanvasToolMode === 'draw' && pbDrawPreset === 'highlighter'}
                              title="Highlighter"
                              {...pbTip('Highlighter', 'right')}
                            >
                              <div
                                className={`${styles.pbToolSketch} ${styles.pbToolSketchHighlighter}`}
                                style={{
                                  ['--pb-highlighter-color' as string]: pbDrawColors['highlighter']
                                }}
                              >
                                <div className={styles.pbHighlighterCap} />
                                <div
                                  className={styles.pbHighlighterTip}
                                  style={{
                                    backgroundColor: pbDrawColors['highlighter']
                                  }}
                                />
                              </div>
                              {pbCanvasToolMode === 'draw' && pbDrawPreset === 'highlighter' && pbDrawSettingsOpen && (
                                <div className={styles.pbDrawBrushPreview}>
                                  <div
                                    className={styles.pbDrawBrushPreviewInner}
                                    style={{
                                      width: `${pbDrawWeight * (pbZoomVal / 100)}px`,
                                      height: `${pbDrawWeight * (pbZoomVal / 100)}px`,
                                      backgroundColor: pbDrawColors['highlighter'],
                                      opacity: pbDrawOpacity / 100,
                                    }}
                                  />
                                </div>
                              )}
                            </button>
                            <button
                              type="button"
                              className={[
                                styles.pbSketchToolBtn,
                                pbCanvasToolMode === 'draw' && pbDrawPreset === 'eraser' ? styles.pbSketchToolBtnActive : ''
                              ].filter(Boolean).join(' ')}
                              onClick={() => {
                                setPbDrawPreset('eraser');
                                setPbCanvasToolMode('draw');
                              }}
                              aria-pressed={pbCanvasToolMode === 'draw' && pbDrawPreset === 'eraser'}
                              title="Eraser"
                              {...pbTip('Eraser', 'right')}
                            >
                              <div className={`${styles.pbToolSketch} ${styles.pbToolSketchEraser}`} />
                              {pbCanvasToolMode === 'draw' && pbDrawPreset === 'eraser' && pbDrawSettingsOpen && (
                                <div className={styles.pbDrawBrushPreview}>
                                  <div
                                    className={styles.pbDrawBrushPreviewInner}
                                    style={{
                                      width: `${pbDrawWeight * (pbZoomVal / 100)}px`,
                                      height: `${pbDrawWeight * (pbZoomVal / 100)}px`,
                                      backgroundColor: '#ffffff',
                                      opacity: 1,
                                      border: '1px dashed #cccccc',
                                    }}
                                  />
                                </div>
                              )}
                            </button>
                            
                            <div className={styles.pbSketchDockDivider} />
                            
                             <div className={[
                               styles.pbSketchSizeIndicator,
                               pbDrawPreset === 'eraser' ? styles.pbSketchSizeIndicatorHidden : ''
                             ].filter(Boolean).join(' ')}>
                               <button
                                 ref={pbDrawColorAnchorRef}
                                 type="button"
                                 className={styles.pbSketchSizeDot}
                                 style={{ backgroundColor: pbDrawColor, border: 'none', cursor: 'pointer' }}
                                 title="Choose color"
                                 onClick={() => {
                                   setPbDrawSettingsOpen(false);
                                   if (!pbDrawColorPickerOpen) setPbDrawColorPickerOpen(true);
                                 }}
                                 data-color-picker-toggle="true"
                                 {...pbTip('Choose color', 'right')}
                               />
                             </div>
                             {pbDrawColorPickerOpen && (
                               <PbColorPicker
                                 anchorRef={pbDrawColorAnchorRef}
                                 color={pbDrawColor}
                                 onChange={(newColor) => {
                                   setPbDrawColors((prev) => ({
                                     ...prev,
                                     [pbDrawPreset]: newColor,
                                   }));
                                 }}
                                 onPreview={(newColor) => {
                                   const activePreset = pbDrawPreset;
                                   if (activePreset === 'marker') {
                                     const tip = document.querySelector(`.${styles.pbMarkerTip}`) as HTMLElement;
                                     if (tip) tip.style.backgroundColor = newColor;
                                     const squiggle = document.querySelector(`.${styles.pbMarkerSquiggle}`) as SVGElement;
                                     if (squiggle) squiggle.setAttribute('stroke', newColor);
                                   } else if (activePreset === 'highlighter') {
                                     const tip = document.querySelector(`.${styles.pbHighlighterTip}`) as HTMLElement;
                                     if (tip) tip.style.backgroundColor = newColor;
                                     const tool = document.querySelector(`.${styles.pbToolSketchHighlighter}`) as HTMLElement;
                                     if (tool) tool.style.setProperty('--pb-highlighter-color', newColor);
                                   }
                                 }}
                                 onClose={() => setPbDrawColorPickerOpen(false)}
                                 align="right"
                               />
                             )}

                            {/* Weight/Transparency menu */}
                             <div
                               ref={pbSettingsMenuBtnRef}
                               className={styles.pbSketchMenuIndicator}
                               role="button"
                               tabIndex={0}
                               onMouseDown={(e) => e.stopPropagation()}
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter' || e.key === ' ') {
                                   e.preventDefault();
                                   setPbDrawSettingsOpen((p) => !p);
                                   setPbDrawColorPickerOpen(false);
                                 }
                               }}
                               onClick={() => {
                                 setPbDrawSettingsOpen((p) => !p);
                                 setPbDrawColorPickerOpen(false);
                               }}
                               title="Brush settings"
                               {...pbTip('Brush settings', 'right')}
                             >
                              <div className={styles.pbSketchMenuLine} />
                              <div className={styles.pbSketchMenuLine} />
                              <div className={styles.pbSketchMenuLine} />
                            </div>

                            {/* Check mark button to finish drawing / switch to select mode */}
                             <button
                               type="button"
                               className={[
                                 styles.pbSketchCheckBtn,
                                 pbCanvasToolMode !== 'draw' ? styles.pbSketchCheckBtnHidden : ''
                               ].filter(Boolean).join(' ')}
                               onClick={() => {
                                 setPbCanvasToolMode('select');
                                 setPbDrawColorPickerOpen(false);
                               }}
                               title="Finish Drawing"
                               aria-label="Finish Drawing"
                               {...pbTip('Finish drawing', 'right')}
                             >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </button>
                          </div>

                          <div className={[
                            styles.pbLineList,
                            pbActiveSubTool === 'lines' ? styles.pbLineListVisible : styles.pbLineListHidden
                          ].filter(Boolean).join(' ')}>
                            <button
                              type="button"
                              className={`${styles.pbLineBtn} ${pbLinePreset === 'straight' ? styles.pbLineBtnActive : ''}`}
                              onClick={() => {
                                if (isPageLocked) return;
                                setPbLinePreset('straight');
                                const pageId = pbActivePageIdRef.current ?? pbPages[pbActivePageIndex]?.id;
                                if (!pageId) return;
                                runPbFabricPageAction(pageId, (api) => {
                                  void api.addCustomLine('straight');
                                });
                              }}
                              aria-pressed={pbLinePreset === 'straight'}
                              title="Straight line"
                              {...pbTip('Straight line', 'right')}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M6 18L18 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                <circle cx="6" cy="18" r="2.8" className={styles.pbLineBtnDot} />
                                <circle cx="18" cy="6" r="2.8" className={styles.pbLineBtnDot} />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className={`${styles.pbLineBtn} ${pbLinePreset === 'curve' ? styles.pbLineBtnActive : ''}`}
                              onClick={() => {
                                if (isPageLocked) return;
                                setPbLinePreset('curve');
                                const pageId = pbActivePageIdRef.current ?? pbPages[pbActivePageIndex]?.id;
                                if (!pageId) return;
                                runPbFabricPageAction(pageId, (api) => {
                                  void api.addCustomLine('curve');
                                });
                              }}
                              aria-pressed={pbLinePreset === 'curve'}
                              title="Curved line"
                              {...pbTip('Curved line', 'right')}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M 4 15 Q 20 24 20 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                <circle cx="4" cy="15" r="2.8" className={styles.pbLineBtnDot} />
                                <circle cx="16" cy="16.75" r="2.8" className={styles.pbLineBtnDot} />
                                <circle cx="20" cy="4" r="2.8" className={styles.pbLineBtnDot} />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className={`${styles.pbLineBtn} ${pbLinePreset === 'zigzag' ? styles.pbLineBtnActive : ''}`}
                              onClick={() => {
                                if (isPageLocked) return;
                                setPbLinePreset('zigzag');
                                const pageId = pbActivePageIdRef.current ?? pbPages[pbActivePageIndex]?.id;
                                if (!pageId) return;
                                runPbFabricPageAction(pageId, (api) => {
                                  void api.addCustomLine('zigzag');
                                });
                              }}
                              aria-pressed={pbLinePreset === 'zigzag'}
                              title="Zigzag line"
                              {...pbTip('Zigzag line', 'right')}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M 4 20 C 4 11, 7.5 5, 8 5 C 9 5, 15 19, 16 19 C 16.5 19, 20 13, 20 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                <circle cx="4" cy="20" r="2.8" className={styles.pbLineBtnDot} />
                                <circle cx="8" cy="5" r="2.8" className={styles.pbLineBtnDot} />
                                <circle cx="16" cy="19" r="2.8" className={styles.pbLineBtnDot} />
                                <circle cx="20" cy="4" r="2.8" className={styles.pbLineBtnDot} />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <PbThumbScrollbar
                    scrollRef={pbSidebarPropertiesRef}
                    hidden={pbActiveTool === 'tools' && pbActiveSubTool === 'shapes'}
                  />
                </div>
                ) : null}
              </aside>

            {/* Center Column: workspace (Canvas) + Organizer */}
            <div className={styles.photobookCenterWorkspaceColumn}>

              {/* Zone 4: Main Workspace */}
            <div className={`${styles.pbThumbScrollbarHost} ${styles.pbThumbScrollbarHostWorkspace}`}>
              <main
                ref={photobookMainWorkspaceRef}
                className={`${styles.photobookMainWorkspace} ${styles.pbNativeScrollHidden} ${pbWorkspaceMode === 'hand' ? styles.workspaceHandMode : ''}`}
                style={{
                  ['--pb-stack-zoom' as string]: pbZoomVal / 100,
                }}
                data-lenis-prevent
                onWheel={onPbWorkspaceWheel}
                onPointerDownCapture={onPbWorkspacePointerDownCapture}
                onPointerMove={onPbWorkspacePointerMove}
                onPointerUp={onPbWorkspacePointerUp}
                onPointerCancel={onPbWorkspacePointerCancel}
              >
                <div className={styles.pbWorkspaceScrollContent}>

                {pbPreviewMode && pbPreviewFlipbookUrls.length > 0 ? (
                  <div className={styles.pbFlipbookPreviewHost}>
                    <ProductDigitalFlipbook
                      flipbook={{
                        enabled: true,
                        hardcoverColor: displayProduct.digitalFlipbook?.hardcoverColor,
                        sections: [{
                          id: 'photobook-preview',
                          title: 'Preview',
                          imageUrls: pbPreviewFlipbookUrls,
                        }],
                      }}
                      hideSectionNav
                      hideTitle
                      embedded
                      photobookSpreadMode
                      hideHardcover
                      pageSizePx={pbPageSizePx}
                      layoutContainerRef={photobookMainWorkspaceRef}
                    />
                  </div>
                ) : (
                <>
                {pbPreviewPreparing ? (
                  <div className={styles.pbFlipbookPreviewPreparingOverlay} aria-live="polite">
                    <p className={styles.pbFlipbookPreviewLoading}>Preparing book preview…</p>
                  </div>
                ) : null}
                <div ref={pbCanvasStackViewportRef} className={styles.pbCanvasStackViewport}>
                  <div
                    ref={pbCanvasStackRef}
                    className={styles.pbCanvasStack}
                    style={{
                      ['--pb-stack-zoom' as string]: pbZoomVal / 100,
                      ['--pb-canvas-base' as string]: `${pbPageSizePx.widthPx}px`,
                      ['--pb-canvas-height-base' as string]: `${pbPageSizePx.heightPx}px`,
                      ['--pb-fabric-select-pad' as string]: `${56 * (pbZoomVal / 100)}px`,
                    }}
                  >
                    {getPageRows().map((rowPages, rowIndex) => {
                      return (
                        <Fragment key={`row-${rowIndex}`}>
                          <div className={styles.pbCanvasRow}>
                            {rowPages.map((page) => {
                              const pageIndex = pbPages.findIndex((p) => p.id === page.id);
                              const pageLocked = !!page.locked;
                              const pageIsCover = isPbCoverPage(page);
                              const pageIsFrontCover = isPbFrontCoverPage(page);
                              const pageIsBackCover = isPbBackCoverPage(page);
                              const isActivePage = pageIndex === pbActivePageIndex;
                              const pageLabel = getPbCanvasPageLabelFor(pageIndex);
                              const pageCaptionSuffix = page.caption?.trim() || 'Add page title';
                              const pageToolbarTitle = `${pageLabel} - ${pageCaptionSuffix}`;
                              const isPageLayoutSidebarActive =
                                isActivePage &&
                                !pageIsFrontCover &&
                                pbActiveTool === 'edit' &&
                                pbEditCanvasPageSelected &&
                                !pbEditHover &&
                                pbEditCropPageId === null &&
                                pbFrameAdjustPageId === null;
                              const isCoverDesignSidebarActive =
                                isActivePage &&
                                pageIsFrontCover &&
                                pbActiveTool === 'edit' &&
                                pbEditCanvasPageSelected &&
                                !pbEditHover &&
                                pbEditCropPageId === null &&
                                pbFrameAdjustPageId === null;
                              const canMoveUp = canMovePbPageUp(pageIndex);
                              const canMoveDown = canMovePbPageDown(pageIndex);
                              const pageLayout = (page.layout ?? 'single') as PbLayout;
                              const pageFabricInteractive =
                                !pbPreviewMode &&
                                !pageLocked &&
                                !pageIsBackCover &&
                                isActivePage &&
                                (pbActiveTool === null ||
                                  pbActiveTool === 'texts' ||
                                  pbActiveTool === 'tools' ||
                                  pbActiveTool === 'images' ||
                                  pbActiveTool === 'emoji' ||
                                  pbActiveTool === 'edit' ||
                                  pbActiveTool === 'pages');
                              const pageFabricData = pageIsBackCover ? undefined : pbFabricByPageId[page.id];
                              const pageHasFabricObjects = pageIsBackCover ? false : pbFabricHasObjects(pageFabricData);
                              const pageIsEditorActive = !pbPreviewMode && !pageLocked && !pageIsBackCover && isActivePage;
                              const pageFabricSelectLayer =
                                pageIsEditorActive &&
                                !(pbActiveTool === 'tools' && (pbCanvasToolMode === 'draw' || pbCanvasToolMode === 'lines'));
                              return (
                                <div
                                  key={page.id}
                                  ref={(el) => {
                                    pbPageBlockRefs.current[page.id] = el;
                                  }}
                                  className={`${styles.pbCanvasPageBlock} ${isActivePage ? styles.pbCanvasPageBlockActive : ''}`}
                                  onClick={() => {
                                    if (pageLocked || pbPreviewMode) return;
                                    activatePbPage(pageIndex);
                                    setPbEditHover(null);
                                    setPbEditPageHeadlinePageId(null);
                                    if (
                                      !pageIsBackCover &&
                                      pbCanvasToolMode !== 'draw' &&
                                      pbCanvasToolMode !== 'lines'
                                    ) {
                                      setPbActiveTool('edit');
                                    }
                                  }}
                                >
                                  <div
                                    className={styles.pbCanvasPageUnit}
                                    style={{
                                      ['--pb-canvas-base' as string]: `${pbPageSizePx.widthPx}px`,
                                      ['--pb-canvas-height-base' as string]: `${pbPageSizePx.heightPx}px`,
                                    }}
                                  >
                                    <div
                                      className={`${styles.pbCanvasToolbar} ${pbWorkspaceMode === 'hand' ? styles.pbCanvasToolbarMuted : ''}`}
                                      onClick={pbWorkspaceMode === 'hand' ? undefined : (e) => e.stopPropagation()}
                                      onPointerDownCapture={pbWorkspaceMode === 'hand' ? undefined : (e) => e.stopPropagation()}
                                      aria-disabled={pbWorkspaceMode === 'hand' ? true : undefined}
                                    >
                                      <div className={styles.pbCanvasToolbarTitle} title={pageToolbarTitle}>
                                        <span className={styles.pbCanvasPageLabel}>{pageLabel}</span>
                                      </div>
                                      {!pbPreviewMode && !pageIsBackCover ? <div className={styles.pbCanvasToolbarActions} onClickCapture={handleToolbarActionsClickCapture}>
                                        {pageIsFrontCover ? (
                                          <button
                                            type="button"
                                            className={`${styles.pbCanvasToolbarBtn} ${isCoverDesignSidebarActive ? styles.pbCanvasToolbarBtnActive : ''}`}
                                            aria-label="Cover designs"
                                            aria-pressed={isCoverDesignSidebarActive}
                                            disabled={pageLocked}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openPbCoverDesignSidebar(pageIndex);
                                            }}
                                            {...pbTip('Cover designs')}
                                          >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                              <path d="M12 20h9" />
                                              <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                                            </svg>
                                          </button>
                                        ) : (
                                          <>
                                        <button
                                          type="button"
                                          className={`${styles.pbCanvasToolbarBtn} ${isPageLayoutSidebarActive ? styles.pbCanvasToolbarBtnActive : ''}`}
                                          aria-label="Page layout"
                                          aria-pressed={isPageLayoutSidebarActive}
                                          disabled={pageLocked}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openPbPageLayoutSidebar(pageIndex);
                                          }}
                                          {...pbTip('Page layout')}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M12 20h9" />
                                            <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                                          </svg>
                                        </button>
                                        <button
                                          type="button"
                                          className={styles.pbCanvasToolbarBtn}
                                          aria-label="Move up"
                                          disabled={!canMoveUp}
                                          onClick={() => movePageUp(pageIndex)}
                                          {...pbTip('Move up')}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M12 19V5M5 12l7-7 7 7" />
                                          </svg>
                                        </button>
                                        <button
                                          type="button"
                                          className={styles.pbCanvasToolbarBtn}
                                          aria-label="Move down"
                                          disabled={!canMoveDown}
                                          onClick={() => movePageDown(pageIndex)}
                                          {...pbTip('Move down')}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M12 5v14M5 12l7 7 7-7" />
                                          </svg>
                                        </button>
                                        <button
                                          type="button"
                                          className={`${styles.pbCanvasToolbarBtn} ${pageLocked ? styles.pbCanvasToolbarBtnLocked : ''}`}
                                          aria-label="Lock page"
                                          aria-pressed={pageLocked}
                                          onClick={() => togglePageLock(pageIndex)}
                                          {...pbTip('Lock page')}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            {pageLocked ? (
                                              <>
                                                <rect x="5" y="11" width="14" height="10" rx="2" />
                                                <path d="M8 11V8a4 4 0 018 0v3" />
                                              </>
                                            ) : (
                                              <>
                                                <rect x="5" y="11" width="14" height="10" rx="2" />
                                                <path d="M8 11V7a4 4 0 118 0v4" />
                                              </>
                                            )}
                                          </svg>
                                        </button>
                                        <button
                                          type="button"
                                          className={styles.pbCanvasToolbarBtn}
                                          aria-label="Add new page"
                                          onClick={() => openPbAddPageLayoutPicker(pageIndex)}
                                          {...pbTip('Add new page')}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M12 5v14M5 12h14" />
                                          </svg>
                                        </button>
                                        <button
                                          type="button"
                                          className={styles.pbCanvasToolbarBtn}
                                          aria-label="Duplicate page"
                                          disabled={pageIsCover}
                                          onClick={() => duplicatePageAt(pageIndex)}
                                          {...pbTip('Duplicate page')}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <rect x="8" y="8" width="12" height="12" rx="2" />
                                            <path d="M4 16V6a2 2 0 012-2h10" />
                                          </svg>
                                        </button>
                                        <button
                                          type="button"
                                          className={styles.pbCanvasToolbarBtn}
                                          aria-label="Delete Page"
                                          disabled={pageIsCover}
                                          onClick={() => handleDeletePageAt(pageIndex)}
                                          {...pbTip('Delete Page')}
                                        >
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                                            <path d="M10 11v6M14 11v6" />
                                          </svg>
                                        </button>
                                          </>
                                        )}
                                      </div> : null}
                                    </div>

                                    <div
                                      className={[
                                        styles.pbCanvasPageZoomHost,
                                        page.id === pbPageBlinkId ? styles.pbCanvasPageZoomHostBlink : '',
                                        pageIsEditorActive ? styles.pbCanvasPageZoomHostActive : '',
                                        pageFabricSelectLayer ? styles.pbCanvasPageZoomHostFabricSelect : '',
                                        pageHasFabricObjects ? styles.pbCanvasPageZoomHostHasFabric : '',
                                        pbFrameAdjustPageId === page.id ? styles.pbCanvasPageZoomHostFrameAdjust : '',
                                        pbGalleryDragActive && !pageLocked && !pageIsBackCover ? styles.pbCanvasPageZoomHostGalleryDrop : '',
                                        isActivePage && (pbCanvasToolMode === 'draw' || pbCanvasToolMode === 'lines') ? styles.pbCanvasPageZoomHostDrawing : '',
                                      ]
                                        .filter(Boolean)
                                        .join(' ')}
                                      style={{
                                        backgroundColor: pageIsBackCover ? '#ffffff' : (page.bg || '#ffffff'),
                                        aspectRatio: `${pbPageSizePx.widthPx} / ${pbPageSizePx.heightPx}`,
                                        ['--pb-page-width-px' as string]: `${pbPageSizePx.widthPx * (pbZoomVal / 100)}px`,
                                        ['--pb-page-height-px' as string]: `${pbPageSizePx.heightPx * (pbZoomVal / 100)}px`,
                                        ['--pb-page-size-px' as string]: `${Math.max(pbPageSizePx.widthPx, pbPageSizePx.heightPx) * (pbZoomVal / 100)}px`,
                                        ['--pb-fabric-select-pad' as string]: `${56 * (pbZoomVal / 100)}px`,
                                      }}
                                      onPointerDown={(e) => {
                                        if (pageLocked || pbPreviewMode || pageIsBackCover || e.button !== 0) return;
                                        if (!isActivePage) {
                                          activatePbPage(pageIndex);
                                          setPbEditHover(null);
                                          setPbEditPageHeadlinePageId(null);
                                          setPbEditCanvasPageSelected(false);
                                          if (pbCanvasToolMode !== 'draw' && pbCanvasToolMode !== 'lines') {
                                            setPbActiveTool('edit');
                                          }
                                        }
                                      }}
                                      onDragOver={pageIsBackCover ? undefined : (e) => handlePbPageGalleryDragOver(page.id, e)}
                                      onDragLeave={pageIsBackCover ? undefined : (e) => handlePbPageGalleryDragLeave(page.id, e)}
                                      onDrop={pageIsBackCover ? undefined : (e) => handlePbPageGalleryDrop(pageIndex, page.id, pageLocked || pageIsBackCover, e)}
                                      onClick={(e) => e.stopPropagation()}
                                      aria-label={`Canvas area for ${pageLabel}`}
                                      data-pb-page-id={page.id}
                                    >
                                      <PbCanvasPage
                                        pageId={page.id}
                                        className={styles.pbFabricCanvas}
                                        pageWidthPx={pbPageSizePx.widthPx}
                                        pageHeightPx={pbPageSizePx.heightPx}
                                        displayScale={pbZoomVal / 100}
                                        isActivePage={isActivePage}
                                        isPreview={pbPreviewMode}
                                        isLocked={pageLocked || pageIsBackCover}
                                        toolsActive={pageFabricInteractive}
                                        toolMode={pbCanvasToolMode}
                                        drawPreset={pbDrawPreset}
                                        drawColor={pbDrawColor}
                                        drawWeight={pbDrawWeight}
                                        drawOpacity={pbDrawOpacity}
                                        linePreset={pbLinePreset}
                                        canvasShape={pbCanvasShape ?? ''}
                                        extendedSelectArea={!pageLocked && !pageIsBackCover}
                                        documentData={pageFabricData}
                                        onDocumentChange={handlePbFabricChange}
                                        onRegisterApi={handlePbFabricRegisterApi}
                                        galleryDropActive={pbGalleryDragActive && !pageLocked && !pageIsBackCover}
                                        useSidebarEditToolbar
                                        onObjectSelected={handlePbFabricObjectSelected}
                                        onCanvasBackgroundClick={handlePbCanvasBackgroundClick}
                                        onActivatePage={() => {
                                          if (pageIndex !== pbActivePageIndex) {
                                            activatePbPage(pageIndex);
                                            setPbEditHover(null);
                                            setPbEditPageHeadlinePageId(null);
                                            setPbEditCanvasPageSelected(false);
                                          }
                                        }}
                                        onCropActiveChange={(active) => {
                                          if (active) {
                                            setMarqueeVisual(null);
                                            clearMarqueeDragPreview(getPbFabricCanvas(page.id));
                                            workspaceMarqueeRef.current = null;
                                          }
                                          setPbEditCropPageId(active ? page.id : null);
                                        }}
                                        pageBackgroundColor={pageIsBackCover ? '#ffffff' : (page.bg || '#ffffff')}
                                        pageLayoutId={
                                          page.id === 'fc'
                                            ? undefined
                                            : page.id === 'bc'
                                              ? 'blank'
                                              : normalizeLayoutId(page.layout)
                                        }
                                        layoutFrameGapEnabled={page.layoutFrameGapEnabled !== false}
                                        coverDesignId={page.id === 'fc' ? normalizeCoverDesignId(page.coverDesign) : undefined}
                                        galleryDragUrl={pbDraggingGalleryUrl}
                                        onFrameCropOpen={handlePbFrameCropOpen}
                                        onFrameAdjustActiveChange={(active, opts) => {
                                          if (!active) {
                                            setPbFrameAdjustPageId(null);
                                            setPbFrameAdjustZoom(1);
                                            return;
                                          }
                                          setPbFrameAdjustPageId(page.id);
                                        }}
                                        pbTip={pbTip}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {rowIndex === 0 && !pbHasInnerPages && !pbPreviewMode ? (
                            <div className={styles.pbAddFirstPageRow}>
                              <button
                                type="button"
                                className={styles.pbAddFirstPageBtn}
                                onClick={() => openPbAddPageLayoutPicker(0)}
                                aria-label="Add your first page"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={styles.pbAddFirstPageBtnIcon}>
                                  <path d="M12 5v14M5 12h14" />
                                </svg>
                                Add your first page
                              </button>
                            </div>
                          ) : null}
                        </Fragment>
                      );
                    })}

                  </div>
                </div>
                </>
                )}
                </div>
              </main>
              <div className={styles.photobookWorkspaceLogo} aria-hidden="true">
                <Logo
                  imageClassName={styles.photobookWorkspaceLogoImage}
                  textClassName={styles.photobookWorkspaceLogoText}
                />
              </div>
              <PbThumbScrollbar scrollRef={photobookMainWorkspaceRef} />

              {/* Floating Workspace Controls (Sticky Bottom Bar) */}
              <div className={styles.pbWorkspaceControlsBar}>
                <div className={styles.pbWorkspaceControlsGroup}>
                  <button
                    type="button"
                    className={`${styles.pbWorkspaceControlBtn} ${pbWorkspaceMode === 'move' ? styles.pbWorkspaceControlBtnActive : ''}`}
                    onClick={() => {
                      if (pbWorkspaceMode === 'move') {
                        setPbWorkspaceMode('hand');
                        showToast('Hand tool active', 'info');
                      } else {
                        setPbWorkspaceMode('move');
                        showToast('Select tool active', 'info');
                      }
                    }}
                    {...pbTip('Select / Move tool')}
                    aria-label="Select / Move tool"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}>
                      <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    className={`${styles.pbWorkspaceControlBtn} ${pbWorkspaceMode === 'hand' ? styles.pbWorkspaceControlBtnActive : ''}`}
                    onClick={() => {
                      if (pbWorkspaceMode === 'hand') {
                        setPbWorkspaceMode('move');
                        showToast('Select tool active', 'info');
                      } else {
                        setPbWorkspaceMode('hand');
                        showToast('Hand tool active', 'info');
                      }
                    }}
                    {...pbTip('Hand tool (Pan workspace)')}
                    aria-label="Hand tool"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}>
                      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5" />
                      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6" />
                      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4.5" />
                      <path d="M6 10a2 2 0 0 0-2 2v5a7 7 0 0 0 7 7h2a6 6 0 0 0 6-6v-7a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2" />
                    </svg>
                  </button>
                </div>

                <div className={styles.pbWorkspaceControlsDivider} />

                <div className={styles.pbWorkspaceControlsGroup}>
                  <button
                    type="button"
                    className={styles.pbWorkspaceControlBtn}
                    onClick={() => animatePbZoomTo(pbZoomValRef.current - 15)}
                    {...pbTip('Zoom out')}
                    aria-label="Zoom out"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>

                  <span className={styles.pbWorkspaceZoomLabel}>
                    {Math.round(pbZoomVal)}%
                  </span>

                  <button
                    type="button"
                    className={styles.pbWorkspaceControlBtn}
                    onClick={() => animatePbZoomTo(pbZoomValRef.current + 15)}
                    {...pbTip('Zoom in')}
                    aria-label="Zoom in"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            </div>

          </div>
        </div>

        {pbCursorTooltip ? (
          <div
            className={styles.photobookCursorTooltip}
            style={{
              left: pbCursorTooltip.x,
              top: pbCursorTooltip.fixed ? pbCursorTooltip.y : pbCursorTooltip.y + 14,
              ...(pbCursorTooltip.fixed
                ? {
                    transform:
                      pbCursorTooltip.align === 'right'
                        ? 'translateY(-50%)'
                        : 'translateX(-50%)',
                  }
                : {}),
            }}
            role="tooltip"
          >
            {pbCursorTooltip.text}
          </div>
        ) : null}

        {pbAddPageLayoutPickerOpen ? (
          <div
            className={styles.pbAddPageLayoutOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pb-add-page-layout-title"
            onClick={() => setPbAddPageLayoutPickerOpen(false)}
          >
            <div className={styles.pbAddPageLayoutDialog} onClick={(e) => e.stopPropagation()}>
              <div className={styles.pbAddPageLayoutDialogHeader}>
                <div className={styles.pbAddPageLayoutTitleRow}>
                  <h3 id="pb-add-page-layout-title" className={styles.pbAddPageLayoutTitle}>
                    {pbLayoutPickerMode === 'change-layout'
                      ? 'Change page layout'
                      : 'What kind of Page Layout you want?'}
                  </h3>
                  <button
                    type="button"
                    className={styles.pbAddPageLayoutCloseBtn}
                    aria-label="Close layout picker"
                    onClick={() => {
                      setPbAddPageLayoutPickerOpen(false);
                      setPbAddPageAfterIndex(null);
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className={styles.pbAddPageLayoutDesc}>
                  {pbLayoutPickerMode === 'change-layout'
                    ? 'Select a new layout for the active page.'
                    : 'Select different kinds of page layouts or start from scratch'}
                </p>
              </div>

              <div className={styles.pbAddPageLayoutDialogScroll}>
                <PbLayoutPickerGrid
                  activeLayoutId={
                    pbLayoutPickerMode === 'change-layout'
                      ? normalizeLayoutId(pbPages[pbChangeLayoutPageIndex ?? pbActivePageIndex]?.layout)
                      : null
                  }
                  onSelect={handlePbLayoutPickerSelect}
                  className={styles.pbLayoutsGridAddPage}
                />
              </div>
            </div>
          </div>
        ) : null}

        {pbDrawSettingsOpen && pbDrawSettingsPopupPos && typeof document !== 'undefined'
          ? createPortal(
              (() => {
                const pbSketchSliderFill = pbEditorDarkMode ? '#ffffff' : '#1c1418';
                const pbSketchSliderEmpty = pbEditorDarkMode ? '#3a3a3c' : '#e8e2e6';
                const pbSketchSliderBg = (pct: number) =>
                  `linear-gradient(to right, ${pbSketchSliderFill} 0%, ${pbSketchSliderFill} ${pct}%, ${pbSketchSliderEmpty} ${pct}%, ${pbSketchSliderEmpty} 100%)`;
                const weightPct = ((pbDrawWeight - 1) / 99) * 100;

                return (
              <div
                ref={pbSettingsPopupRef}
                className={[
                  styles.pbSketchSettingsPopup,
                  styles.pbSketchSettingsPopupFloating,
                  !pbEditorDarkMode ? styles.pbSketchSettingsPopupLight : '',
                ].filter(Boolean).join(' ')}
                style={{
                  top: pbDrawSettingsPopupPos.top,
                  left: pbDrawSettingsPopupPos.left,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                  <div className={styles.pbSketchSettingsGroup}>
                    <span className={styles.pbSketchSettingsLabel}>Border Weight</span>
                    <div className={styles.pbSketchSettingsSliderRow}>
                      <input
                        type="range"
                        min={1}
                        max={100}
                        defaultValue={pbDrawWeight}
                        key={`weight-${pbDrawPreset}`}
                        onMouseUp={(e) => {
                          const val = Number((e.target as HTMLInputElement).value);
                          if ((window as any)._pbWeightTimeout) {
                            clearTimeout((window as any)._pbWeightTimeout);
                          }
                          setPbDrawWeightsByPreset((prev) => ({
                            ...prev,
                            [pbDrawPreset]: val,
                          }));
                        }}
                        onTouchEnd={(e) => {
                          const val = Number((e.target as HTMLInputElement).value);
                          if ((window as any)._pbWeightTimeout) {
                            clearTimeout((window as any)._pbWeightTimeout);
                          }
                          setPbDrawWeightsByPreset((prev) => ({
                            ...prev,
                            [pbDrawPreset]: val,
                          }));
                        }}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const previewInner = document.querySelector(`.${styles.pbDrawBrushPreviewInner}`) as HTMLElement;
                          if (previewInner) {
                            const size = val * (pbZoomVal / 100);
                            previewInner.style.width = `${size}px`;
                            previewInner.style.height = `${size}px`;
                          }
                          const label = document.getElementById('pb-weight-val-label');
                          if (label) {
                            label.textContent = `${val}px`;
                          }
                          const slider = e.target as HTMLInputElement;
                          const weightPctLive = ((val - 1) / 99) * 100;
                          slider.style.background = pbSketchSliderBg(weightPctLive);
                          if ((window as any)._pbWeightTimeout) {
                            clearTimeout((window as any)._pbWeightTimeout);
                          }
                          (window as any)._pbWeightTimeout = setTimeout(() => {
                            setPbDrawWeightsByPreset((prev) => ({
                              ...prev,
                              [pbDrawPreset]: val,
                            }));
                          }, 250);
                        }}
                        className={styles.pbSketchSlider}
                        style={{
                          background: pbSketchSliderBg(weightPct),
                        }}
                      />
                      <span id="pb-weight-val-label" className={styles.pbSketchSettingsVal}>{pbDrawWeight}px</span>
                    </div>
                  </div>
                  {pbDrawPreset !== 'eraser' ? (
                    <div className={styles.pbSketchSettingsGroup}>
                      <span className={styles.pbSketchSettingsLabel}>Transparency</span>
                      <div className={styles.pbSketchSettingsSliderRow}>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          defaultValue={pbDrawOpacity}
                          key={`opacity-${pbDrawPreset}`}
                          onMouseUp={(e) => {
                            const val = Number((e.target as HTMLInputElement).value);
                            if ((window as any)._pbOpacityTimeout) {
                              clearTimeout((window as any)._pbOpacityTimeout);
                            }
                            setPbDrawOpacitiesByPreset((prev) => ({
                              ...prev,
                              [pbDrawPreset]: val,
                            }));
                          }}
                          onTouchEnd={(e) => {
                            const val = Number((e.target as HTMLInputElement).value);
                            if ((window as any)._pbOpacityTimeout) {
                              clearTimeout((window as any)._pbOpacityTimeout);
                            }
                            setPbDrawOpacitiesByPreset((prev) => ({
                              ...prev,
                              [pbDrawPreset]: val,
                            }));
                          }}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const previewInner = document.querySelector(`.${styles.pbDrawBrushPreviewInner}`) as HTMLElement;
                            if (previewInner) {
                              previewInner.style.opacity = String(val / 100);
                            }
                            const label = document.getElementById('pb-opacity-val-label');
                            if (label) {
                              label.textContent = `${val}%`;
                            }
                            const slider = e.target as HTMLInputElement;
                            slider.style.background = pbSketchSliderBg(val);
                            if ((window as any)._pbOpacityTimeout) {
                              clearTimeout((window as any)._pbOpacityTimeout);
                            }
                            (window as any)._pbOpacityTimeout = setTimeout(() => {
                              setPbDrawOpacitiesByPreset((prev) => ({
                                ...prev,
                                [pbDrawPreset]: val,
                              }));
                            }, 250);
                          }}
                          className={styles.pbSketchSlider}
                          style={{
                            background: pbSketchSliderBg(pbDrawOpacity),
                          }}
                        />
                        <span id="pb-opacity-val-label" className={styles.pbSketchSettingsVal}>{pbDrawOpacity}%</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
                );
              })(),
              document.body,
            )
          : null}

        {pbLayoutChangeConfirm ? (
          <div
            className={styles.pbDeletePageOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pb-layout-change-title"
            onClick={() => setPbLayoutChangeConfirm(null)}
          >
            <div className={styles.pbDeletePageDialog} onClick={(e) => e.stopPropagation()}>
              <div className={styles.pbDeletePageDialogIcon} aria-hidden="true">
                <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M80.6217 59.1676C116.502 55.4997 339 45.6991 339 63.5823C339 150.887 351.127 311.5 339 325.495C319.5 348 89.0019 353 73.6589 338.949C58.6562 325.21 64.7292 157.8 64.7292 103.154"
                    stroke="currentColor"
                    strokeOpacity="0.9"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 id="pb-layout-change-title" className={styles.pbDeletePageTitle}>
                {pbLayoutChangeConfirm.coverDesignId ? 'Change cover design?' : 'Change layout?'}
              </h3>
              <p className={styles.pbDeletePageDesc}>
                {pbLayoutChangeConfirm.coverDesignId
                  ? 'Changing the cover design will remove photos placed in the current frame. Continue?'
                  : 'Changing layout will remove photos placed in the current layout. Continue?'}
              </p>
              <div className={styles.pbDeletePageActions}>
                <button
                  type="button"
                  className={styles.pbDeletePageBtnYes}
                  onClick={() => setPbLayoutChangeConfirm(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.pbDeletePageBtnNo}
                  onClick={() => {
                    const { pageIndex, layoutId, coverDesignId } = pbLayoutChangeConfirm;
                    setPbLayoutChangeConfirm(null);
                    if (coverDesignId) {
                      applyPbCoverDesign(pageIndex, coverDesignId);
                    } else if (layoutId) {
                      applyPbPageLayout(pageIndex, layoutId);
                    }
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pbDeletePagePromptIndex !== null ? (
          <div
            className={styles.pbDeletePageOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pb-delete-page-title"
            onClick={() => setPbDeletePagePromptIndex(null)}
          >
            <div
              className={styles.pbDeletePageDialog}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.pbDeletePageDialogIcon} aria-hidden="true">
                <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M177.818 76.0347C193.128 62.879 219.565 56.3475 239.677 64.7699C304.609 91.9587 269.1 183.452 204.028 174.369C160.167 168.248 162.583 84.1728 196.691 69.8894"
                    stroke="currentColor"
                    strokeOpacity="0.9"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M142.592 149C111.564 182.552 91.4488 286.487 107.863 329.195C109.631 333.784 114.081 334.831 117.45 331.31C155.592 308 201.533 267.999 236.81 234.342C238.48 232.748 240.596 232.585 242.747 232.858C243.34 233.617 243.261 234.425 243.183 235.222C241.916 248 241.311 272.377 240.996 285.219C240.708 296.882 239.477 308.533 239.564 320.225C239.585 323.115 239.284 329.44 239.564 332.31C239.78 334.509 244.215 335.724 243.183 338.048"
                    stroke="currentColor"
                    strokeOpacity="0.9"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M142.71 148.845C142.007 152.51 148.963 167.717 151.144 170.81C169.028 196.155 189.4 232.596 223.701 236.643C226.813 237.01 229.933 235.319 232.977 236.992C233.683 237.382 234.488 236.478 235.107 235.976C237.021 234.424 238.895 232.819 240.285 230.783C241.588 228.877 242.709 226.899 245.782 227.905C248.761 228.883 250.756 230.562 250.968 233.665C251.089 235.434 251.085 237.181 251.929 238.814C267.165 268.244 280.722 296.267 291.172 327.626C292.39 331.283 294.472 333.263 298.883 332.765"
                    stroke="currentColor"
                    strokeOpacity="0.9"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 id="pb-delete-page-title" className={styles.pbDeletePageTitle}>
                Deleting your memory?
              </h3>
              <p className={styles.pbDeletePageDesc}>
                This page will be removed from your photobook along with its photos and text.
                Once deleted, you will need to add and design that page again from scratch.
              </p>
              <div className={styles.pbDeletePageActions}>
                <button
                  type="button"
                  className={styles.pbDeletePageBtnYes}
                  onClick={confirmDeletePbPage}
                >
                  Delete Page
                </button>
                <button
                  type="button"
                  className={styles.pbDeletePageBtnNo}
                  onClick={() => setPbDeletePagePromptIndex(null)}
                >
                  Keep Page
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pbFrameCropModal ? (
          <PbFrameCropModal
            open
            sourceUrl={pbFrameCropModal.sourceUrl}
            frameWidth={pbFrameCropModal.frameWidth}
            frameHeight={pbFrameCropModal.frameHeight}
            naturalWidth={pbFrameCropModal.naturalWidth}
            naturalHeight={pbFrameCropModal.naturalHeight}
            initialCrop={pbFrameCropModal.crop}
            onApply={handlePbFrameCropApply}
            onCancel={handlePbFrameCropCancel}
          />
        ) : null}

        <PhotobookLoginModal
          open={pbLoginOpen}
          onSuccess={handlePbLoginSuccess}
          returnPath={getPhotobookAuthReturnPath()}
          subtitle="Sign in to save your design and continue editing anytime."
        />

        {pbShowNoPagesModal ? (
          <div
            className={styles.pbFinalCheckOverlay}
            role="presentation"
            data-lenis-prevent
            onClick={() => setPbShowNoPagesModal(false)}
          >
            <div
              className={[
                styles.pbFinalCheckModal,
                pbEditorDarkMode ? styles.pbFinalCheckModalDark : '',
              ].filter(Boolean).join(' ')}
              role="dialog"
              aria-modal="true"
              aria-labelledby="pb-no-pages-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.pbFinalCheckIcon} style={{ background: 'none', width: 'auto', height: 'auto', color: 'inherit' }} aria-hidden="true">
                <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" width="96" height="96">
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <path d="M233.326 199.387C238 192.94 255.135 134.421 242.701 138.3C238.07 139.747 232.461 158.784 229.976 158.784C229.532 158.784 214.117 107.943 193.823 134.87C173.53 161.797 264.935 324.921 276.511 335.462" stroke="currentColor" strokeOpacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M200.821 261.103C175.831 265.167 155.292 249.438 137.152 229.621C77.646 164.627 127.837 39.0962 223.627 62.981C312.813 85.218 308.884 233.307 222.525 254.836" stroke="currentColor" strokeOpacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M172.282 174.383C164.949 176.112 160.798 176.12 156.151 170.433" stroke="currentColor" strokeOpacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M182.208 221.024C188.384 218.646 194.556 218.81 200.82 219.758" stroke="currentColor" strokeOpacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M279.339 335.316C275.208 332.707 291.143 285.4 290.112 285.053C284.404 283.148 249.148 284.71 240.584 285.053C167.159 287.991 134.211 258.394 109 339.185" stroke="currentColor" strokeOpacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M142.503 292.033C144.524 306.917 144.97 322.796 146.225 337.944" stroke="currentColor" strokeOpacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                  </g>
                </svg>
              </div>
              <h3 id="pb-no-pages-title" className={styles.pbFinalCheckTitle}>
                You have no pages
              </h3>
              <p className={styles.pbFinalCheckMessage}>
                Please add your first page to start designing your photobook.
              </p>
              <div className={styles.pbFinalCheckActions}>
                <button
                  type="button"
                  className={styles.pbFinalCheckContinueBtn}
                  onClick={() => {
                    setPbShowNoPagesModal(false);
                    openPbAddPageLayoutPicker();
                  }}
                  style={{ width: '100%' }}
                >
                  Add your first page
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pbAddToCartConfirmOpen ? (
          <div
            className={styles.pbFinalCheckOverlay}
            role="presentation"
            data-lenis-prevent
            onClick={() => setPbAddToCartConfirmOpen(false)}
          >
            <div
              className={[
                styles.pbFinalCheckModal,
                pbEditorDarkMode ? styles.pbFinalCheckModalDark : '',
              ].filter(Boolean).join(' ')}
              role="dialog"
              aria-modal="true"
              aria-labelledby="pb-final-check-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.pbFinalCheckIcon} aria-hidden="true">
                <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M167.002 269.605C164.76 257.775 166.341 227.942 162.536 203.527C158.745 179.202 154.623 160.153 157.498 156.098C168.485 140.605 178.671 185.076 178.671 183.012C178.671 178.826 173.482 131.947 185.987 136.133C197.529 139.995 192.106 183.836 200.711 175.198C208.247 167.629 194.789 128.094 210.567 123.567C224.457 119.578 217.704 168.037 223.398 168.037C225.252 168.037 228.71 133.135 237.662 136.133C251.046 140.613 241.55 191.655 241.55 201.239C241.55 214.342 277.091 161.513 279.604 194.621C279.806 197.285 260.982 216.78 247.293 235.14C240.966 243.627 234.823 262.698 230.464 268.051"
                    stroke="currentColor"
                    strokeOpacity="0.9"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M90.9648 151.51C90.9648 164.205 90.9648 238.822 90.9648 241.752C90.9648 244.682 156.769 313.673 158.11 313.673C159.451 313.673 194.417 310.605 204.89 310.605C211.872 310.605 230.326 312.07 260.253 315C291.935 278.823 308.92 259.472 311.209 256.947C313.498 254.423 319.44 249.358 329.035 241.752C327.849 187.136 327.256 158.212 327.256 154.979C327.256 150.13 266.751 93.123 265.024 88.3523C263.297 83.5817 216.917 86.8951 207.776 86.8951C201.683 86.8951 187.201 86.2634 164.331 85C126.225 123.089 104.775 143.11 99.9813 145.064"
                    stroke="currentColor"
                    strokeOpacity="0.9"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 id="pb-final-check-title" className={styles.pbFinalCheckTitle}>
                One Final Check
              </h3>
              <p className={styles.pbFinalCheckMessage}>
                You&apos;ve put time into creating something special. A quick review now can help avoid small mistakes that become permanent once printed. Please check your cover, captions, and images before continuing. Any captions/images left unedited in the canvas will be removed.
              </p>
              <div className={styles.pbFinalCheckActions}>
                <button
                  type="button"
                  className={styles.pbFinalCheckReviewBtn}
                  onClick={() => setPbAddToCartConfirmOpen(false)}
                  disabled={pbAddingToCart}
                >
                  Review Design
                </button>
                <button
                  type="button"
                  className={styles.pbFinalCheckContinueBtn}
                  onClick={() => void handlePbAddToCart()}
                  disabled={pbAddingToCart || pbIsSaving}
                >
                  {pbAddingToCart ? 'Adding…' : 'Continue to Cart'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pbCloseEditorConfirmOpen ? (
          <div
            className={styles.pbFinalCheckOverlay}
            role="presentation"
            data-lenis-prevent
            onClick={() => setPbCloseEditorConfirmOpen(false)}
          >
            <div
              className={[
                styles.pbCloseEditorModal,
                pbEditorDarkMode ? styles.pbFinalCheckModalDark : '',
              ].filter(Boolean).join(' ')}
              role="dialog"
              aria-modal="true"
              aria-labelledby="pb-close-editor-message"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.pbCloseEditorIcon} aria-hidden="true">
                <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M152.526 134.8C236.161 72.4698 340.146 220.493 243.442 279.824C150.752 336.688 95.2145 229.357 141.097 149.303"
                    stroke="currentColor"
                    strokeOpacity="0.9"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M259.155 125.382C277.229 99.2395 303.592 158.898 285.585 162.779"
                    stroke="currentColor"
                    strokeOpacity="0.9"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M145.093 120.982C129.968 96.9319 97.8704 149.737 111.145 161.779"
                    stroke="currentColor"
                    strokeOpacity="0.9"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M219.28 100C206.252 101.255 193.329 100 180.332 100"
                    stroke="currentColor"
                    strokeOpacity="0.9"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M198.879 152.779C204.311 247.903 186.442 223.399 229.481 197.063"
                    stroke="currentColor"
                    strokeOpacity="0.9"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M191.46 169.779C199.849 148.812 198.631 149.071 208.152 166.933"
                    stroke="currentColor"
                    strokeOpacity="0.9"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M223.917 194.304C234.139 189.603 233.248 190.944 230.255 202.779"
                    stroke="currentColor"
                    strokeOpacity="0.9"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M138.603 276.779C131.604 282.947 127.3 292.974 122.838 300.779"
                    stroke="currentColor"
                    strokeOpacity="0.9"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M257.301 276.779C263.759 283.958 267.984 291.65 271.211 300.779"
                    stroke="currentColor"
                    strokeOpacity="0.9"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p id="pb-close-editor-message" className={styles.pbCloseEditorMessage}>
                You can still design later when it fits for you by going to Account → Saved Designs.
              </p>
              <button
                type="button"
                className={styles.pbCloseEditorConfirmBtn}
                onClick={() => { void closePhotobookEditor({ reloadPage: true }); }}
                disabled={pbIsSaving}
              >
                Close the editor
              </button>
            </div>
          </div>
        ) : null}

        <div
          className={`${styles.pbPreviewFadeOverlay} ${
            pbPreviewFadeActive ? styles.pbPreviewFadeOverlayActive : ''
          }`}
          aria-hidden="true"
        >
          <div className={styles.pbPreviewFadeOverlaySpinner} />
        </div>
      </div>
    );
  };

  const photobookPortal =
    typeof document !== 'undefined' && isPhotobookExperienceOpen
      ? createPortal(renderPhotobookExperience(), document.body)
      : null;

  const pbMobileBlockPortal = pbMobileBlockOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          className={styles.pbMobileBlockOverlay}
          role="presentation"
          data-lenis-prevent
          onClick={() => setPbMobileBlockOpen(false)}
        >
          <div
            className={styles.pbMobileBlockModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pb-mobile-block-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.pbMobileBlockIcon} aria-hidden="true">
              <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M177.818 76.0347C193.128 62.879 219.565 56.3475 239.677 64.7699C304.609 91.9587 269.1 183.452 204.028 174.369C160.167 168.248 162.583 84.1728 196.691 69.8894"
                  stroke="currentColor"
                  strokeOpacity="0.9"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M142.592 149C111.564 182.552 91.4488 286.487 107.863 329.195C109.631 333.784 114.081 334.831 117.45 331.31C155.592 308 201.533 267.999 236.81 234.342C238.48 232.748 240.596 232.585 242.747 232.858C243.34 233.617 243.261 234.425 243.183 235.222C241.916 248 241.311 272.377 240.996 285.219C240.708 296.882 239.477 308.533 239.564 320.225C239.585 323.115 239.284 329.44 239.564 332.31C239.78 334.509 244.215 335.724 243.183 338.048"
                  stroke="currentColor"
                  strokeOpacity="0.9"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M142.71 148.845C142.007 152.51 148.963 167.717 151.144 170.81C169.028 196.155 189.4 232.596 223.701 236.643C226.813 237.01 229.933 235.319 232.977 236.992C233.683 237.382 234.488 236.478 235.107 235.976C237.021 234.424 238.895 232.819 240.285 230.783C241.588 228.877 242.709 226.899 245.782 227.905C248.761 228.883 250.756 230.562 250.968 233.665C251.089 235.434 251.085 237.181 251.929 238.814C267.165 268.244 280.722 296.267 291.172 327.626C292.39 331.283 294.472 333.263 298.883 332.765"
                  stroke="currentColor"
                  strokeOpacity="0.9"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 id="pb-mobile-block-title" className={styles.pbMobileBlockTitle}>
              Sorry!
            </h3>
            <p className={styles.pbMobileBlockMessage}>
              The photobook editor is currently available for desktop and laptop users only. To start designing, please visit us from a device with a larger screen.
            </p>
            <button
              type="button"
              className={styles.pbMobileBlockOkBtn}
              onClick={() => setPbMobileBlockOpen(false)}
            >
              OK, got it
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  const marqueePortal =
    isPhotobookExperienceOpen ? <PbGlobalMarqueePortal visual={marqueeVisual} /> : null;

  const printUploadEnabled = resolvedPolaroidUploadEnabled || resolvedStripUploadEnabled;
  const showUploadsInVariations = Boolean(
    uploadsVariationGroup && (resolvedPolaroidUploadEnabled || resolvedStripUploadEnabled)
  );

  const renderStockStatus = () => {
    const hasVariations = variations && variations.length > 0;
    const isInStock = !isProductOutOfStock && (
      hasVariations
        ? variations.some(v => v.isAvailable)
        : true
    );

    const quantity = displayProduct.quantity ?? 0;
    const lowStockThreshold = displayProduct.lowStockThreshold ?? 10;
    const isLowStock = quantity > 0 && quantity < lowStockThreshold;

    return (
      <div className={`${styles.stockStatus} ${isInStock ? (isLowStock ? styles.lowStock : styles.inStock) : styles.outOfStock}`}>
        {isInStock ? (
          <>
            {isLowStock ? (
              <>
                <svg className={styles.stockIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 7V13M12 16V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span>Low in stock</span>
              </>
            ) : (
              <>
                <svg className={styles.stockIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>In Stock</span>
              </>
            )}
          </>
        ) : (
          <>
            <svg className={styles.stockIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M15 9L9 15M9 9L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>Out of stock</span>
          </>
        )}
      </div>
    );
  };

  return (
    <div
      className={`${isFlatPage ? styles.flatPageContainer : styles.modalOverlay}${isPhotobookExperienceOpen ? ` ${styles.modalOverlayPhotobookLocked}` : ''}${isPrintUploadOpen ? ` ${styles.modalOverlayPrintUploadLocked}` : ''}`}
      onClick={isFlatPage || isPhotobookExperienceOpen ? undefined : closeModal}
    >
      {isFlatPage && (
        <div className={styles.flatPageNav}>
          <button
            onClick={onClose}
            className={styles.flatPageBackLink}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ marginRight: '0.5rem', transform: 'rotate(180deg)', display: 'inline-block', verticalAlign: 'middle' }}
            >
              <path
                d="M9 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span style={{ verticalAlign: 'middle' }}>Back to products</span>
          </button>
        </div>
      )}
      <div
        ref={isFlatPage ? undefined : modalContentRef}
        className={`${isFlatPage ? styles.flatPageBody : styles.modalContent}${isPhotobookExperienceOpen ? ` ${styles.modalContentPhotobookLocked}` : ''}${isPrintUploadOpen ? ` ${styles.modalContentPrintUploadLocked}` : ''}`}
        onClick={(e) => e.stopPropagation()}
        aria-hidden={isPhotobookExperienceOpen ? true : undefined}
      >
        {!isFlatPage && !isPhotobookExperienceOpen && (
          /* Close Button */
          <button className={styles.closeButton} onClick={closeModal} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {loadingDetails ? (
          isFlatPage ? (
            <>
              <div className={styles.shimmerImage}></div>
              <div className={styles.shimmerDetails}>
                <div className={styles.shimmerTitle}></div>
                <div className={styles.shimmerRating}></div>
                <div className={styles.shimmerPrice}></div>
                <div className={styles.shimmerButtons}>
                  <div className={styles.shimmerButton}></div>
                  <div className={styles.shimmerButton}></div>
                </div>
                <div className={styles.shimmerText}></div>
                <div className={styles.shimmerText}></div>
              </div>
            </>
          ) : (
            <div className={styles.shimmerWrapper}>
              <div className={styles.shimmerImage}></div>
              <div className={styles.shimmerDetails}>
                <div className={styles.shimmerTitle}></div>
                <div className={styles.shimmerRating}></div>
                <div className={styles.shimmerPrice}></div>
                <div className={styles.shimmerButtons}>
                  <div className={styles.shimmerButton}></div>
                  <div className={styles.shimmerButton}></div>
                </div>
                <div className={styles.shimmerText}></div>
                <div className={styles.shimmerText}></div>
              </div>
            </div>
          )
        ) : (
          <div className={isFlatPage ? undefined : styles.modalBody} style={isFlatPage ? { display: 'contents' } : undefined}>
            {/* Left Side - Images */}
            <div className={styles.imageSection} ref={imageSectionRef}>
              {displayProduct.isCustomizable && !isFlatPage ? (
                <div className={`${cardStyles.assuredBadge} ${cardStyles.customizableBadge} ${styles.productCustomizableBadge}`}>
                  <svg className={cardStyles.verifiedIcon} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true">
                    <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                      <g fill="currentColor">
                        <g>
                          <path d="M14.775,1.206 L13.73,4.289 L15.676,6.896 L12.422,6.855 L10.543,9.511 L9.577,6.404 L6.471,5.439 L9.127,3.559 L9.086,0.305 L11.692,2.251 L14.775,1.206 Z"></path>
                          <path d="M1.852,15.533 C1.462,15.924 0.93,16.025 0.664,15.759 L0.258,15.354 C-0.008,15.088 0.094,14.557 0.485,14.166 L10.788,3.863 C11.179,3.472 11.71,3.371 11.976,3.636 L12.382,4.042 C12.648,4.308 12.547,4.839 12.155,5.23 L1.852,15.533 L1.852,15.533 Z"></path>
                          <path d="M13.511,13.949 C13.511,13.949 13.673,12.89 12.901,12.126 C12.128,11.364 11.031,11.5 11.031,11.5 C11.031,11.5 12.297,11.52 12.926,10.897 C13.557,10.274 13.512,9.05 13.512,9.05 C13.512,9.05 13.645,10.4 14.146,10.897 C14.651,11.393 15.993,11.5 15.993,11.5 C15.993,11.5 14.732,11.602 14.174,12.152 C13.614,12.705 13.511,13.949 13.511,13.949 L13.511,13.949 Z"></path>
                          <path d="M8.511,15.949 C8.511,15.949 8.673,14.89 7.901,14.126 C7.128,13.364 6.031,13.5 6.031,13.5 C6.031,13.5 7.297,13.52 7.926,12.897 C8.557,12.274 8.512,11.05 8.512,11.05 C8.512,11.05 8.645,12.4 9.146,12.897 C9.651,13.393 10.993,13.5 10.993,13.5 C10.993,13.5 9.732,13.602 9.174,14.152 C8.614,14.705 8.511,15.949 8.511,15.949 L8.511,15.949 Z"></path>
                          <path d="M3.511,4.949 C3.511,4.949 3.673,3.89 2.901,3.126 C2.128,2.364 1.031,2.5 1.031,2.5 C1.031,2.5 2.297,2.52 2.926,1.897 C3.557,1.274 3.512,0.05 3.512,0.05 C3.512,0.05 3.645,1.4 4.146,1.897 C4.651,2.393 5.993,2.5 5.993,2.5 C5.993,2.5 4.732,2.602 4.174,3.152 C3.614,3.705 3.511,4.949 3.511,4.949 L3.511,4.949 Z"></path>
                        </g>
                      </g>
                    </g>
                  </svg>
                  <span>Customizable</span>
                </div>
              ) : null}
              {/* Image grid: all images in rows of 2 */}
              {collageItems.length > 0 ? (
                <div className={styles.imageGridWrapper}>
                  <div
                    ref={imageGridRef}
                    className={styles.imageGrid}
                    onScroll={(e) => {
                      const target = e.currentTarget;
                      const index = Math.round(target.scrollLeft / target.clientWidth);
                      if (index >= 0 && index < collageItems.length && index !== selectedImageIndex) {
                        setSelectedImageIndex(index);
                      }
                    }}
                  >
                    {collageItems.map((item, idx) => (
                      <div
                        key={idx}
                        className={styles.imageGridItem}
                        onClick={() => {
                          if (!item.startsWith('emoji:')) {
                            setSelectedImageIndex(idx);
                            openImageZoom();
                          }
                        }}
                        style={{ cursor: item.startsWith('emoji:') ? 'default' : 'zoom-in' }}
                      >
                        {item.startsWith('emoji:') ? (
                          <div className={styles.emojiMain} aria-hidden="true">
                            {item.replace('emoji:', '')}
                          </div>
                        ) : (
                          <>
                            <Image
                              src={item}
                              alt={`${product.name} ${idx + 1}`}
                              width={600}
                              height={600}
                              className={styles.gridImage}
                              sizes="(max-width: 640px) 50vw, 280px"
                            />
                            <span className={styles.gridZoomIcon} aria-hidden="true">
                              <svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" fill="#000000" stroke="#000000" strokeWidth="0.00018"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill="#000000" fillRule="evenodd" d="M250,204 L247.503423,204 C247.232903,204 247,204.223858 247,204.5 C247,204.768066 247.22539,205 247.503423,205 L250,205 L250,207.496577 C250,207.767097 250.223858,208 250.5,208 C250.768066,208 251,207.77461 251,207.496577 L251,205 L253.496577,205 C253.767097,205 254,204.776142 254,204.5 C254,204.231934 253.77461,204 253.496577,204 L251,204 L251,201.503423 C251,201.232903 250.776142,201 250.5,201 C250.231934,201 250,201.22539 250,201.503423 L250,204 Z M255.441686,210.141919 C254.121974,211.298772 252.392877,212 250.5,212 C246.357864,212 243,208.642136 243,204.5 C243,200.357864 246.357864,197 250.5,197 C254.642136,197 258,200.357864 258,204.5 C258,206.392877 257.298772,208.121974 256.141919,209.441686 L260.317115,213.616883 C260.508288,213.808056 260.500857,214.12544 260.313149,214.313149 C260.119785,214.506512 259.80289,214.503123 259.616883,214.317115 L255.441686,210.141919 Z M250.5,211 C254.089851,211 257,208.089851 257,204.5 C257,200.910149 254.089851,198 250.5,198 C246.910149,198 244,200.910149 244,204.5 C244,208.089851 246.910149,211 250.5,211 Z" transform="translate(-243 -197)"></path> </g></svg>
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {collageItems.length > 1 && (
                    <div className={styles.imagePaginationDots}>
                      {collageItems.map((_, dotIdx) => (
                        <span
                          key={dotIdx}
                          className={`${styles.paginationDot} ${selectedImageIndex === dotIdx ? styles.paginationDotActive : ''}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.placeholderImage}>
                  <img src="/scribble-logo-bw.png" alt="Scribble Logo" className={styles.placeholderLogo} />
                </div>
              )}
            </div>

            {/* Right Side - Details */}
            <div className={styles.detailsSection} ref={detailsSectionRef}>
              <div className={styles.productOverviewCard}>
              {/* Product Title & Rating */}
              <div className={styles.productHeader}>
                <h1 className={styles.productTitle}>
                  <span>{displayProduct.name}</span>
                  <div className={styles.shareRow}>
                    <button
                      type="button"
                      className={`${styles.favoriteTrigger} ${isFavorite ? styles.favoriteTriggerActive : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isFavorite) {
                          triggerSparkleBurst(e.currentTarget);
                        }
                        handleToggleFavorite();
                      }}
                      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    >
                      <svg
                        className={styles.favoriteTriggerIcon}
                        viewBox="0 0 24 24"
                        fill={isFavorite ? "#ff0155" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                    <div className={styles.shareWrap} ref={shareMenuRef}>
                      <button
                        type="button"
                        className={styles.shareTrigger}
                        aria-expanded={shareMenuOpen}
                        aria-haspopup="menu"
                        aria-label="Share product"
                        onClick={() => setShareMenuOpen((open) => !open)}
                      >
                        <svg
                          className={styles.shareTriggerIcon}
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.8" />
                          <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                          <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.8" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </button>
                      <div className={`${styles.shareMenu} ${shareMenuOpen ? styles.shareMenuOpen : ''}`} role="menu" style={{ right: 0, left: 'auto' }}>
                          <a
                            role="menuitem"
                            className={styles.shareMenuItem}
                            href={`https://wa.me/?text=${encodeURIComponent(`${displayProduct.name}\n${sharePageUrl}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setShareMenuOpen(false)}
                          >
                            <span className={styles.shareMenuItemIcon} aria-hidden>
                              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                              </svg>
                            </span>
                            <span>WhatsApp</span>
                          </a>
                          <a
                            role="menuitem"
                            className={styles.shareMenuItem}
                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(sharePageUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setShareMenuOpen(false)}
                          >
                            <span className={styles.shareMenuItemIcon} aria-hidden>
                              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                              </svg>
                            </span>
                            <span>Facebook</span>
                          </a>
                          <a
                            role="menuitem"
                            className={styles.shareMenuItem}
                            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(sharePageUrl)}&text=${encodeURIComponent(displayProduct.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setShareMenuOpen(false)}
                          >
                            <span className={styles.shareMenuItemIcon} aria-hidden>
                              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                              </svg>
                            </span>
                            <span>X</span>
                          </a>
                          <a
                            role="menuitem"
                            className={styles.shareMenuItem}
                            href={`https://www.reddit.com/submit?url=${encodeURIComponent(sharePageUrl)}&title=${encodeURIComponent(displayProduct.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setShareMenuOpen(false)}
                          >
                            <span className={styles.shareMenuItemIcon} aria-hidden>
                              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.731-1.486l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .688.561 1.25 1.25 1.25.687 0 1.248-.562 1.248-1.25 0-.688-.561-1.25-1.249-1.25zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .688.561 1.25 1.249 1.25.688 0 1.249-.562 1.249-1.25 0-.687-.562-1.25-1.25-1.25zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.115-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.523-.73a.326.326 0 0 0-.232-.095z" />
                              </svg>
                            </span>
                            <span>Reddit</span>
                          </a>
                          <button
                            type="button"
                            role="menuitem"
                            className={styles.shareMenuItem}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(sharePageUrl);
                                showToast('Link copied', 'success');
                              } catch {
                                showToast('Could not copy link', 'error');
                              }
                              setShareMenuOpen(false);
                            }}
                          >
                            <span className={styles.shareMenuItemIcon} aria-hidden>
                              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                                <path
                                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                            <span>Copy link</span>
                          </button>
                        </div>
                      </div>
                  </div>
                </h1>
              </div>

              {/* Product Rating */}
              {reviews.length > 0 && (
                <div
                  className={styles.productRating}
                  role="button"
                  tabIndex={0}
                  onClick={scrollToReviewSummary}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      scrollToReviewSummary();
                    }
                  }}
                  aria-label="View customer reviews"
                >
                  <span className={styles.ratingScore}>{averageRating.toFixed(1)}</span>
                  <svg
                    className={styles.ratingStarIcon}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  <span className={styles.ratingDivider} />
                  <span className={styles.ratingCount}>
                    {(displayProduct.feedbackAggregates?.qualityCount ?? reviews.length).toLocaleString('en-US')}
                  </span>
                </div>
              )}

              {/* Stock Status for mobile (original place inside productOverviewCard) */}
              <div className={styles.stockStatusMobileOnly}>
                {renderStockStatus()}
              </div>

              {/* Price Section */}
              <div className={`${styles.priceSection} ${showRange ? styles.priceRangeMode : styles.priceSingleMode}`}>
                <div className={styles.priceContainer}>
                  <span className={styles.rangePrice}>
                    ₹{Math.round(priceRange.min)} - ₹{Math.round(priceRange.max)}
                  </span>
                  <div className={styles.singlePriceContainer}>
                    <span className={styles.currentPrice}>
                      ₹
                      <span
                        key={priceAnimKey}
                        className={`${styles.tDigitGroup} ${styles.isAnimating}`}
                        style={{ '--digit-dir-y': priceDirY } as React.CSSProperties}
                      >
                        {(animatedPrice !== null ? Math.round(animatedPrice).toString() : Math.round(unitPrice).toString())
                          .split('')
                          .map((char, index) => (
                            <span
                              key={index}
                              className={styles.tDigit}
                              style={{ animationDelay: `${index * 12}ms` }}
                            >
                              {char}
                            </span>
                          ))}
                      </span>
                    </span>
                    {originalUnitPrice && originalUnitPrice > unitPrice ? (
                      <span className={styles.originalPrice}>
                        ₹{Math.round(originalUnitPrice)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Qty + Actions (before description) */}
              <div className={styles.purchaseSection}>
                {productMaxQuantity > 1 && !isTrialMode ? (
                  <div className={styles.qtyRow}>
                    <div className={styles.qtyLabel}>Qty</div>
                    <div className={styles.qtyControl} aria-label="Quantity selector">
                      <button
                        type="button"
                        className={styles.qtyButton}
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        aria-label="Decrease quantity"
                      >
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 12L18 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                        </svg>
                      </button>
                      <input
                        className={styles.qtyInput}
                        value={safeQty}
                        inputMode="numeric"
                        onChange={(e) => {
                          const n = parseInt(e.target.value || '1', 10);
                          setQuantity(Number.isFinite(n) ? n : 1);
                        }}
                        aria-label="Quantity"
                      />
                      <button
                        type="button"
                        className={styles.qtyButton}
                        onClick={() => {
                          if (isProductOutOfStock) return;
                          if (remainingCartCapacity <= 0 || safeQty >= remainingCartCapacity) {
                            showToast(`Maximum order quantity is ${productMaxQuantity}`, 'error');
                            return;
                          }
                          setQuantity((q) => Math.min(productMaxQuantity, q + 1));
                        }}
                        aria-label="Increase quantity"
                        disabled={isAtMaxQuantity || isProductOutOfStock}
                      >
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 12H20M12 4V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Customizations or Variations Picker (managed by admin) */}
                {displayProduct.isCustomizable && displayProduct.customizationOptions && displayProduct.customizationOptions.length > 0 ? (
                  <div className={styles.customizationContainer}>
                    {displayProduct.customizationOptions.map((group, idx) => {
                      if (group.type === 'uploads') {
                        if (!isUploadsVariationActive(group)) return null;

                        const groupEnabled = isGroupEnabled(idx);

                        return (
                          <div
                            key={group.id}
                            className={`${styles.customizationGroup} ${!groupEnabled ? styles.customizationGroupLocked : ''} ${isGroupRevealing(group.id, groupEnabled) ? styles.customizationGroupRevealing : ''}`}
                          >
                            <div className={styles.groupHeader}>
                              <span className={styles.groupTitle}>{group.title}</span>
                              <span className={styles.groupHeaderSeparator}>:</span>
                              {(() => {
                                const uploadText = printUploadCompleted
                                  ? `${uploadedPrintItems.length} Images Uploaded`
                                  : 'Choose images to upload';
                                return (
                                  <span
                                    key={uploadText}
                                    className={`${styles.selectedValueText} ${styles.tDigitGroup} ${styles.isAnimating}`}
                                    style={
                                      {
                                        '--digit-dir-y': 1,
                                        '--digit-distance': '5px',
                                        '--digit-blur': '2.5px',
                                        '--digit-dur': '160ms',
                                      } as React.CSSProperties
                                    }
                                  >
                                    {uploadText.split('').map((char, index) => (
                                      <span
                                        key={index}
                                        className={styles.tDigit}
                                        style={{ animationDelay: `${index * 12}ms` }}
                                      >
                                        {char === ' ' ? '\u00A0' : char}
                                      </span>
                                    ))}
                                  </span>
                                );
                              })()}
                            </div>
                            <div className={styles.uploadsVariationContent}>
                              {!isTrialMode ? (
                                <button
                                  type="button"
                                  className={`${styles.uploadImagesButton} ${printUploadCompleted ? styles.uploadImagesButtonEdit : ''} ${styles.customizationOptionItem}`}
                                  style={getCustomizationOptionRevealStyle(group.id, groupEnabled, 0)}
                                  disabled={!groupEnabled}
                                  onClick={() => setIsPrintUploadOpen(true)}
                                >
                                  {printUploadCompleted ? (
                                    <EditUploadedImagesButtonIcon className={styles.uploadImagesButtonIcon} />
                                  ) : (
                                    <UploadImagesButtonIcon className={styles.uploadImagesButtonIcon} />
                                  )}
                                  <span>{printUploadCompleted ? 'Edit uploaded Images' : 'Upload Images'}</span>
                                </button>
                              ) : null}
                              <p className={styles.uploadsVariationHint}>
                                {getUploadsVariationHint(
                                  group,
                                  Boolean(group.polaroidUploadEnabled),
                                  Boolean(group.stripUploadEnabled),
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      }

                      if (!group.values || group.values.length === 0) return null;
                      const groupEnabled = isGroupEnabled(idx);

                      return (
                        <div
                          key={group.id}
                          className={`${styles.customizationGroup} ${!groupEnabled ? styles.customizationGroupLocked : ''} ${isGroupRevealing(group.id, groupEnabled) ? styles.customizationGroupRevealing : ''}`}
                        >
                          <div className={styles.groupHeader}>
                            <span className={styles.groupTitle}>{group.title}</span>
                            {group.type !== 'text_input' && (
                              <>
                                <span className={styles.groupHeaderSeparator}>:</span>
                                {(() => {
                                  const selectedValId = selectedCustomizations[group.id];
                                  const selectedVal = group.values.find(v => v.id === selectedValId);
                                  const textValue = selectedVal ? removePriceFromName(selectedVal.name) : 'Choose an option';
                                  return (
                                    <span
                                      key={textValue}
                                      className={`${styles.selectedValueText} ${styles.tDigitGroup} ${styles.isAnimating}`}
                                      style={
                                        {
                                          '--digit-dir-y': 1,
                                          '--digit-distance': '5px',
                                          '--digit-blur': '2.5px',
                                          '--digit-dur': '160ms',
                                        } as React.CSSProperties
                                      }
                                    >
                                      {textValue.split('').map((char, index) => (
                                        <span
                                          key={index}
                                          className={styles.tDigit}
                                          style={{ animationDelay: `${index * 12}ms` }}
                                        >
                                          {char === ' ' ? '\u00A0' : char}
                                        </span>
                                      ))}
                                    </span>
                                  );
                                })()}
                              </>
                            )}
                          </div>

                          {/* 1. Colour Palette */}
                          {group.type === 'colour_palette' && (
                            <div className={styles.colorSelectorPalette}>
                              {group.values.map((v, optionIdx) => {
                                const isActive = selectedCustomizations[group.id] === v.id;
                                const isValDisabled = !v.isActive || !groupEnabled;
                                return (
                                  <button
                                    key={v.id}
                                    type="button"
                                    className={`${styles.colorSwatchWrapper} ${isActive ? styles.colorSwatchActive : ''} ${isValDisabled ? styles.disabled : ''} ${styles.customizationOptionItem}`}
                                    style={getCustomizationOptionRevealStyle(group.id, groupEnabled, optionIdx)}
                                    disabled={isValDisabled}
                                    onClick={() => setSelectedCustomizations(prev => ({ ...prev, [group.id]: v.id }))}
                                    title={removePriceFromName(v.name)}
                                  >
                                    <span
                                      className={styles.colorSwatch}
                                      style={{ backgroundColor: v.hexCode || '#000' }}
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* 2. Image Selector */}
                          {group.type === 'image_selector' && (
                            <div className={styles.imageSelectorGrid}>
                              {group.values.map((v, optionIdx) => {
                                const isActive = selectedCustomizations[group.id] === v.id;
                                const isValDisabled = !v.isActive || !groupEnabled;
                                return (
                                  <div
                                    key={v.id}
                                    className={`${styles.imageSelectorCard} ${isActive ? styles.imageSelectorCardActive : ''} ${isValDisabled ? styles.disabled : ''} ${styles.customizationOptionItem}`}
                                    style={getCustomizationOptionRevealStyle(group.id, groupEnabled, optionIdx)}
                                    onClick={() => {
                                      if (!isValDisabled) {
                                        setSelectedCustomizations(prev => ({ ...prev, [group.id]: v.id }));
                                      }
                                    }}
                                    title={removePriceFromName(v.name)}
                                  >
                                    {v.imageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={v.imageUrl} alt={v.name} className={styles.imageSelectorThumbnail} />
                                    ) : (
                                      <div className={styles.imageSelectorThumbnail} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                                      </div>
                                    )}
                                    <span className={styles.imageSelectorLabel}>
                                      {removePriceFromName(v.name)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* 3. Option Buttons */}
                          {group.type === 'option_buttons' && (
                            <div className={styles.buttonSelectorGrid}>
                              {group.values.map((v, optionIdx) => {
                                const isActive = selectedCustomizations[group.id] === v.id;
                                const isValDisabled = !v.isActive || !groupEnabled;
                                return (
                                  <button
                                    key={v.id}
                                    type="button"
                                    className={`${styles.buttonOption} ${isActive ? styles.buttonOptionActive : ''} ${styles.customizationOptionItem}`}
                                    style={getCustomizationOptionRevealStyle(group.id, groupEnabled, optionIdx)}
                                    disabled={isValDisabled}
                                    onClick={() => setSelectedCustomizations(prev => ({ ...prev, [group.id]: v.id }))}
                                  >
                                    {removePriceFromName(v.name)}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* 4. Text Input Personalization */}
                          {group.type === 'text_input' && (
                            <div className={styles.textPersonalizationGroup}>
                              {group.values.map((v, optionIdx) => {
                                const inputKey = `${group.id}_${v.id}`;
                                const currentText = textPersonalizations[inputKey] || '';
                                const isDone = !!textPersonalizationDone[inputKey];
                                const isOverLimit = currentText.length > (v.charLimit || 100);
                                const canMarkDone = groupEnabled && !isOverLimit && currentText.trim().length > 0 && !isDone;
                                return (
                                  <div
                                    key={v.id}
                                    className={`${styles.textInputWrapper} ${styles.customizationOptionItem}`}
                                    style={getCustomizationOptionRevealStyle(group.id, groupEnabled, optionIdx)}
                                  >
                                    <div className={styles.textPersonalizationLabel}>
                                      <span>
                                        {v.label || 'Personalization Text'}
                                      </span>
                                      <span className={`${styles.charCounter} ${isOverLimit ? styles.charCounterMax : ''}`}>
                                        {currentText.length}/{v.charLimit || 100}
                                      </span>
                                    </div>
                                    <div className={styles.textInputContainer}>
                                      <input
                                        type="text"
                                        className={`${styles.textPersonalizationInput} ${isOverLimit ? styles.textPersonalizationInputError : ''}`}
                                        placeholder={v.placeholder || `Max ${v.charLimit || 100} characters`}
                                        value={currentText}
                                        maxLength={v.charLimit || 100}
                                        disabled={!groupEnabled}
                                        onChange={(e) => {
                                          setTextPersonalizations(prev => ({
                                            ...prev,
                                            [inputKey]: e.target.value
                                          }));
                                          setTextPersonalizationDone(prev => (
                                            prev[inputKey]
                                              ? { ...prev, [inputKey]: false }
                                              : prev
                                          ));
                                        }}
                                      />
                                      <button
                                        type="button"
                                        className={`${styles.textPersonalizationDoneButton} ${isDone ? styles.textPersonalizationDoneButtonDone : ''}`}
                                        disabled={!canMarkDone}
                                        onClick={() => {
                                          if (!canMarkDone) return;
                                          setTextPersonalizationDone(prev => ({ ...prev, [inputKey]: true }));
                                        }}
                                      >
                                        Done
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  variations.length > 0 && (
                    <div className={styles.variationPicker}>
                      <div className={styles.variationRow}>
                        <div className={styles.variationLabel}>Size</div>
                        <div className={styles.variationsGrid}>
                          {variations.map((variation) => {
                            const price = displayProduct.pricePerLitre * variation.priceMultiplier;
                            const isActive = variation.id === selectedVariationId;
                            return (
                              <button
                                key={variation.id}
                                type="button"
                                className={`${styles.variationButton} ${isActive ? styles.variationActive : ''} ${variation.isAvailable ? '' : styles.variationDisabled}`}
                                disabled={!variation.isAvailable}
                                onClick={() => setSelectedVariationId(variation.id)}
                                title={!variation.isAvailable ? 'Not available' : `${removePriceFromName(variation.size)} - ₹${Math.round(price)}`}
                              >
                                {removePriceFromName(variation.size)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )
                )}

                {/* Your Amount Section */}
                {productMaxQuantity > 1 && (
                  <div className={styles.amountSection}>
                    <div className={styles.amountLabel}>Your amount</div>
                    <div className={styles.amountRow}>
                      <span className={styles.amountValue}>₹{Math.round(unitPrice * safeQty)}</span>
                      {safeQty > 0 && (
                        <span className={styles.amountSavings}>
                          {originalUnitPrice !== null && unitOff > 0
                            ? `You will save ₹${Math.round(unitOff * safeQty)}`
                            : ''}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {printUploadEnabled && !showUploadsInVariations && !isTrialMode ? (
                  <button
                    type="button"
                    className={`${styles.uploadImagesButton} ${printUploadCompleted ? styles.uploadImagesButtonEdit : ''}`}
                    onClick={() => setIsPrintUploadOpen(true)}
                  >
                    {printUploadCompleted ? (
                      <EditUploadedImagesButtonIcon className={styles.uploadImagesButtonIcon} />
                    ) : (
                      <UploadImagesButtonIcon className={styles.uploadImagesButtonIcon} />
                    )}
                    <span>{printUploadCompleted ? 'Edit uploaded Images' : 'Upload Images'}</span>
                  </button>
                ) : null}

                {((photoboothLinks && (
                  String(displayProduct.id) === String(photoboothLinks.polaroidsPromoProductId) ||
                  String(displayProduct.id) === String(photoboothLinks.photostripsPromoProductId)
                )) || (!photoboothLinks && String(displayProduct.id) === '2')) && (
                  <div className={styles.photoboothPromoCard}>
                    {/* Text content */}
                    <div className={styles.photoboothPromoTextWrap}>
                      <div className={styles.photoboothPromoSubtitle}>
                        #Photobooth
                      </div>
                      <div className={styles.photoboothPromoTitle}>
                        Snap your photos<br />like never before
                      </div>
                    </div>

                    {/* Button */}
                    <div className={styles.photoboothPromoBtnWrap}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isFlatPage) {
                            closeModal();
                          }
                          router.push('/photobooth');
                        }}
                        className={styles.photoboothPromoButton}
                      >
                        Shoot now
                      </button>
                    </div>

                    {/* Dynamic Polaroid Cards fanning out (mimicking the uploaded design image) */}
                    <div className={styles.photoboothPromoPolaroids}>
                      {/* Photo 1 (Back-left) */}
                      <div className={`${styles.photoboothPromoPhoto} ${styles.photoboothPromoPhoto1}`}>
                        <img src="https://plus.unsplash.com/premium_photo-1749072780947-44707684157f?q=80&w=387&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="" className={styles.photoboothPromoPhotoImage} />
                      </div>

                      {/* Photo 2 (Left-behind) */}
                      <div className={`${styles.photoboothPromoPhoto} ${styles.photoboothPromoPhoto2}`}>
                        <img src="https://images.unsplash.com/photo-1732194982181-436455c519e4?q=80&w=390&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="" className={styles.photoboothPromoPhotoImage} />
                      </div>

                      {/* Photo 3 (Right-behind) */}
                      <div className={`${styles.photoboothPromoPhoto} ${styles.photoboothPromoPhoto3}`}>
                        <img src="https://images.unsplash.com/photo-1756877881645-3459175e209a?q=80&w=413&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="" className={styles.photoboothPromoPhotoImage} />
                      </div>

                      {/* Photo 4 (Front-center) */}
                      <div className={`${styles.photoboothPromoPhoto} ${styles.photoboothPromoPhoto4}`}>
                        <img src="https://images.unsplash.com/photo-1651213005962-fcfdb7898905?q=80&w=738&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="" className={styles.photoboothPromoPhotoImage} />
                      </div>
                    </div>

                    {/* Gradient Overlay above the polaroids but below the text and button */}
                    <div className={styles.photoboothPromoOverlay} />
                  </div>
                )}

                <div className={styles.actionButtons}>
                  {displayProduct.photobookEditorEnabled ? (
                    <div className={styles.pbStartCreatingActions}>
                      <button
                        type="button"
                        className={styles.pbStartCreatingButton}
                        onMouseEnter={handlePbMouseEnter}
                        onMouseMove={handlePbMouseMove}
                        onClick={handlePbClick}
                        disabled={!isAnyOptionSelected}
                      >
                        <span className={styles.pbButtonText}>Start Designing</span>
                        <canvas ref={pbCanvasRef} className={styles.pbButtonCanvas} />
                      </button>
                      {showPbEditSavedDesignsButton ? (
                        <>
                          <span className={styles.pbStartCreatingOr} aria-hidden="true">OR</span>
                          <button
                            type="button"
                            className={styles.pbEditSavedDesignsButton}
                            onClick={() => {
                              if (!isFlatPage) {
                                closeModal();
                              }
                              router.push('/saved-designs');
                            }}
                          >
                            Edit from saved designs
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : isTrialMode ? (
                    <button
                      type="button"
                      className={`${styles.buyNowButton} ${isTrialMode ? styles.trialModeButton : ''}`}
                      disabled={isProductOutOfStock}
                      onClick={() => {
                        if (isProductOutOfStock) {
                          showToast('Out of stock', 'error');
                          return;
                        }
                        onAddTrialProduct?.({
                          product: displayProduct,
                          variation: selectedVariation ?? null,
                        });
                        closeModal();
                      }}
                      style={{
                        opacity: isProductOutOfStock ? 0.5 : 1,
                        cursor: isProductOutOfStock ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Add for the trial pack
                    </button>
                  ) : (
                    <>
                      <button
                        ref={addToCartButtonRef}
                        type="button"
                        className={styles.addToCartButton}
                        disabled={
                          isProductOutOfStock ||
                          (pincode.length > 0 && (pincode.length !== 6 || isPincodeAvailable === false)) ||
                          remainingCartCapacity <= 0 ||
                          requiresCustomizationCompletion
                        }
                        onClick={async () => {
                          if (isProductOutOfStock) {
                            showToast('Out of stock', 'error');
                            return;
                          }
                          if (requiresCustomizationCompletion) {
                            showToast('Please complete all variation options before adding to cart.', 'error');
                            return;
                          }
                          if (remainingCartCapacity <= 0) {
                            showToast(`Maximum order quantity is ${productMaxQuantity}`, 'error');
                            return;
                          }

                          let photoboothProjectData = undefined;
                          if (printUploadCompleted && uploadedPrintItems.length > 0) {
                            setIsUploadingPrints(true);
                            try {
                              const { project, cartPreviewUrl } = await executePrintModalUpload(
                                uploadedPrintItems,
                                uploadedPrintMode,
                                (progress) => setPrintUploadProgress(progress)
                              );
                              photoboothProjectData = {
                                projectId: project.id,
                                projectType: uploadedPrintMode,
                                previewUrl: cartPreviewUrl,
                                polaroidCount: uploadedPrintItems.length,
                                price: 0,
                                label: `${uploadedPrintItems.length} custom print(s)`,
                              };
                            } catch (err) {
                              console.error(err);
                              showToast('Failed to process prints. Please try again.', 'error');
                              setIsUploadingPrints(false);
                              setPrintUploadProgress(null);
                              return;
                            }
                            setIsUploadingPrints(false);
                            setPrintUploadProgress(null);
                          }

                          const result = addItem({
                            productId: displayProduct.id,
                            variationId: selectedVariation?.id ?? undefined,
                            quantity: safeQty,
                            customizations: {
                              ...selectedCustomizations,
                              ...(photoboothProjectData ? { photoboothProject: photoboothProjectData } : {})
                            }
                          }, productMaxQuantity);

                          if (result.appliedQuantity <= 0) {
                            showToast(`Maximum order quantity is ${productMaxQuantity}`, 'error');
                            return;
                          }

                          showToast(
                            result.ok ? 'Added to cart' : `Only ${productMaxQuantity} units allowed for this product`,
                            result.ok ? 'success' : 'error',
                          );

                          if (photoboothProjectData) {
                            closeModal();
                            window.location.href = '/cart';
                            return;
                          }

                          const imageUrl = productImages.length > 0 && !productImages[0].startsWith('emoji:')
                            ? productImages[0]
                            : displayProduct.imageUrl || '';

                          const sourceElement = addToCartButtonRef.current;
                          const targetElement = cartIconRefStore.getAny();

                          if (sourceElement && targetElement && imageUrl) {
                            animateToCart({
                              imageUrl,
                              sourceElement,
                              targetElement,
                            });
                          }
                        }}
                      >
                        Add to Cart
                      </button>
                      {displayProduct.buyNowEnabled !== false ? (
                        <button
                          type="button"
                          className={styles.buyNowButton}
                          onClick={async () => {
                            if (isProductOutOfStock) {
                              showToast('Out of stock', 'error');
                              return;
                            }
                            if (requiresCustomizationCompletion) {
                              showToast('Please complete all variation options before buying.', 'error');
                              return;
                            }
                            if (remainingCartCapacity <= 0) {
                              showToast(`Maximum order quantity is ${productMaxQuantity}`, 'error');
                              return;
                            }

                            let photoboothProjectData = undefined;
                            if (printUploadCompleted && uploadedPrintItems.length > 0) {
                              setIsUploadingPrints(true);
                              try {
                                const { project, cartPreviewUrl } = await executePrintModalUpload(
                                  uploadedPrintItems,
                                  uploadedPrintMode,
                                  (progress) => setPrintUploadProgress(progress)
                                );
                                photoboothProjectData = {
                                  projectId: project.id,
                                  projectType: uploadedPrintMode,
                                  previewUrl: cartPreviewUrl,
                                  polaroidCount: uploadedPrintItems.length,
                                  price: 0,
                                  label: `${uploadedPrintItems.length} custom print(s)`,
                                };
                              } catch (err) {
                                console.error(err);
                                showToast('Failed to process prints. Please try again.', 'error');
                                setIsUploadingPrints(false);
                                setPrintUploadProgress(null);
                                return;
                              }
                              setIsUploadingPrints(false);
                              setPrintUploadProgress(null);
                            }

                            const result = addItem({
                              productId: displayProduct.id,
                              quantity: safeQty,
                              variationId: selectedVariationId ?? undefined,
                              customizations: {
                                ...selectedCustomizations,
                                ...(photoboothProjectData ? { photoboothProject: photoboothProjectData } : {})
                              }
                            }, productMaxQuantity);
                            if (result.appliedQuantity <= 0) {
                              showToast(`Maximum order quantity is ${productMaxQuantity}`, 'error');
                              return;
                            }
                            if (!result.ok) {
                              showToast(`Only ${productMaxQuantity} units allowed for this product`, 'error');
                            }
                            closeModal();
                            window.location.href = '/cart';
                          }}
                          style={{
                            opacity: (!isProductOutOfStock && pincode.length === 6 && isPincodeAvailable === true && remainingCartCapacity > 0 && !requiresCustomizationCompletion) ? 1 : 0.5,
                            cursor: (!isProductOutOfStock && pincode.length === 6 && isPincodeAvailable === true && remainingCartCapacity > 0 && !requiresCustomizationCompletion) ? 'pointer' : 'not-allowed',
                            pointerEvents: (!isProductOutOfStock && pincode.length === 6 && isPincodeAvailable === true && remainingCartCapacity > 0 && !requiresCustomizationCompletion) ? 'auto' : 'none',
                          }}
                          disabled={isProductOutOfStock || remainingCartCapacity <= 0 || requiresCustomizationCompletion}
                        >
                          <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                            <g id="SVGRepo_iconCarrier">
                              <path id="primary" d="M18,11.74a1,1,0,0,0-.52-.63L14.09,9.43,15,3.14a1,1,0,0,0-1.78-.75l-7,9a1,1,0,0,0-.18.87,1.05,1.05,0,0,0,.6.67l4.27,1.71L10,20.86a1,1,0,0,0,.63,1.07A.92.92,0,0,0,11,22a1,1,0,0,0,.83-.45l6-9A1,1,0,0,0,18,11.74Z"></path>
                            </g>
                          </svg>
                          Buy Now
                        </button>
                      ) : null}
                    </>
                  )}
                </div>

                {/* Delivery availability hyperlink - shown below action buttons */}
                {!isTrialMode && (
                  <>
                    <button
                      type="button"
                      className={`${styles.deliveryCheckLink} ${pincode.length === 6 && isPincodeAvailable === true ? styles.deliveryCheckLinkSuccess : ''}`}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('milko:open-pincode-modal'));
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor" />
                      </svg>
                      {isPincodeAvailable === true && pincode.length === 6
                        ? `Delivery available to your location ${pincode}`
                        : isPincodeAvailable === false && pincode.length === 6
                          ? `Delivery unavailable to your location ${pincode}`
                          : 'Check delivery availability & estimated arrival'}
                    </button>

                    {pincode.length === 6 &&
                      isPincodeAvailable === true &&
                      displayProduct.isCustomizable &&
                      displayProduct.deliveryTimeText ? (
                      <div className={styles.deliveryEstimatedText}>
                        Handmade/Customized products take {displayProduct.deliveryTimeText} to deliver.
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            {/* Stock Status Card below productOverviewCard for desktop */}
            <div className={`${styles.stockStatusCard} ${styles.stockStatusDesktopOnly}`}>
              {renderStockStatus()}
            </div>

              {/* Membership Subscription Section - Only show if product is membership eligible */}
              {displayProduct.isMembershipEligible && (
                <div className={styles.membershipSection}>
                  <div className={styles.membershipHeader}>
                    <div>
                      <div className={styles.membershipTitleRow}>
                        <h3 className={styles.membershipTitle}>Take a membership of this</h3>
                        <svg
                          className={styles.membershipTitleIcon}
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M7.45284 2.71266C7.8276 1.76244 9.1724 1.76245 9.54716 2.71267L10.7085 5.65732C10.8229 5.94743 11.0526 6.17707 11.3427 6.29148L14.2873 7.45284C15.2376 7.8276 15.2376 9.1724 14.2873 9.54716L11.3427 10.7085C11.0526 10.8229 10.8229 11.0526 10.7085 11.3427L9.54716 14.2873C9.1724 15.2376 7.8276 15.2376 7.45284 14.2873L6.29148 11.3427C6.17707 11.0526 5.94743 10.8229 5.65732 10.7085L2.71266 9.54716C1.76244 9.1724 1.76245 7.8276 2.71267 7.45284L5.65732 6.29148C5.94743 6.17707 6.17707 5.94743 6.29148 5.65732L7.45284 2.71266Z"
                            fill="#008037"
                          />
                          <path
                            d="M16.9245 13.3916C17.1305 12.8695 17.8695 12.8695 18.0755 13.3916L18.9761 15.6753C19.039 15.8348 19.1652 15.961 19.3247 16.0239L21.6084 16.9245C22.1305 17.1305 22.1305 17.8695 21.6084 18.0755L19.3247 18.9761C19.1652 19.039 19.039 19.1652 18.9761 19.3247L18.0755 21.6084C17.8695 22.1305 17.1305 22.1305 16.9245 21.6084L16.0239 19.3247C15.961 19.1652 15.8348 19.039 15.6753 18.9761L13.3916 18.0755C12.8695 17.8695 12.8695 17.1305 13.3916 16.9245L15.6753 16.0239C15.8348 15.961 15.961 15.8348 16.0239 15.6753L16.9245 13.3916Z"
                            fill="#008037"
                          />
                        </svg>
                      </div>
                      <p className={styles.membershipDescription}>
                        Get {displayProduct.name} — carefully handled and quality-checked before every order, with assured supply for members.
                      </p>
                    </div>
                  </div>

                  <div className={styles.membershipForm}>
                    <div className={styles.membershipSentence}>
                      Take{' '}
                      {(() => {
                        // Determine the currently displayed label for the variation/quantity select
                        let varLabel: string;
                        if (availableVariations.length > 0) {
                          varLabel = availableVariations.find((v) => v.id === (selectedVariationId || ''))?.size
                            ?? availableVariations[0]?.size
                            ?? '';
                        } else {
                          const qtyMap: Record<string, string> = {
                            '0.5': '0.5 Liters', '1': '1 Liter', '2': '2 Liters',
                            '3': '3 Liters', '4': '4 Liters', '5': '5 Liters',
                          };
                          varLabel = qtyMap[membershipQuantity] ?? membershipQuantity;
                        }
                        return (
                          <select
                            value={availableVariations.length > 0 ? (selectedVariationId || '') : membershipQuantity}
                            onChange={(e) => {
                              if (availableVariations.length > 0) {
                                setSelectedVariationId(e.target.value);
                              } else {
                                setMembershipQuantity(e.target.value);
                              }
                            }}
                            className={styles.inlineSelect}
                            style={{ width: measureSelectWidth(varLabel) }}
                          >
                            {availableVariations.length > 0 ? (
                              availableVariations.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.size}
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="0.5">0.5 Liters</option>
                                <option value="1">1 Liter</option>
                                <option value="2">2 Liters</option>
                                <option value="3">3 Liters</option>
                                <option value="4">4 Liters</option>
                                <option value="5">5 Liters</option>
                              </>
                            )}
                          </select>
                        );
                      })()}{' '}
                      of <span className={styles.inlineProductName}>{displayProduct.name}</span> for{' '}
                      {(() => {
                        const freqLabelMap: Record<string, string> = {
                          daily: 'daily',
                          alternate: 'alternate days',
                          weekly: 'once a week',
                          monthly: 'once a month',
                        };
                        const freqLabel = freqLabelMap[membershipFrequency] ?? membershipFrequency;
                        return (
                          <select
                            value={membershipFrequency}
                            onChange={(e) => setMembershipFrequency(e.target.value as any)}
                            className={styles.inlineSelect}
                            style={{ width: measureSelectWidth(freqLabel) }}
                          >
                            <option value="daily">daily</option>
                            <option value="alternate">alternate days</option>
                            <option value="weekly">once a week</option>
                            <option value="monthly">once a month</option>
                          </select>
                        );
                      })()}{' '}
                      for{' '}
                      {(() => {
                        const durLabelMap: Record<string, string> = {
                          '7': '7 Days',
                          '15': '15 Days',
                          '30': '1 Month',
                          '60': '2 Months',
                          '90': '3 Months',
                          '180': '6 Months',
                          '365': '1 Year',
                        };
                        const durLabel = durLabelMap[membershipDuration] ?? `${membershipDuration} Days`;
                        return (
                          <select
                            value={membershipDuration}
                            onChange={(e) => setMembershipDuration(e.target.value)}
                            className={styles.inlineSelect}
                            style={{ width: measureSelectWidth(durLabel) }}
                          >
                            <option value="7">7 Days</option>
                            <option value="15">15 Days</option>
                            <option value="30">1 Month</option>
                            <option value="60">2 Months</option>
                            <option value="90">3 Months</option>
                            <option value="180">6 Months</option>
                            <option value="365">1 Year</option>
                          </select>
                        );
                      })()}
                    </div>

                    {/* Subscribe Now Button and Amount Calculation */}
                    {(() => {
                      const isVariationMode = availableVariations.length > 0;
                      const basePrice = (displayProduct.sellingPrice !== null && displayProduct.sellingPrice !== undefined)
                        ? displayProduct.sellingPrice
                        : displayProduct.pricePerLitre;

                      const durationDays = parseFloat(membershipDuration);

                      const variationPrice = isVariationMode
                        ? (selectedVariation?.price ?? (basePrice * (selectedVariation?.priceMultiplier ?? 1)))
                        : basePrice;

                      const quantityPerDelivery = isVariationMode ? 1 : parseFloat(membershipQuantity);

                      let deliveryCount = durationDays;
                      if (membershipFrequency === 'alternate') {
                        deliveryCount = Math.floor((durationDays - 1) / 2) + 1;
                      } else if (membershipFrequency === 'weekly') {
                        deliveryCount = Math.floor((durationDays - 1) / 7) + 1;
                      } else if (membershipFrequency === 'monthly') {
                        deliveryCount = Math.floor((durationDays - 1) / 30) + 1;
                      }
                      deliveryCount = Math.max(1, deliveryCount);

                      const totalAmount = variationPrice * quantityPerDelivery * deliveryCount;

                      const variationParam = selectedVariationId ? `&variationId=${selectedVariationId}` : '';
                      const litersParam = isVariationMode ? '1' : membershipQuantity;

                      return (
                        <Link
                          href={pincode.length === 6 && isPincodeAvailable === true
                            ? `/subscribe?productId=${displayProduct.id}&liters=${litersParam}&days=${membershipDuration}&months=${Math.ceil(parseInt(membershipDuration) / 30)}&frequency=${membershipFrequency}${variationParam}`
                            : '#'}
                          className={styles.membershipSubscribeButton}
                          onClick={(e) => {
                            if (pincode.length !== 6) {
                              e.preventDefault();
                              window.dispatchEvent(new CustomEvent('milko:open-pincode-modal'));
                              return;
                            }
                            if (isPincodeAvailable !== true) {
                              e.preventDefault();
                              return;
                            }
                            closeModal();
                          }}
                          style={{
                            opacity: (pincode.length === 6 && isPincodeAvailable === true) ? 1 : 0.5,
                            cursor: (pincode.length === 6 && isPincodeAvailable === true) ? 'pointer' : 'not-allowed',
                            pointerEvents: 'auto',
                          }}
                        >
                          Join for ₹{Math.round(totalAmount)}
                        </Link>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* SVG Filter for Accordion Liquid Effect */}
              <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none', opacity: 0 }}>
                <defs>
                  <filter id="accordionLiquidFilter" x="-20%" y="-20%" width="140%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.035 0.055" numOctaves="2" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" id="accordionLiquidDisp" />
                  </filter>
                </defs>
              </svg>

              {/* Description & Collapsible Dynamic Accordions */}
              <div className={styles.descriptionSection}>
                {displayProduct.accordionItems && displayProduct.accordionItems.length > 0 ? (
                  <div className={styles.accordionContainer}>
                    {displayProduct.accordionItems.map((item, index) => {
                      const isExpanded = !!expandedAccordions[index];
                      return (
                        <div key={index} className={styles.accordionItem}>
                          <button
                            type="button"
                            className={styles.accordionHeader}
                            onClick={(e) => {
                              const itemEl = e.currentTarget.parentElement;
                              if (itemEl) {
                                const dispMap = document.getElementById('accordionLiquidDisp');
                                gsap.killTweensOf(itemEl);
                                if (dispMap) gsap.killTweensOf(dispMap);

                                gsap.set(itemEl, { filter: 'url(#accordionLiquidFilter)' });

                                const tl = gsap.timeline({
                                  onComplete: () => {
                                    gsap.set(itemEl, { filter: 'none' });
                                  },
                                });

                                tl.to(itemEl, {
                                  scaleX: 1.02,
                                  scaleY: 1.02,
                                  borderRadius: '28px 20px 26px 22px',
                                  duration: 0.1,
                                  ease: 'power2.out',
                                });

                                if (dispMap) {
                                  tl.to(dispMap, {
                                    attr: { scale: 12 },
                                    duration: 0.1,
                                    ease: 'power2.out',
                                  }, 0);
                                }

                                tl.to(itemEl, {
                                  scaleX: 0.99,
                                  scaleY: 0.99,
                                  borderRadius: '22px 26px 20px 28px',
                                  duration: 0.08,
                                  ease: 'sine.inOut',
                                });

                                if (dispMap) {
                                  tl.to(dispMap, {
                                    attr: { scale: 4 },
                                    duration: 0.08,
                                    ease: 'sine.inOut',
                                  }, '-=0.08');
                                }

                                tl.to(itemEl, {
                                  scaleX: 1,
                                  scaleY: 1,
                                  borderRadius: '24px',
                                  duration: 0.18,
                                  ease: 'power2.out',
                                  clearProps: 'transform,borderRadius,filter',
                                });

                                if (dispMap) {
                                  tl.to(dispMap, {
                                    attr: { scale: 0 },
                                    duration: 0.18,
                                    ease: 'power2.out',
                                  }, '-=0.18');
                                }
                              }
                              toggleAccordion(index);
                            }}
                          >
                            <span className={styles.accordionTitle}>{item.title}</span>
                            <svg
                              className={`${styles.accordionChevron} ${isExpanded ? styles.accordionChevronOpen : ''}`}
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M19 9l-7 7-7-7"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <div className={`${styles.accordionContentWrapper} ${isExpanded ? styles.accordionContentWrapperOpen : ''}`}>
                            <div
                              className={styles.accordionContent}
                              dangerouslySetInnerHTML={{ __html: toSafeHtml(item.htmlContent || '') }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <h3 className={styles.descriptionHeading}>Description</h3>
                    <div
                      className={styles.descriptionText}
                      dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                    />
                  </>
                )}
              </div>

              {/* Review Summary Section - New Layout */}
              <div ref={reviewSummaryRef} className={styles.reviewSummarySection}>
                <h3 className={styles.sectionTitle}>Customer Reviews</h3>
                {/* Top: 50-50 Split Section */}
                <div className={styles.reviewSummaryContent}>
                  {/* Left: Rating Number with Star and Count */}
                  <div className={styles.reviewSummaryLeft}>
                    <div className={styles.ratingCardNumberRow}>
                      {(() => {
                        const rating = qualityRating ?? 0;
                        // Color based on rating: dull gray for 0, dark green for 4-5, orange for 3, red for 1-2
                        let ratingColor = '#dc2626'; // red for low ratings
                        if (rating === 0) {
                          ratingColor = '#9ca3af'; // dull light gray for no ratings
                        } else if (rating >= 4) {
                          ratingColor = '#10b981'; // dark green for high ratings
                        } else if (rating >= 3) {
                          ratingColor = '#ea580c'; // orange for medium ratings
                        }

                        return (
                          <>
                            <span
                              className={styles.ratingCardNumber}
                              style={{ color: ratingColor }}
                            >
                              {animatedRating.toFixed(1)}
                            </span>
                            <svg
                              className={styles.ratingCardStar}
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                              style={{ color: ratingColor }}
                            >
                              <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557L3.04 10.385a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z" />
                            </svg>
                          </>
                        );
                      })()}
                    </div>
                    <div className={styles.ratingCardCount}>
                      Based on {feedback?.qualityCount ?? 0} review{feedback?.qualityCount !== 1 ? 's' : ''}
                    </div>
                    <button
                      className={styles.showMoreButton}
                      onClick={() => setShowRatingDetailsPopup(true)}
                      aria-expanded={showRatingDetailsPopup}
                    >
                      Show more
                    </button>
                  </div>

                  {/* Right: Rating Distribution Progress Bars */}
                  <div className={styles.reviewSummaryRightTop}>
                    <div className={styles.ratingDistribution}>
                      {[5, 4, 3, 2, 1].map((starLevel, barIndex) => {
                        const count = feedback?.ratingDistribution?.[starLevel as keyof typeof feedback.ratingDistribution] ?? 0;
                        const total = feedback?.qualityCount || 1;
                        const percentage = total > 0 ? (count / total) * 100 : 0;

                        // Color based on rating: green for 5-4, orange for 3-2, red for 1
                        let barColor = '#10b981'; // green
                        if (starLevel === 3 || starLevel === 2) {
                          barColor = '#ea580c'; // orange
                        } else if (starLevel === 1) {
                          barColor = '#dc2626'; // red
                        }

                        return (
                          <div key={starLevel} className={styles.ratingBarRow}>
                            <div className={styles.ratingBarLabel}>
                              <span>{starLevel}</span>
                              <svg className={styles.ratingBarStarIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557L3.04 10.385a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z" />
                              </svg>
                            </div>
                            <div className={styles.ratingBarContainer}>
                              <div
                                className={`${styles.ratingBar}${reviewSummaryAnimateIn ? ` ${styles.ratingBarAnimate}` : ''}`}
                                style={{
                                  ['--bar-target-width' as string]: `${percentage}%`,
                                  ['--bar-delay' as string]: `${barIndex * 150}ms`,
                                  background: barColor,
                                }}
                              ></div>
                            </div>
                            <div className={styles.ratingBarCount}>{count}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>

              {/* Related Products / Other Offerings */}
              {renderRelatedSection(false)}

              {/* Action Buttons moved above description */}
            </div>
          </div>
        )}
      </div>
      {isFlatPage && (
        <div className={styles.flatPageExtras}>
          <ProductDetailBanners banners={displayProduct.detailBanners} />
          <ProductDigitalFlipbook flipbook={displayProduct.digitalFlipbook} />
        </div>
      )}
      {isFlatPage && renderRelatedSection(true)}

      {/* Zoom overlay — clean image viewer with nav arrows */}
      {isZoomOpen && collageItems[selectedImageIndex] && (
        <div
          className={styles.zoomOverlay}
          style={zoomOverlayMotionStyle}
          onClick={(e) => {
            e.stopPropagation();
            closeImageZoom();
          }}
          role="dialog"
          aria-label="Image zoom"
        >
          {/* Image counter top-left */}
          <span className={styles.zoomCounter}>
            {selectedImageIndex + 1} / {collageItems.length}
          </span>

          {/* Close button top-right */}
          <button
            type="button"
            className={styles.zoomClose}
            onClick={(e) => {
              e.stopPropagation();
              closeImageZoom();
            }}
            aria-label="Close zoom"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Left arrow */}
          {collageItems.length > 1 && (
            <button
              type="button"
              className={`${styles.zoomNav} ${styles.zoomNavLeft}`}
              onClick={(e) => {
                e.stopPropagation();
                setZoomTransitioning(true);
                setSelectedImageIndex((i) => (i - 1 + collageItems.length) % collageItems.length);
                setZoomScale(1);
                setZoomPan({ x: 0, y: 0 });
                setZoomSwipeOffset(0);
                setTimeout(() => setZoomTransitioning(false), 300);
              }}
              aria-label="Previous image"
            >
              <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.489 31.975c-0.271 0-0.549-0.107-0.757-0.316-0.417-0.417-0.417-1.098 0-1.515l14.258-14.264-14.050-14.050c-0.417-0.417-0.417-1.098 0-1.515s1.098-0.417 1.515 0l14.807 14.807c0.417 0.417 0.417 1.098 0 1.515l-15.015 15.022c-0.208 0.208-0.486 0.316-0.757 0.316z"></path>
              </svg>
            </button>
          )}

          {/* Center image slider track */}
          <div
            className={styles.zoomImageWrap}
            onClick={(e) => e.stopPropagation()}
            onWheel={onZoomWheel}
            onMouseDown={(e) => {
              if (zoomScale <= 1) {
                onZoomSwipeStart(e.clientX, e.clientY);
              } else {
                onZoomMouseDown(e);
              }
            }}
            onMouseMove={(e) => {
              if (zoomSwiping) {
                onZoomSwipeMove(e.clientX);
              } else {
                onZoomMouseMove(e);
              }
            }}
            onMouseUp={(e) => {
              if (zoomSwiping) {
                onZoomSwipeEnd(e.clientX, e.clientY);
              } else {
                onZoomMouseUp(e);
              }
            }}
            onMouseLeave={(e) => {
              if (zoomSwiping) {
                onZoomSwipeEnd(zoomSwipeStartRef.current?.x ?? 0, zoomSwipeStartRef.current?.y ?? 0);
              }
              onZoomMouseUp(e);
            }}
            onTouchStart={(e) => {
              if (e.touches.length === 1 && zoomScale <= 1) {
                onZoomSwipeStart(e.touches[0].clientX, e.touches[0].clientY);
              }
              onZoomPinchStart(e);
            }}
            onTouchMove={(e) => {
              if (zoomSwiping && e.touches.length === 1) {
                onZoomSwipeMove(e.touches[0].clientX);
              }
              onZoomPinchMove(e);
            }}
            onTouchEnd={(e) => {
              if (zoomSwiping && e.changedTouches[0]) {
                const touch = e.changedTouches[0];
                onZoomSwipeEnd(touch.clientX, touch.clientY);
              }
              onZoomPinchEnd(e);
            }}
            onTouchCancel={(e) => {
              if (zoomSwiping) {
                setZoomSwipeOffset(0);
                setZoomSwiping(false);
                setZoomTransitioning(false);
              }
              onZoomPinchEnd(e);
            }}
          >
            <div
              className={styles.zoomTrack}
              style={{
                transform: `translateX(calc(-${selectedImageIndex * 100}% - ${selectedImageIndex * 24}px + ${zoomSwipeOffset}px))`,
                transition: zoomTransitioning ? 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
              }}
            >
              {collageItems.map((imgSrc, index) => (
                <div key={index} className={styles.zoomSlide}>
                  <img
                    src={imgSrc}
                    alt={index === selectedImageIndex ? displayProduct.name : ''}
                    className={styles.zoomImage}
                    style={{
                      transform: index === selectedImageIndex ? `scale(${zoomScale}) translate(${zoomPan.x / zoomScale}px, ${zoomPan.y / zoomScale}px)` : 'none',
                      cursor: zoomScale > 1 ? (isZoomPanning ? 'grabbing' : 'zoom-out') : (zoomSwiping ? 'grabbing' : 'zoom-in'),
                      transition: (index === selectedImageIndex && zoomScale > 1 && (zoomTransitioning || !isZoomPanning)) ? 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
                    }}
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Right arrow */}
          {collageItems.length > 1 && (
            <button
              type="button"
              className={`${styles.zoomNav} ${styles.zoomNavRight}`}
              onClick={(e) => {
                e.stopPropagation();
                setZoomTransitioning(true);
                setSelectedImageIndex((i) => (i + 1) % collageItems.length);
                setZoomScale(1);
                setZoomPan({ x: 0, y: 0 });
                setZoomSwipeOffset(0);
                setTimeout(() => setZoomTransitioning(false), 300);
              }}
              aria-label="Next image"
            >
              <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.489 31.975c-0.271 0-0.549-0.107-0.757-0.316-0.417-0.417-0.417-1.098 0-1.515l14.258-14.264-14.050-14.050c-0.417-0.417-0.417-1.098 0-1.515s1.098-0.417 1.515 0l14.807 14.807c0.417 0.417 0.417 1.098 0 1.515l-15.015 15.022c-0.208 0.208-0.486 0.316-0.757 0.316z"></path>
              </svg>
            </button>
          )}
        </div>
      )}
      {photobookPortal}
      {pbMobileBlockPortal}
      {marqueePortal}
      <ProductPrintUploadModal
        isOpen={isPrintUploadOpen}
        onClose={() => setIsPrintUploadOpen(false)}
        onContinue={({ items, mode }) => {
          setUploadedPrintItems(items);
          setUploadedPrintMode(mode);
        }}
        initialItems={uploadedPrintItems}
        initialMode={uploadedPrintMode}
        polaroidEnabled={resolvedPolaroidUploadEnabled}
        stripEnabled={resolvedStripUploadEnabled}
        maxImages={maxImages}
      />
      {isUploadingPrints && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          background: 'rgba(250, 249, 246, 0.95)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-instrument-serif)',
          color: '#1a1814',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(26, 24, 20, 0.1)',
            borderTopColor: '#1a1814',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '1.5rem',
          }} />
          <h2 className="uploadingTitle" style={{ fontWeight: 500, margin: '0 0 0.5rem 0' }}>
            Uploading your prints...
          </h2>
          <p className="uploadingSubtitle" style={{ color: '#5c5348', margin: 0, opacity: 0.8, marginBottom: '2rem' }}>
            {printUploadProgress?.message || 'Please wait while we prepare your custom prints.'}
          </p>

          <div style={{ width: '60%', maxWidth: '300px', height: '6px', background: '#e0dcd1', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              width: `${printUploadProgress?.percent || 0}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #1a1814 0%, #4a453c 50%, #1a1814 100%)',
              backgroundSize: '200% 100%',
              animation: 'progressShimmer 1.5s infinite linear',
              borderRadius: '4px',
              transition: 'width 0.3s ease-out'
            }} />
          </div>

          <div className="uploadingWarning" style={{
            position: 'absolute',
            bottom: '2.5rem',
            left: 0,
            right: 0,
            textAlign: 'center',
            color: '#dc2626',
            fontWeight: 500,
            letterSpacing: '-0.5px',
            fontFamily: 'var(--font-inter), sans-serif',
          }}>
            Don&apos;t close the screen
          </div>

          <style>{`
            .uploadingTitle { font-size: 2rem; }
            .uploadingSubtitle { font-size: 1.25rem; }
            .uploadingWarning { font-size: 1.15rem; }
            @media (max-width: 768px) {
              .uploadingTitle { font-size: 1.5rem; }
              .uploadingSubtitle { font-size: 1rem; }
              .uploadingWarning { font-size: 1rem; }
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            @keyframes progressShimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
        </div>
      )}

      {showRatingDetailsPopup && typeof document !== 'undefined' && createPortal(
        <div
          className={styles.reviewsPopupOverlay}
          onClick={() => setShowRatingDetailsPopup(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Customer reviews"
        >
          <div
            className={styles.reviewsPopupPanel}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <div className={styles.reviewsPopupHeader}>
              <h3 className={styles.reviewsPopupTitle}>Customer Reviews ({reviews.length})</h3>
              <button
                type="button"
                className={styles.reviewsPopupClose}
                onClick={() => setShowRatingDetailsPopup(false)}
                aria-label="Close reviews"
              >
                ×
              </button>
            </div>

            <div className={styles.reviewsPopupScroll}>
              <div className={styles.ratingDetailsMeter}>
                <div className={styles.ratingMetersRow}>
                  {renderSingleRatingMeter(feedback?.qualityStars, 'quality', 'Quality of the product', ratingMeterAnimateIn)}
                  {renderSingleRatingMeter(feedback?.deliveryAgentStars, 'delivery', 'Delivery agent behaviour', ratingMeterAnimateIn)}
                  {renderSingleRatingMeter(feedback?.onTimeStars, 'on-time', 'On time delivery', ratingMeterAnimateIn)}
                  {renderSingleRatingMeter(feedback?.valueForMoneyStars, 'value', 'Value for money', ratingMeterAnimateIn)}
                </div>
              </div>

              {reviews.length > 0 ? (
                <div className={styles.reviewsList}>
                  {reviews.map((review) => {
                    const reviewerInitial = (review.reviewerName || 'C').charAt(0).toUpperCase();
                    return (
                      <article key={review.id} className={styles.reviewItem}>
                        <div className={styles.reviewHeader}>
                          <div className={styles.reviewerInfo}>
                            <div className={styles.reviewerAvatarWrap}>
                              <div className={styles.reviewerAvatar} aria-hidden="true">
                                {reviewerInitial}
                              </div>
                              <span className={styles.reviewerVerifiedBadge} tabIndex={0} aria-label="Verified customer">
                                <span className={styles.reviewerVerifiedTooltip} role="tooltip">
                                  Verified customer
                                </span>
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                  <path
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                    d="M9.5924 3.20027C9.34888 3.4078 9.22711 3.51158 9.09706 3.59874C8.79896 3.79854 8.46417 3.93721 8.1121 4.00672C7.95851 4.03705 7.79903 4.04977 7.48008 4.07522C6.6787 4.13918 6.278 4.17115 5.94371 4.28923C5.17051 4.56233 4.56233 5.17051 4.28923 5.94371C4.17115 6.278 4.13918 6.6787 4.07522 7.48008C4.04977 7.79903 4.03705 7.95851 4.00672 8.1121C3.93721 8.46417 3.79854 8.79896 3.59874 9.09706C3.51158 9.22711 3.40781 9.34887 3.20027 9.5924C2.67883 10.2043 2.4181 10.5102 2.26522 10.8301C1.91159 11.57 1.91159 12.43 2.26522 13.1699C2.41811 13.4898 2.67883 13.7957 3.20027 14.4076C3.40778 14.6511 3.51158 14.7729 3.59874 14.9029C3.79854 15.201 3.93721 15.5358 4.00672 15.8879C4.03705 16.0415 4.04977 16.201 4.07522 16.5199C4.13918 17.3213 4.17115 17.722 4.28923 18.0563C4.56233 18.8295 5.17051 19.4377 5.94371 19.7108C6.278 19.8288 6.6787 19.8608 7.48008 19.9248C7.79903 19.9502 7.95851 19.963 8.1121 19.9933C8.46417 20.0628 8.79896 20.2015 9.09706 20.4013C9.22711 20.4884 9.34887 20.5922 9.5924 20.7997C10.2043 21.3212 10.5102 21.5819 10.8301 21.7348C11.57 22.0884 12.43 22.0884 13.1699 21.7348C13.4898 21.5819 13.7957 21.3212 14.4076 20.7997C14.6511 20.5922 14.7729 20.4884 14.9029 20.4013C15.201 20.2015 15.5358 20.0628 15.8879 19.9933C16.0415 19.963 16.201 19.9502 16.5199 19.9248C17.3213 19.8608 17.722 19.8288 18.0563 19.7108C18.8295 19.4377 19.4377 18.8295 19.7108 18.0563C19.8288 17.722 19.8608 17.3213 19.9248 16.5199C19.9502 16.201 19.963 16.0415 19.9933 15.8879C20.0628 15.5358 20.2015 15.201 20.4013 14.9029C20.4884 14.7729 20.5922 14.6511 20.7997 14.4076C21.3212 13.7957 21.5819 13.4898 21.7348 13.1699C22.0884 12.43 22.0884 11.57 21.7348 10.8301C21.5819 10.5102 21.3212 10.2043 20.7997 9.5924C20.5922 9.34887 20.4884 9.22711 20.4013 9.09706C20.2015 8.79896 20.0628 8.46417 19.9933 8.1121C19.963 7.95851 19.9502 7.79903 19.9248 7.48008C19.8608 6.6787 19.8288 6.278 19.7108 5.94371C19.4377 5.17051 18.8295 4.56233 18.0563 4.28923C17.722 4.17115 17.3213 4.13918 16.5199 4.07522C16.201 4.04977 16.0415 4.03705 15.8879 4.00672C15.5358 3.93721 15.201 3.79854 14.9029 3.59874C14.7729 3.51158 14.6511 3.40781 14.4076 3.20027C13.7957 2.67883 13.4898 2.41811 13.1699 2.26522C12.43 1.91159 11.57 1.91159 10.8301 2.26522C10.5102 2.4181 10.2043 2.67883 9.5924 3.20027ZM16.3735 9.86314C16.6913 9.5453 16.6913 9.03 16.3735 8.71216C16.0557 8.39433 15.5403 8.39433 15.2225 8.71216L10.3723 13.5624L8.77746 11.9676C8.45963 11.6498 7.94432 11.6498 7.62649 11.9676C7.30866 12.2854 7.30866 12.8007 7.62649 13.1186L9.79678 15.2889C10.1146 15.6067 10.6299 15.6067 10.9478 15.2889L16.3735 9.86314Z"
                                    fill="#ff004c"
                                  />
                                </svg>
                              </span>
                            </div>
                            <div className={styles.reviewerName}>{review.reviewerName}</div>
                          </div>
                          {renderReviewStars(review.rating)}
                        </div>
                        {review.comment ? (
                          <p className={styles.reviewText}>{review.comment}</p>
                        ) : null}
                        <time className={styles.reviewDate} dateTime={review.createdAt}>
                          {formatReviewRelativeDate(review.createdAt)}
                        </time>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.reviewsPopupEmptyState}>
                  <svg
                    className={styles.reviewsPopupEmptyIllustration}
                    viewBox="0 0 400 400"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path d="M169.562 158.468C172.723 143.863 188.522 134.417 202.42 131.439C278.386 115.161 314.412 201.317 267.078 242.734C225.658 278.977 150.298 244.532 166.912 178.077" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M180.504 265.903C158.81 277.858 129.811 297.195 105.777 304.062" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M214.719 281.677C246.965 293.888 278.57 299.822 311.937 308.832" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M180.503 265.903C82.5548 224.942 122.393 218.848 169.317 236.19" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M327.306 211.316C320.772 213.104 313.707 208.576 307.167 211.846C286.241 222.308 351.269 279.131 313.527 311.481C306.592 317.426 298.551 322.599 289.678 325.261C275.984 329.369 260.719 327.767 246.749 330.561C232.66 333.379 220.402 350.441 239.86 356" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M311.937 308.832C327.788 306.392 321.295 326.14 308.227 313.072" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M105.78 304.062C88.4488 311.249 82.9796 300.938 70.8008 290.282" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M139.03 342.308C123.46 352.398 109.624 355.167 92.5312 345.4" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M350.098 310.422C288.359 284.983 233.083 265.903 175.016 238.78" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M351.686 308.301C349.24 283.761 369.319 305.987 373.945 316.782" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M346.918 309.892C332.921 327.365 365.863 317.792 373.947 316.781" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M233.082 223.013C228.402 225.102 224.355 225.805 219.832 223.543" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M257.515 227.136C256.901 223.613 258.58 219.231 259.345 216.682" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M70.8005 290.282C65.5847 289.885 56.8604 289.236 53.8047 292.292" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M89.8894 344.321C85.1582 343.573 81.7853 345.017 78.1406 346.839" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M259.278 115.132C257.236 105.677 308.483 29.7598 317.182 47.158C330.315 73.4239 296.203 114.899 296.203 130.238C296.203 135.166 316.098 115.777 320.539 126.881C324.131 135.861 313.387 148.908 307.112 153.735C304.929 155.415 298.327 154.628 299.559 157.092C299.717 157.407 334.024 166.814 307.112 172.197C304.901 172.639 302.636 172.756 300.398 173.036" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M146.858 202.762C129.834 161.686 87.4826 88.7261 33.1626 88.7261C-4.25663 88.7261 49.8853 152.314 54.1424 155.861C66.6065 166.248 77.3107 177.351 88.5492 188.589C91.2026 191.243 81.5713 185.68 78.4787 183.554C73.6425 180.229 45.956 158.316 39.8765 168.449C31.0635 183.136 48.7612 200.078 59.1773 207.891C67.8583 214.402 76.9239 214.419 76.8004 214.604C72.4305 221.16 61.6979 212.639 57.499 223.835C52.2874 237.733 85.8143 257.403 97.7802 257.403" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M211.775 284.983C186.335 308.62 166.864 329.654 139.027 342.308" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M128.504 297.548C133.258 310.12 138.34 322.733 142.553 335.375" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className={styles.reviewsPopupEmpty}>No customer reviews yet. Be the first to share your experience after delivery.</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

