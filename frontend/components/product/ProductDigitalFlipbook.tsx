'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  flipbookHardcoverBackground,
  normalizeFlipbookHardcoverColor,
} from '@/lib/flipbook/hardcoverColor';
import type { ProductDigitalFlipbook } from '@/types';
import styles from './ProductDigitalFlipbook.module.css';

interface ProductDigitalFlipbookProps {
  flipbook?: ProductDigitalFlipbook | null;
  hideSectionNav?: boolean;
  hideTitle?: boolean;
  embedded?: boolean;
  hideHardcover?: boolean;
  singlePageMode?: boolean;
  /** Front/back cover as solo pages; interior pages open as left+right spreads. */
  photobookSpreadMode?: boolean;
  pageSizePx?: { widthPx: number; heightPx: number };
  layoutContainerRef?: React.RefObject<HTMLElement | null>;
}

type PhotobookSpreadLayout = {
  single: boolean;
  leftIndex: number | null;
  rightIndex: number | null;
};

interface FlatPage {
  imageUrl: string;
  pageNumber: number;
  sectionIndex: number;
}

type FlipSession = {
  sourceSpreadIndex: number;
  targetSpreadIndex: number;
  direction: 'next' | 'prev';
};

type FlipPhase = 'idle' | 'dragging' | 'animating' | 'settling';

function getCoverHingeFlipFlags(
  photobookSpreadMode: boolean,
  flipSession: FlipSession | null,
  flipPhase: FlipPhase,
  isSpreadSingleLayout: (index: number) => boolean,
): { openingFromSingleCover: boolean; closingToSingleCover: boolean } {
  if (!photobookSpreadMode || !flipSession || flipPhase === 'idle') {
    return { openingFromSingleCover: false, closingToSingleCover: false };
  }

  const sourceSpreadIsSingle = isSpreadSingleLayout(flipSession.sourceSpreadIndex);
  const targetSpreadIsSingle = isSpreadSingleLayout(flipSession.targetSpreadIndex);

  return {
    openingFromSingleCover: flipSession.direction === 'next'
      && sourceSpreadIsSingle
      && !targetSpreadIsSingle,
    closingToSingleCover: flipSession.direction === 'prev'
      && !sourceSpreadIsSingle
      && targetSpreadIsSingle,
  };
}

type PageSide = 'left' | 'right';

type SectionConnectorSpan = {
  left: number;
  width: number;
};

const MIN_SECTION_STEP_GAP_PX = 16;
const SECTION_LAYOUT_MEDIA_QUERY = '(min-width: 969px)';

function connectorSpansEqual(
  nextSpans: SectionConnectorSpan[],
  prevSpans: SectionConnectorSpan[],
): boolean {
  if (nextSpans.length !== prevSpans.length) return false;

  return nextSpans.every((span, index) => {
    const prev = prevSpans[index];
    return (
      Math.round(span.left) === Math.round(prev.left)
      && Math.round(span.width) === Math.round(prev.width)
    );
  });
}

const FLIP_DURATION_MS = 720;
const CHAINED_FLIP_DURATION_MS = 480;
const SNAP_BACK_DURATION_MS = 360;
const FLIP_COMMIT_THRESHOLD = 0.32;
const BASE_REVEAL_THRESHOLD = 0.02;
const MIN_SETTLE_MS = 140;
const SETTLE_SHADOW_FADE_MS = 260;
const PRELOAD_SPREAD_RADIUS = 2;

function curlShadowOpacity(progress: number) {
  return Math.min(0.55, 0.1 + progress * 0.45);
}

function flipLiftShadowStrength(progress: number, phase: FlipPhase, animatingCommit: boolean | null) {
  if (phase === 'settling') return 0;

  if (phase === 'dragging') {
    if (progress <= 0.5) return 1;
    return Math.max(0, (1 - progress) / 0.5);
  }

  if (phase === 'animating') {
    if (animatingCommit) {
      if (progress <= 0.5) return 1;
      if (progress >= 0.92) return 0.3;
      const tail = (progress - 0.5) / 0.42;
      return 1 - tail * 0.7;
    }
    if (progress >= 0.5) return 1;
    if (progress <= 0.12) return 0.3;
    return Math.max(0.3, progress / 0.5);
  }

  return 0;
}

function flipLiftZ(progress: number, phase: FlipPhase) {
  if (phase === 'idle') return 0;
  return Math.sin(progress * Math.PI) * 16;
}

function flipLiftBoxShadow(strength: number, direction: 'next' | 'prev') {
  if (strength <= 0) return 'none';

  const alpha = 0.22 * strength;
  const offsetX = direction === 'next' ? 10 : -10;
  const offsetY = 5;
  const blur = 10 + 14 * strength;

  return `${offsetX * strength}px ${offsetY * strength}px ${blur}px rgba(15, 23, 42, ${alpha})`;
}

function NavChevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={styles.bookNavIcon}>
      <path
        d={direction === 'left' ? 'M14 7L9 12L14 17' : 'M10 7L15 12L10 17'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function normalizeProgress(progress: number) {
  if (progress <= 0.001) return 0;
  if (progress >= 0.999) return 1;
  return progress;
}

function preventNativeDrag(event: React.DragEvent) {
  event.preventDefault();
}

interface PageSurfaceProps {
  side: PageSide;
  page: FlatPage | null | undefined;
  hidden?: boolean;
  loadImage?: boolean;
  surfaceRef?: React.Ref<HTMLDivElement>;
  imageRef?: React.Ref<HTMLImageElement>;
  imageTestId?: string;
  overlay?: React.ReactNode;
}

function PageSurface({
  side,
  page,
  hidden,
  loadImage = true,
  surfaceRef,
  imageRef,
  imageTestId,
  overlay,
}: PageSurfaceProps) {
  const surfaceClass = [
    styles.pageSurface,
    side === 'left' ? styles.pageSurfaceLeft : styles.pageSurfaceRight,
    hidden ? styles.pageSurfaceHidden : '',
  ].filter(Boolean).join(' ');

  if (page) {
    return (
      <div ref={surfaceRef} className={surfaceClass}>
        {loadImage ? (
          <img
            ref={imageRef}
            src={page.imageUrl}
            alt={`Page ${page.pageNumber}`}
            className={styles.pageImage}
            data-testid={imageTestId}
            draggable={false}
            onDragStart={preventNativeDrag}
            decoding="async"
          />
        ) : (
          <div className={styles.pagePlaceholder} aria-hidden="true" />
        )}
        {overlay}
      </div>
    );
  }

  return (
    <div ref={surfaceRef} className={surfaceClass}>
      <div className={styles.blankPage} />
      {overlay}
    </div>
  );
}

interface PageCellProps {
  side: PageSide;
  wrapperRef?: React.Ref<HTMLDivElement>;
  draggable?: boolean;
  turning?: boolean;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (event: React.PointerEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

function PageCell({
  side,
  wrapperRef,
  draggable,
  turning,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  children,
}: PageCellProps) {
  const sideClass = side === 'left' ? styles.bookPageLeft : styles.bookPageRight;
  const pageCellSideClass = side === 'left' ? styles.pageCellLeft : styles.pageCellRight;

  return (
    <div
      ref={wrapperRef}
      className={[
        styles.pageCell,
        pageCellSideClass,
        sideClass,
        styles.staticPages,
        draggable ? styles.bookPageDraggable : '',
        turning ? styles.bookPageTurning : '',
      ].filter(Boolean).join(' ')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDragStart={preventNativeDrag}
    >
      {children}
    </div>
  );
}

export default function ProductDigitalFlipbook({
  flipbook,
  hideSectionNav = false,
  hideTitle = false,
  embedded = false,
  hideHardcover = false,
  singlePageMode = false,
  photobookSpreadMode = false,
  pageSizePx,
  layoutContainerRef,
}: ProductDigitalFlipbookProps) {
  const sections = useMemo(() => {
    const raw = flipbook?.sections ?? [];
    return raw.filter((section) => {
      if (!section.imageUrls?.length) return false;
      if (hideSectionNav) return true;
      return Boolean(section.title);
    });
  }, [flipbook?.sections, hideSectionNav]);

  const enabled = Boolean(flipbook?.enabled) && sections.length > 0;

  const { flatPages, sectionStarts } = useMemo(() => {
    const pages: FlatPage[] = [];
    const starts: number[] = [];
    let pageNum = 1;

    sections.forEach((section, sectionIndex) => {
      starts.push(pages.length);
      section.imageUrls.forEach((imageUrl) => {
        pages.push({ imageUrl, pageNumber: pageNum, sectionIndex });
        pageNum += 1;
      });
    });

    return { flatPages: pages, sectionStarts: starts };
  }, [sections]);

  const photobookSpreads = useMemo((): PhotobookSpreadLayout[] => {
    if (!photobookSpreadMode || flatPages.length === 0) return [];

    const spreads: PhotobookSpreadLayout[] = [
      { single: true, leftIndex: null, rightIndex: 0 },
    ];

    const middleEnd = flatPages.length - 1;
    for (let index = 1; index < middleEnd; index += 2) {
      spreads.push({
        single: false,
        leftIndex: index,
        rightIndex: index + 1 < middleEnd ? index + 1 : null,
      });
    }

    if (flatPages.length > 1) {
      spreads.push({
        single: true,
        leftIndex: null,
        rightIndex: flatPages.length - 1,
      });
    }

    return spreads;
  }, [flatPages, photobookSpreadMode]);

  const isSpreadSingleLayout = useCallback((index: number) => {
    if (photobookSpreadMode) {
      return photobookSpreads[index]?.single ?? false;
    }
    return singlePageMode;
  }, [photobookSpreadMode, photobookSpreads, singlePageMode]);

  const totalPages = flatPages.length;
  const totalSpreads = useMemo(() => {
    if (photobookSpreadMode) {
      return Math.max(1, photobookSpreads.length);
    }
    return Math.max(1, singlePageMode ? totalPages : Math.ceil(totalPages / 2));
  }, [photobookSpreadMode, photobookSpreads.length, singlePageMode, totalPages]);

  const [spreadIndex, setSpreadIndex] = useState(0);
  const [flipPhase, setFlipPhase] = useState<FlipPhase>('idle');
  const [flipProgress, setFlipProgress] = useState(0);
  const [pendingSpreadIndex, setPendingSpreadIndex] = useState<number | null>(null);
  const [flipSession, setFlipSession] = useState<FlipSession | null>(null);
  const [settleShadowFade, setSettleShadowFade] = useState(1);

  const bookSpreadRef = useRef<HTMLDivElement>(null);
  const bookAssemblyRef = useRef<HTMLDivElement>(null);
  const bookViewportRef = useRef<HTMLDivElement>(null);
  const leftPageRef = useRef<HTMLDivElement>(null);
  const rightPageRef = useRef<HTMLDivElement>(null);
  const staticLeftSurfaceRef = useRef<HTMLDivElement>(null);
  const staticRightSurfaceRef = useRef<HTMLDivElement>(null);
  const staticRightImageRef = useRef<HTMLImageElement>(null);
  const flipSheetRef = useRef<HTMLDivElement>(null);
  const dragStartXRef = useRef(0);
  const activePointerIdRef = useRef<number | null>(null);
  const flipProgressRef = useRef(0);
  const flipPhaseRef = useRef<FlipPhase>('idle');
  const flipSessionRef = useRef<FlipSession | null>(null);
  const pendingSpreadIndexRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationTimeoutRef = useRef<number | null>(null);
  const completeFlipRef = useRef<(committed: boolean) => void>(() => undefined);
  const animatingCommitRef = useRef<boolean | null>(null);
  const settlingShadowStrengthRef = useRef(0);
  const lastMeasuredGeometryRef = useRef({ width: 0, height: 0 });
  const photobookPageDimsRef = useRef<{ pageW: number; pageH: number } | null>(null);
  const queuedSpreadIndexRef = useRef<number | null>(null);
  const preloadedUrlsRef = useRef<Set<string>>(new Set());
  const launchFlipRef = useRef<(source: number, target: number, direction: 'next' | 'prev', duration: number) => void>(() => undefined);

  useEffect(() => {
    flipProgressRef.current = flipProgress;
  }, [flipProgress]);

  useEffect(() => {
    flipPhaseRef.current = flipPhase;
  }, [flipPhase]);

  useEffect(() => {
    flipSessionRef.current = flipSession;
  }, [flipSession]);

  useEffect(() => {
    pendingSpreadIndexRef.current = pendingSpreadIndex;
  }, [pendingSpreadIndex]);

  useEffect(() => {
    setSpreadIndex(0);
    setFlipPhase('idle');
    setPendingSpreadIndex(null);
    setFlipProgress(0);
    setFlipSession(null);
    flipPhaseRef.current = 'idle';
    flipProgressRef.current = 0;
    pendingSpreadIndexRef.current = null;
    flipSessionRef.current = null;
    queuedSpreadIndexRef.current = null;
    preloadedUrlsRef.current = new Set();
    photobookPageDimsRef.current = null;
  }, [totalPages]);

  const shouldLoadPageIndex = useCallback((pageIndex: number) => {
    if (pageIndex < 0 || pageIndex >= totalPages) return false;

    const activeSpreads = new Set<number>([spreadIndex]);
    if (pendingSpreadIndex !== null) activeSpreads.add(pendingSpreadIndex);
    if (queuedSpreadIndexRef.current !== null) activeSpreads.add(queuedSpreadIndexRef.current);
    if (flipSessionRef.current) {
      activeSpreads.add(flipSessionRef.current.sourceSpreadIndex);
      activeSpreads.add(flipSessionRef.current.targetSpreadIndex);
    }

    for (const spread of activeSpreads) {
      for (let offset = -PRELOAD_SPREAD_RADIUS; offset <= PRELOAD_SPREAD_RADIUS; offset += 1) {
        const nearbySpread = spread + offset;
        if (nearbySpread < 0 || nearbySpread >= totalSpreads) continue;
        if (photobookSpreadMode) {
          const layout = photobookSpreads[nearbySpread];
          if (!layout) continue;
          if (layout.leftIndex === pageIndex || layout.rightIndex === pageIndex) return true;
          continue;
        }
        if (singlePageMode) {
          if (pageIndex === nearbySpread) return true;
          continue;
        }
        const leftIndex = nearbySpread * 2;
        const rightIndex = nearbySpread * 2 + 1;
        if (pageIndex === leftIndex || pageIndex === rightIndex) return true;
      }
    }

    return false;
  }, [pendingSpreadIndex, photobookSpreadMode, photobookSpreads, singlePageMode, spreadIndex, totalPages, totalSpreads]);

  const shouldLoadPage = useCallback((page: FlatPage | null | undefined) => {
    if (!page) return false;
    return shouldLoadPageIndex(page.pageNumber - 1);
  }, [shouldLoadPageIndex]);

  useEffect(() => {
    const spreadsToWarm = new Set<number>([spreadIndex]);
    if (pendingSpreadIndex !== null) spreadsToWarm.add(pendingSpreadIndex);
    if (queuedSpreadIndexRef.current !== null) spreadsToWarm.add(queuedSpreadIndexRef.current);

    spreadsToWarm.forEach((spread) => {
      for (let offset = -PRELOAD_SPREAD_RADIUS; offset <= PRELOAD_SPREAD_RADIUS; offset += 1) {
        const nearbySpread = spread + offset;
        if (nearbySpread < 0 || nearbySpread >= totalSpreads) continue;
        let pageIndexes: number[] = [];
        if (photobookSpreadMode) {
          const layout = photobookSpreads[nearbySpread];
          if (!layout) continue;
          pageIndexes = [layout.leftIndex, layout.rightIndex].filter(
            (value): value is number => value !== null,
          );
        } else if (singlePageMode) {
          pageIndexes = [nearbySpread];
        } else {
          pageIndexes = [nearbySpread * 2, nearbySpread * 2 + 1];
        }
        pageIndexes.forEach((pageIndex) => {
          const page = flatPages[pageIndex];
          if (!page || preloadedUrlsRef.current.has(page.imageUrl)) return;
          preloadedUrlsRef.current.add(page.imageUrl);
          const image = new Image();
          image.decoding = 'async';
          image.src = page.imageUrl;
        });
      }
    });
  }, [flatPages, pendingSpreadIndex, photobookSpreadMode, photobookSpreads, singlePageMode, spreadIndex, totalSpreads]);

  const getSpreadPages = useCallback((index: number) => {
    if (photobookSpreadMode) {
      const layout = photobookSpreads[index];
      if (!layout) return { left: null, right: null };
      return {
        left: layout.leftIndex !== null ? flatPages[layout.leftIndex] ?? null : null,
        right: layout.rightIndex !== null ? flatPages[layout.rightIndex] ?? null : null,
      };
    }

    if (singlePageMode) {
      return {
        left: null,
        right: flatPages[index] ?? null,
      };
    }

    const leftIndex = index * 2;
    const rightIndex = index * 2 + 1;
    return {
      left: flatPages[leftIndex] ?? null,
      right: flatPages[rightIndex] ?? null,
    };
  }, [flatPages, photobookSpreadMode, photobookSpreads, singlePageMode]);

  const applySpreadGeometry = useCallback((
    spreadWidth: number,
    spreadHeight: number,
    isSinglePage: boolean,
    fixedPageSize?: { pageW: number; pageH: number },
  ) => {
    const spread = bookSpreadRef.current;
    if (!spread) return;

    const roundedSpreadWidth = Math.round(spreadWidth);
    const roundedSpreadHeight = Math.round(spreadHeight);
    const roundedPageWidth = fixedPageSize
      ? fixedPageSize.pageW
      : Math.round(isSinglePage ? roundedSpreadWidth : roundedSpreadWidth / 2);
    const roundedPageHeight = fixedPageSize
      ? fixedPageSize.pageH
      : roundedSpreadHeight;

    const pageCssVars = [
      ['--spine-gap', '0px'],
      ['--page-width', `${roundedPageWidth}px`],
      ['--page-height', `${roundedPageHeight}px`],
      ['--page-min-height', `${roundedPageHeight}px`],
      ['--page-top', '0px'],
      ['--page-left', '0px'],
      ['--page-right', '0px'],
    ] as const;

    for (const [name, value] of pageCssVars) {
      spread.style.setProperty(name, value);
    }

    const assembly = bookAssemblyRef.current;
    const viewport = bookViewportRef.current;
    const viewportWrap = viewport?.parentElement;
    for (const node of [assembly, viewport, viewportWrap]) {
      if (!node) continue;
      node.style.setProperty('--page-width', `${roundedPageWidth}px`);
      node.style.setProperty('--page-height', `${roundedPageHeight}px`);
    }

    lastMeasuredGeometryRef.current = {
      width: roundedSpreadWidth,
      height: roundedPageHeight,
    };
  }, []);

  const computePhotobookPageDimensions = useCallback(() => {
    if (!pageSizePx) return null;

    const container = layoutContainerRef?.current ?? bookViewportRef.current;
    if (!container) return null;

    const coverInsetY = 3;
    const bottomPad = embedded ? 12 : 18;
    const horizontalPad = embedded ? (hideHardcover ? 0 : 24) : 24;
    const maxSpreadW = Math.max(120, container.clientWidth - horizontalPad);
    const maxSpreadH = Math.max(120, container.clientHeight - coverInsetY * 2 - bottomPad - (embedded ? 48 : 0));

    const naturalPageW = pageSizePx.widthPx;
    const naturalPageH = pageSizePx.heightPx;
    const scale = Math.min(1, maxSpreadW / (naturalPageW * 2), maxSpreadH / naturalPageH);
    const pageW = Math.round(naturalPageW * scale);
    const pageH = Math.round(naturalPageH * scale);

    return { pageW, pageH };
  }, [embedded, hideHardcover, layoutContainerRef, pageSizePx]);

  const getPhotobookBasePageDimensions = useCallback(() => {
    if (photobookSpreadMode && flipPhaseRef.current !== 'idle' && photobookPageDimsRef.current) {
      return photobookPageDimsRef.current;
    }

    const dims = computePhotobookPageDimensions();
    if (dims) {
      photobookPageDimsRef.current = dims;
    }
    return dims;
  }, [computePhotobookPageDimensions, photobookSpreadMode]);

  const lockPhotobookPageDimensions = useCallback(() => {
    if (!photobookSpreadMode) return;
    const dims = computePhotobookPageDimensions();
    if (dims) {
      photobookPageDimsRef.current = dims;
    }
  }, [computePhotobookPageDimensions, photobookSpreadMode]);

  const getScaledSpreadDimensions = useCallback((isSingle: boolean) => {
    if (!pageSizePx) return null;

    if (photobookSpreadMode) {
      const base = getPhotobookBasePageDimensions();
      if (!base) return null;
      return {
        spreadW: isSingle ? base.pageW : base.pageW * 2,
        spreadH: base.pageH,
        isSingle,
        pageW: base.pageW,
        pageH: base.pageH,
      };
    }

    const container = layoutContainerRef?.current ?? bookViewportRef.current;
    if (!container) return null;

    const coverInsetY = 3;
    const bottomPad = embedded ? 12 : 18;
    const horizontalPad = embedded ? (hideHardcover ? 0 : 24) : 24;
    const maxSpreadW = Math.max(120, container.clientWidth - horizontalPad);
    const maxSpreadH = Math.max(120, container.clientHeight - coverInsetY * 2 - bottomPad - (embedded ? 48 : 0));

    const naturalSpreadW = isSingle ? pageSizePx.widthPx : pageSizePx.widthPx * 2;
    const naturalSpreadH = pageSizePx.heightPx;
    const scale = Math.min(1, maxSpreadW / naturalSpreadW, maxSpreadH / naturalSpreadH);

    return {
      spreadW: Math.round(naturalSpreadW * scale),
      spreadH: Math.round(naturalSpreadH * scale),
      isSingle,
    };
  }, [embedded, getPhotobookBasePageDimensions, hideHardcover, layoutContainerRef, pageSizePx, photobookSpreadMode]);

  const getFlipInterpolatedDimensions = useCallback((
    sourceSpreadIndex: number,
    targetSpreadIndex: number,
    progress: number,
  ) => {
    const sourceSingle = isSpreadSingleLayout(sourceSpreadIndex);
    const targetSingle = isSpreadSingleLayout(targetSpreadIndex);
    const t = Math.max(0, Math.min(1, progress));

    if (photobookSpreadMode) {
      const base = getPhotobookBasePageDimensions();
      if (!base) return null;

      const sourceW = sourceSingle ? base.pageW : base.pageW * 2;
      const targetW = targetSingle ? base.pageW : base.pageW * 2;
      const isCoverOpen = sourceSingle && !targetSingle;
      const isCoverClose = !sourceSingle && targetSingle;

      let spreadW = Math.round(sourceW + (targetW - sourceW) * t);

      return {
        spreadW,
        spreadH: base.pageH,
        layoutSingle: spreadW <= base.pageW + 1,
        pageW: base.pageW,
        pageH: base.pageH,
        hingeLeftW: Math.max(0, spreadW - base.pageW),
        isCoverHinge: isCoverOpen || isCoverClose,
      };
    }

    const source = getScaledSpreadDimensions(sourceSingle);
    const target = getScaledSpreadDimensions(targetSingle);
    if (!source || !target) return null;

    const spreadW = Math.round(source.spreadW + (target.spreadW - source.spreadW) * t);
    const spreadH = Math.round(source.spreadH + (target.spreadH - source.spreadH) * t);
    const layoutSingle = sourceSingle === targetSingle
      ? sourceSingle
      : spreadW < (source.spreadW + target.spreadW) / 2;

    return { spreadW, spreadH, layoutSingle };
  }, [getPhotobookBasePageDimensions, getScaledSpreadDimensions, isSpreadSingleLayout, photobookSpreadMode]);

  const applySpreadDimensionsToDom = useCallback((
    spreadW: number,
    spreadH: number,
    layoutSingle: boolean,
    fixedPageSize?: { pageW: number; pageH: number },
    hingeLeftW?: number | null,
  ) => {
    const spread = bookSpreadRef.current;
    const assembly = bookAssemblyRef.current;
    const viewport = bookViewportRef.current;
    if (!spread) return;

    const pageH = fixedPageSize?.pageH ?? spreadH;

    spread.style.width = `${spreadW}px`;
    spread.style.maxWidth = '100%';
    spread.style.height = `${pageH}px`;
    spread.style.minHeight = `${pageH}px`;
    spread.style.maxHeight = `${pageH}px`;
    spread.style.marginLeft = 'auto';
    spread.style.marginRight = 'auto';

    if (hingeLeftW != null && fixedPageSize) {
      spread.style.setProperty('--left-column-width', `${Math.max(0, hingeLeftW)}px`);
    } else {
      spread.style.removeProperty('--left-column-width');
    }

    if (assembly) {
      assembly.style.width = `${spreadW}px`;
      assembly.style.height = `${pageH}px`;
      assembly.style.minHeight = `${pageH}px`;
      assembly.style.maxHeight = `${pageH}px`;
      assembly.style.marginLeft = 'auto';
      assembly.style.marginRight = 'auto';
    }

    if (viewport && embedded) {
      viewport.style.width = `${spreadW}px`;
      viewport.style.maxWidth = '100%';
      viewport.style.marginLeft = 'auto';
      viewport.style.marginRight = 'auto';
    } else if (viewport) {
      viewport.style.removeProperty('width');
      viewport.style.removeProperty('margin-left');
      viewport.style.removeProperty('margin-right');
    }

    applySpreadGeometry(spreadW, pageH, layoutSingle, fixedPageSize);
  }, [applySpreadGeometry, embedded]);

  const syncSpreadGeometryFromPageSize = useCallback(() => {
    if (!pageSizePx || !bookSpreadRef.current) return false;

    const dims = getScaledSpreadDimensions(isSpreadSingleLayout(spreadIndex));
    if (!dims) return false;

    const fixedPage = photobookSpreadMode && 'pageW' in dims
      ? { pageW: dims.pageW!, pageH: dims.pageH! }
      : undefined;
    applySpreadDimensionsToDom(dims.spreadW, dims.spreadH, dims.isSingle, fixedPage);
    return true;
  }, [applySpreadDimensionsToDom, getScaledSpreadDimensions, isSpreadSingleLayout, pageSizePx, photobookSpreadMode, spreadIndex]);

  const syncSpreadGeometry = useCallback((force = false) => {
    const spread = bookSpreadRef.current;
    if (!spread) return;

    if (!force && flipPhaseRef.current !== 'idle') return;

    if (pageSizePx && syncSpreadGeometryFromPageSize()) return;

    const spreadWidth = spread.offsetWidth;
    const spreadHeight = spread.offsetHeight;
    const roundedWidth = Math.round(spreadWidth);
    const roundedHeight = Math.round(spreadHeight);

    if (
      !force
      && roundedWidth === lastMeasuredGeometryRef.current.width
      && roundedHeight === lastMeasuredGeometryRef.current.height
    ) {
      return;
    }

    applySpreadGeometry(spreadWidth, spreadHeight, isSpreadSingleLayout(spreadIndex));
  }, [applySpreadGeometry, isSpreadSingleLayout, pageSizePx, singlePageMode, spreadIndex, syncSpreadGeometryFromPageSize]);

  useEffect(() => {
    const spread = bookSpreadRef.current;
    if (!spread) return;

    syncSpreadGeometry(true);
    const observer = new ResizeObserver(() => {
      if (flipPhaseRef.current !== 'idle' && photobookSpreadMode) return;
      if (flipPhaseRef.current !== 'idle') return;
      syncSpreadGeometry();
    });
    observer.observe(spread);

    const viewport = bookViewportRef.current;
    const layoutContainer = layoutContainerRef?.current;
    if (viewport) observer.observe(viewport);
    if (layoutContainer) observer.observe(layoutContainer);

    return () => observer.disconnect();
  }, [layoutContainerRef, pageSizePx, photobookSpreadMode, singlePageMode, spreadIndex, syncSpreadGeometry]);

  useEffect(() => {
    if (!photobookSpreadMode) return;

    const container = layoutContainerRef?.current ?? bookViewportRef.current;
    if (!container) return;

    const refreshPhotobookDims = () => {
      if (flipPhaseRef.current !== 'idle') return;
      photobookPageDimsRef.current = null;
    };

    const observer = new ResizeObserver(refreshPhotobookDims);
    observer.observe(container);
    return () => observer.disconnect();
  }, [layoutContainerRef, photobookSpreadMode]);

  useLayoutEffect(() => {
    if (!pageSizePx || !bookSpreadRef.current) return;

    if (photobookSpreadMode && flipSession && flipPhase !== 'idle') {
      const interpolated = getFlipInterpolatedDimensions(
        flipSession.sourceSpreadIndex,
        flipSession.targetSpreadIndex,
        flipProgress,
      );
      if (interpolated) {
        const fixedPage = interpolated.pageW && interpolated.pageH
          ? { pageW: interpolated.pageW, pageH: interpolated.pageH }
          : undefined;
        const hingeLeftW = interpolated.isCoverHinge && interpolated.hingeLeftW != null
          ? interpolated.hingeLeftW
          : null;
        applySpreadDimensionsToDom(
          interpolated.spreadW,
          interpolated.spreadH,
          interpolated.layoutSingle,
          fixedPage,
          hingeLeftW,
        );
      }
      return;
    }

    const dims = getScaledSpreadDimensions(isSpreadSingleLayout(spreadIndex));
    if (dims) {
      const fixedPage = photobookSpreadMode && 'pageW' in dims
        ? { pageW: dims.pageW!, pageH: dims.pageH! }
        : undefined;
      applySpreadDimensionsToDom(dims.spreadW, dims.spreadH, dims.isSingle, fixedPage);
    }
  }, [
    applySpreadDimensionsToDom,
    flipPhase,
    flipProgress,
    flipSession,
    getFlipInterpolatedDimensions,
    getScaledSpreadDimensions,
    isSpreadSingleLayout,
    pageSizePx,
    photobookSpreadMode,
    spreadIndex,
  ]);

  const getPageWidth = useCallback(() => {
    if (photobookSpreadMode) {
      const base = getPhotobookBasePageDimensions();
      if (base) return Math.max(120, base.pageW);
    }

    const spread = bookSpreadRef.current;
    if (!spread) return 320;
    const layoutSingle = photobookSpreadMode && flipSession && flipPhase !== 'idle'
      ? (getFlipInterpolatedDimensions(
        flipSession.sourceSpreadIndex,
        flipSession.targetSpreadIndex,
        flipProgress,
      )?.layoutSingle ?? isSpreadSingleLayout(spreadIndex))
      : isSpreadSingleLayout(spreadIndex);
    if (layoutSingle) return Math.max(120, Math.round(spread.offsetWidth));
    return Math.max(120, Math.round(spread.offsetWidth / 2));
  }, [
    flipPhase,
    flipProgress,
    flipSession,
    getFlipInterpolatedDimensions,
    getPhotobookBasePageDimensions,
    isSpreadSingleLayout,
    photobookSpreadMode,
    spreadIndex,
  ]);

  const cancelFlipAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (animationTimeoutRef.current !== null) {
      window.clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  }, []);

  const completeFlip = useCallback((committed: boolean) => {
    cancelFlipAnimation();

    const session = flipSessionRef.current;
    if (!session) return;

    let nextSpreadIndex = spreadIndex;
    if (committed) {
      nextSpreadIndex = session.targetSpreadIndex;
      setSpreadIndex(nextSpreadIndex);
      pendingSpreadIndexRef.current = nextSpreadIndex;
    }

    const queuedTarget = queuedSpreadIndexRef.current;
    if (committed && queuedTarget !== null && queuedTarget !== nextSpreadIndex) {
      queuedSpreadIndexRef.current = null;
      const direction: 'next' | 'prev' = queuedTarget > nextSpreadIndex ? 'next' : 'prev';
      activePointerIdRef.current = null;
      launchFlipRef.current(nextSpreadIndex, queuedTarget, direction, CHAINED_FLIP_DURATION_MS);
      return;
    }

    queuedSpreadIndexRef.current = null;
    setFlipProgress(0);
    flipProgressRef.current = 0;
    setFlipPhase('idle');
    setFlipSession(null);
    setPendingSpreadIndex(null);
    activePointerIdRef.current = null;
    flipPhaseRef.current = 'idle';
    flipSessionRef.current = null;
    pendingSpreadIndexRef.current = null;
    animatingCommitRef.current = null;
    settlingShadowStrengthRef.current = 0;
    setSettleShadowFade(1);
  }, [cancelFlipAnimation, spreadIndex]);

  useEffect(() => {
    completeFlipRef.current = completeFlip;
  }, [completeFlip]);

  useEffect(() => () => cancelFlipAnimation(), [cancelFlipAnimation]);

  const runSettleShadowFade = useCallback((committed: boolean) => {
    const restingShadow = Math.max(
      settlingShadowStrengthRef.current,
      flipLiftShadowStrength(
        flipProgressRef.current,
        'animating',
        committed,
      ),
      0.18,
    );
    settlingShadowStrengthRef.current = restingShadow;
    setSettleShadowFade(1);
    setFlipPhase('settling');
    flipPhaseRef.current = 'settling';

    const startTime = performance.now();

    const finish = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (animationTimeoutRef.current !== null) {
        window.clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
      setSettleShadowFade(1);

      if (queuedSpreadIndexRef.current !== null) {
        completeFlipRef.current(committed);
        return;
      }

      completeFlipRef.current(committed);
    };

    const step = (now: number) => {
      if (flipPhaseRef.current !== 'settling') return;

      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / SETTLE_SHADOW_FADE_MS);
      setSettleShadowFade(1 - easeOutCubic(t));

      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
        return;
      }

      finish();
    };

    animationFrameRef.current = requestAnimationFrame(step);
    animationTimeoutRef.current = window.setTimeout(() => {
      if (flipPhaseRef.current !== 'settling') return;
      finish();
    }, SETTLE_SHADOW_FADE_MS + 80);
  }, []);

  const runFlipAnimation = useCallback((committed: boolean, duration: number) => {
    cancelFlipAnimation();

    const from = flipProgressRef.current;
    const target = committed ? 1 : 0;
    const startTime = performance.now();

    const complete = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (animationTimeoutRef.current !== null) {
        window.clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }

      flipProgressRef.current = target;
      setFlipProgress(target);
      settlingShadowStrengthRef.current = flipLiftShadowStrength(
        target,
        'animating',
        committed,
      );

      if (committed && queuedSpreadIndexRef.current !== null) {
        completeFlipRef.current(committed);
        return;
      }

      runSettleShadowFade(committed);
    };

    const tick = (now: number) => {
      if (flipPhaseRef.current !== 'animating') return;

      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const rawProgress = from + (target - from) * easeOutCubic(t);
      const progress = t < 1 ? normalizeProgress(rawProgress) : target;

      flipProgressRef.current = progress;
      setFlipProgress(progress);

      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      complete();
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    animationTimeoutRef.current = window.setTimeout(() => {
      if (flipPhaseRef.current !== 'animating') return;
      complete();
    }, duration + 120);
  }, [cancelFlipAnimation, runSettleShadowFade]);

  const beginFlipSession = useCallback((sourceSpreadIndex: number, targetSpreadIndex: number, direction: 'next' | 'prev') => {
    lockPhotobookPageDimensions();
    const session = { sourceSpreadIndex, targetSpreadIndex, direction };
    setFlipSession(session);
    flipSessionRef.current = session;
    setPendingSpreadIndex(targetSpreadIndex);
    pendingSpreadIndexRef.current = targetSpreadIndex;
  }, [lockPhotobookPageDimensions]);

  const animateFlipProgress = useCallback((committed: boolean, duration: number) => {
    animatingCommitRef.current = committed;
    setFlipPhase('animating');
    flipPhaseRef.current = 'animating';
    runFlipAnimation(committed, duration);
  }, [runFlipAnimation]);

  const goToSpread = useCallback((index: number, direction: 'next' | 'prev') => {
    const clamped = Math.max(0, Math.min(totalSpreads - 1, index));

    if (flipPhaseRef.current !== 'idle') {
      const currentNavTarget = queuedSpreadIndexRef.current
        ?? pendingSpreadIndexRef.current
        ?? spreadIndex;
      if (clamped === currentNavTarget) return;
      queuedSpreadIndexRef.current = clamped;
      setPendingSpreadIndex(clamped);
      pendingSpreadIndexRef.current = clamped;
      return;
    }

    if (clamped === spreadIndex) return;

    launchFlipRef.current(spreadIndex, clamped, direction, FLIP_DURATION_MS);
  }, [spreadIndex, totalSpreads]);

  useEffect(() => {
    launchFlipRef.current = (source, target, direction, duration) => {
      beginFlipSession(source, target, direction);
      setFlipProgress(0);
      flipProgressRef.current = 0;
      animateFlipProgress(true, duration);
    };
  }, [animateFlipProgress, beginFlipSession]);

  const goToSection = (sectionIndex: number) => {
    const start = sectionStarts[sectionIndex] ?? 0;
    let targetSpread = Math.floor(start / 2);
    if (singlePageMode) {
      targetSpread = start;
    } else if (photobookSpreadMode) {
      targetSpread = photobookSpreads.findIndex(
        (layout) => layout.leftIndex === start || layout.rightIndex === start,
      );
      if (targetSpread < 0) targetSpread = 0;
    }
    goToSpread(targetSpread, targetSpread > spreadIndex ? 'next' : 'prev');
  };

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>, direction: 'next' | 'prev') => {
    if (flipPhaseRef.current !== 'idle') return;
    const currentSpread = getSpreadPages(spreadIndex);
    const currentSpreadIsSingle = isSpreadSingleLayout(spreadIndex);
    const hasPrevPage = currentSpreadIsSingle ? Boolean(currentSpread.right) : Boolean(currentSpread.left);
    const hasNextPage = Boolean(currentSpread.right);

    if (direction === 'next' && (spreadIndex >= totalSpreads - 1 || !hasNextPage)) return;
    if (direction === 'prev' && (spreadIndex === 0 || !hasPrevPage)) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerIdRef.current = event.pointerId;
    dragStartXRef.current = event.clientX;
    const targetIndex = direction === 'next' ? spreadIndex + 1 : spreadIndex - 1;
    beginFlipSession(spreadIndex, targetIndex, direction);
    setFlipPhase('dragging');
    flipPhaseRef.current = 'dragging';
    setFlipProgress(0);
    flipProgressRef.current = 0;
  }, [beginFlipSession, getSpreadPages, isSpreadSingleLayout, spreadIndex, totalSpreads]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (flipPhaseRef.current !== 'dragging' || activePointerIdRef.current !== event.pointerId) return;

    const pageWidth = getPageWidth();
    const delta = flipSession?.direction === 'next'
      ? dragStartXRef.current - event.clientX
      : event.clientX - dragStartXRef.current;
    const progress = normalizeProgress(Math.max(0, Math.min(1, delta / pageWidth)));
    setFlipProgress(progress);
    flipProgressRef.current = progress;
  }, [flipSession?.direction, getPageWidth]);

  const handlePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (flipPhaseRef.current !== 'dragging' || activePointerIdRef.current !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activePointerIdRef.current = null;

    const progress = flipProgressRef.current;

    if (progress >= FLIP_COMMIT_THRESHOLD) {
      const remaining = Math.max(0.04, 1 - progress);
      animateFlipProgress(true, Math.max(MIN_SETTLE_MS, FLIP_DURATION_MS * remaining));
      return;
    }

    const remaining = Math.max(0.04, progress);
    animateFlipProgress(false, Math.max(MIN_SETTLE_MS, SNAP_BACK_DURATION_MS * remaining));
  }, [animateFlipProgress]);

  const { left: leftPage, right: rightPage } = getSpreadPages(spreadIndex);
  const currentSectionIndex = leftPage?.sectionIndex ?? rightPage?.sectionIndex ?? 0;

  const sectionTrackRef = useRef<HTMLDivElement>(null);
  const sectionStepsRowRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const connectorSpansRef = useRef<SectionConnectorSpan[]>([]);
  const sectionLayoutRef = useRef({ trackWidth: 0, stepGap: MIN_SECTION_STEP_GAP_PX });
  const [connectorSpans, setConnectorSpans] = useState<SectionConnectorSpan[]>([]);
  const [sectionTrackWidth, setSectionTrackWidth] = useState<number | null>(null);
  const [sectionStepGap, setSectionStepGap] = useState(MIN_SECTION_STEP_GAP_PX);

  useEffect(() => {
    dotRefs.current = sections.map(() => null);
  }, [sections]);

  const syncSectionStepsLayout = useCallback(() => {
    if (hideSectionNav) return;

    const viewport = bookViewportRef.current;
    const stepsRow = sectionStepsRowRef.current;
    if (!viewport || !stepsRow) return;

    const useExpandedLayout = window.matchMedia(SECTION_LAYOUT_MEDIA_QUERY).matches;

    if (!useExpandedLayout) {
      if (sectionLayoutRef.current.trackWidth !== 0) {
        sectionLayoutRef.current = { trackWidth: 0, stepGap: MIN_SECTION_STEP_GAP_PX };
        setSectionTrackWidth(null);
        setSectionStepGap(MIN_SECTION_STEP_GAP_PX);
      }
      return;
    }

    const targetWidth = Math.round(viewport.getBoundingClientRect().width);
    const stepElements = Array.from(
      stepsRow.querySelectorAll<HTMLElement>(`:scope > .${styles.sectionStep}`),
    );
    const stepsWidth = stepElements.reduce((total, step) => total + step.offsetWidth, 0);

    let gap = MIN_SECTION_STEP_GAP_PX;
    if (sections.length > 1 && stepsWidth < targetWidth) {
      gap = Math.max(
        MIN_SECTION_STEP_GAP_PX,
        Math.round((targetWidth - stepsWidth) / (sections.length - 1)),
      );
    }

    if (
      sectionLayoutRef.current.trackWidth === targetWidth
      && sectionLayoutRef.current.stepGap === gap
    ) {
      return;
    }

    sectionLayoutRef.current = { trackWidth: targetWidth, stepGap: gap };
    setSectionTrackWidth(targetWidth);
    setSectionStepGap(gap);
  }, [hideSectionNav, sections]);

  const updateConnectorSpans = useCallback(() => {
    if (hideSectionNav) {
      if (connectorSpansRef.current.length === 0) return;
      connectorSpansRef.current = [];
      setConnectorSpans([]);
      return;
    }

    const track = sectionTrackRef.current;
    if (!track || sections.length < 2) {
      if (connectorSpansRef.current.length === 0) return;
      connectorSpansRef.current = [];
      setConnectorSpans([]);
      return;
    }

    const trackRect = track.getBoundingClientRect();
    const spans: SectionConnectorSpan[] = [];

    for (let index = 0; index < sections.length - 1; index += 1) {
      const startDot = dotRefs.current[index];
      const endDot = dotRefs.current[index + 1];
      if (!startDot || !endDot) continue;

      const startRect = startDot.getBoundingClientRect();
      const endRect = endDot.getBoundingClientRect();
      const left = startRect.left + startRect.width / 2 - trackRect.left;
      const right = endRect.left + endRect.width / 2 - trackRect.left;

      if (right > left) {
        spans.push({
          left: Math.round(left),
          width: Math.round(right - left),
        });
      }
    }

    if (connectorSpansEqual(spans, connectorSpansRef.current)) return;

    connectorSpansRef.current = spans;
    setConnectorSpans(spans);
  }, [hideSectionNav, sections]);

  useLayoutEffect(() => {
    let frameId = 0;

    const scheduleLayoutSync = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        syncSectionStepsLayout();
        updateConnectorSpans();
      });
    };

    syncSectionStepsLayout();
    updateConnectorSpans();

    const track = sectionTrackRef.current;
    const stepsRow = sectionStepsRowRef.current;
    const viewport = bookViewportRef.current;
    const observer = new ResizeObserver(scheduleLayoutSync);

    if (track) observer.observe(track);
    if (stepsRow) observer.observe(stepsRow);
    if (viewport) observer.observe(viewport);

    window.addEventListener('resize', scheduleLayoutSync);
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener('resize', scheduleLayoutSync);
    };
  }, [syncSectionStepsLayout, updateConnectorSpans, currentSectionIndex]);

  const pageLabel = useMemo(() => {
    if (totalPages === 0) return '';
    const spreadIsSingle = isSpreadSingleLayout(spreadIndex);
    if (spreadIsSingle) {
      const pageNum = rightPage?.pageNumber ?? spreadIndex + 1;
      return `Page ${pageNum} of ${totalPages}`;
    }
    const leftNum = leftPage?.pageNumber;
    const rightNum = rightPage?.pageNumber;
    if (leftNum && rightNum) return `Page ${leftNum} & ${rightNum} of ${totalPages}`;
    if (leftNum) return `Page ${leftNum} of ${totalPages}`;
    if (rightNum) return `Page ${rightNum} of ${totalPages}`;
    return `Page 1 of ${totalPages}`;
  }, [isSpreadSingleLayout, leftPage, rightPage, spreadIndex, totalPages]);

  const displaySpreadIndex = useMemo(() => {
    if (!flipSession) return spreadIndex;
    return flipSession.sourceSpreadIndex;
  }, [flipSession, spreadIndex]);

  const displaySpread = getSpreadPages(displaySpreadIndex);
  const sourceSpread = flipSession ? getSpreadPages(flipSession.sourceSpreadIndex) : displaySpread;
  const targetSpread = flipSession ? getSpreadPages(flipSession.targetSpreadIndex) : null;
  const sourceSpreadIsSingle = isSpreadSingleLayout(flipSession?.sourceSpreadIndex ?? displaySpreadIndex);
  const displaySpreadIsSingle = isSpreadSingleLayout(displaySpreadIndex);
  const targetSpreadIsSingle = flipSession
    ? isSpreadSingleLayout(flipSession.targetSpreadIndex)
    : false;

  const { openingFromSingleCover, closingToSingleCover } = getCoverHingeFlipFlags(
    photobookSpreadMode,
    flipSession,
    flipPhase,
    isSpreadSingleLayout,
  );

  const layoutSpreadIsSingle = useMemo(() => {
    if (openingFromSingleCover || closingToSingleCover) {
      if (photobookSpreadMode && flipSession && flipPhase !== 'idle') {
        const interpolated = getFlipInterpolatedDimensions(
          flipSession.sourceSpreadIndex,
          flipSession.targetSpreadIndex,
          flipProgress,
        );
        if (interpolated) return interpolated.layoutSingle;
      }
      return openingFromSingleCover;
    }
    if (photobookSpreadMode && flipSession && flipPhase !== 'idle') {
      const interpolated = getFlipInterpolatedDimensions(
        flipSession.sourceSpreadIndex,
        flipSession.targetSpreadIndex,
        flipProgress,
      );
      if (interpolated) return interpolated.layoutSingle;
    }
    return displaySpreadIsSingle;
  }, [
    closingToSingleCover,
    displaySpreadIsSingle,
    flipPhase,
    flipProgress,
    flipSession,
    getFlipInterpolatedDimensions,
    openingFromSingleCover,
    photobookSpreadMode,
  ]);

  const coverHingeFlip = openingFromSingleCover || closingToSingleCover;

  const staticLeftPage = displaySpread.left;
  const staticRightPage = displaySpread.right;

  const isActiveFlip = flipSession !== null && flipPhase !== 'idle';
  const flipNext = isActiveFlip && flipSession?.direction === 'next' && Boolean(sourceSpread.right);
  const flipPrev = isActiveFlip && flipSession?.direction === 'prev'
    && Boolean(sourceSpreadIsSingle ? sourceSpread.right : sourceSpread.left);

  const showThreeDSheet = flipPhase === 'dragging' || flipPhase === 'animating' || flipPhase === 'settling';

  const hideStaticLeft = Boolean(
    (flipPrev && showThreeDSheet && !sourceSpreadIsSingle)
    || (openingFromSingleCover && showThreeDSheet),
  );
  const hideStaticRight = Boolean(
    (flipNext || (sourceSpreadIsSingle && flipPrev)) && showThreeDSheet,
  );

  const threeDProgress = flipProgress;
  const flipShadowStrength = flipPhase === 'settling'
    ? settlingShadowStrengthRef.current * settleShadowFade
    : flipLiftShadowStrength(
      threeDProgress,
      flipPhase,
      flipPhase === 'animating' ? animatingCommitRef.current : null,
    );
  const curlShadowScale = flipPhase === 'settling' ? settleShadowFade : 1;
  const flipDirection = flipSession?.direction ?? 'next';
  const flipFrontShadowStyle = {
    boxShadow: flipLiftBoxShadow(flipShadowStrength, flipDirection),
  };
  const flipBackShadowStyle = flipPhase === 'settling' ? flipFrontShadowStyle : undefined;

  const flipLiftZOffset = flipLiftZ(threeDProgress, flipPhase);
  const flipSheetTransform = flipSession?.direction === 'next'
    ? `translateZ(${flipLiftZOffset}px) rotateY(${-threeDProgress * 180}deg)`
    : `translateZ(${flipLiftZOffset}px) rotateY(${threeDProgress * 180}deg)`;

  const canDragNext = spreadIndex < totalSpreads - 1 && Boolean(displaySpread.right) && flipPhase === 'idle';
  const canDragPrev = spreadIndex > 0
    && Boolean(layoutSpreadIsSingle ? displaySpread.right : displaySpread.left)
    && flipPhase === 'idle';

  const revealLeftPage = flipPrev
    && showThreeDSheet
    && flipProgress > BASE_REVEAL_THRESHOLD
    ? (sourceSpreadIsSingle ? targetSpread?.right : targetSpread?.left)
    : null;

  const revealRightPage = (flipNext
    && showThreeDSheet
    && flipProgress > BASE_REVEAL_THRESHOLD
    ? targetSpread?.right
    : null)
    ?? (flipPrev
      && sourceSpreadIsSingle
      && showThreeDSheet
      && flipProgress > BASE_REVEAL_THRESHOLD
      ? targetSpread?.right
      : null);

  const renderRevealUnderlay = (page: FlatPage, side: PageSide) => (
    <div
      className={[
        styles.revealUnderlay,
        styles.pageContentLayer,
        side === 'left' ? styles.pageContentLayerLeft : styles.pageContentLayerRight,
      ].join(' ')}
    >
      <PageSurface side={side} page={page} loadImage />
    </div>
  );

  const renderFlipSheet = (direction: 'next' | 'prev') => {
    if (!showThreeDSheet) return null;

    const isNext = direction === 'next';
    const isCoverHingeOpen = openingFromSingleCover && isNext;
    const isCoverHingeClose = closingToSingleCover && !isNext;

    const frontPage = isCoverHingeClose
      ? sourceSpread.left
      : sourceSpreadIsSingle
        ? sourceSpread.right
        : (isNext ? sourceSpread.right : sourceSpread.left);
    const backPage = isCoverHingeOpen
      ? targetSpread?.left
      : isCoverHingeClose
        ? targetSpread?.right
        : sourceSpreadIsSingle
          ? targetSpread?.left
          : (targetSpreadIsSingle
            ? targetSpread?.right
            : (isNext ? targetSpread?.left : targetSpread?.right));
    const frontSide: PageSide = isCoverHingeClose
      ? 'left'
      : sourceSpreadIsSingle ? 'right' : (isNext ? 'right' : 'left');
    const backSide: PageSide = isCoverHingeClose
      ? 'left'
      : sourceSpreadIsSingle ? 'right' : (isNext ? 'left' : 'right');

    if (!frontPage) return null;

    return (
      <div
        ref={flipSheetRef}
        className={[
          styles.flipSheet,
          isNext ? styles.flipSheetNext : styles.flipSheetPrev,
          sourceSpreadIsSingle && !isCoverHingeClose ? styles.flipSheetSinglePage : '',
        ].join(' ')}
        data-testid="flip-sheet"
      >
        <div
          className={styles.flipSheetInner}
          style={{ transform: flipSheetTransform }}
        >
          <div
            className={[
              styles.flipFace,
              styles.flipFaceFront,
              frontSide === 'left' ? styles.flipFaceLeft : styles.flipFaceRight,
            ].join(' ')}
            style={flipFrontShadowStyle}
          >
            <PageSurface
              side={frontSide}
              page={frontPage}
              loadImage
              imageTestId={frontSide === 'right' ? 'flip-front-image' : 'flip-front-image-left'}
              overlay={(
                <div
                  className={styles.pageCurlShadow}
                  style={{ opacity: curlShadowOpacity(threeDProgress) * curlShadowScale }}
                />
              )}
            />
          </div>
          <div
            className={[
              styles.flipFace,
              styles.flipFaceBack,
              backSide === 'left' ? styles.flipFaceLeft : styles.flipFaceRight,
            ].join(' ')}
            style={flipBackShadowStyle}
          >
            <PageSurface
              side={backSide}
              page={backPage}
              loadImage
              overlay={(
                <div
                  className={styles.pageBackShade}
                  style={{ opacity: curlShadowOpacity(threeDProgress) * curlShadowScale }}
                />
              )}
            />
          </div>
        </div>
      </div>
    );
  };

  const hardcoverColor = normalizeFlipbookHardcoverColor(flipbook?.hardcoverColor);
  const hardcoverStyle = {
    background: flipbookHardcoverBackground(hardcoverColor),
    ['--hardcover-color' as string]: hardcoverColor,
  };

  if (!enabled) return null;

  const navigationSpreadIndex = pendingSpreadIndex ?? spreadIndex;
  const canGoPrev = navigationSpreadIndex > 0;
  const canGoNext = navigationSpreadIndex < totalSpreads - 1;

  const rootClassName = [
    styles.flipbookRoot,
    embedded ? styles.flipbookRootEmbedded : '',
    hideHardcover ? styles.flipbookRootNoHardcover : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      {!hideTitle ? <h2 className={styles.flipbookTitle}>Browse Your Book</h2> : null}
      <section className={styles.flipbookSection} aria-label="Digital flipbook">
        <div className={styles.flipbookLayout}>
        {!hideSectionNav ? (
        <div className={styles.sectionNav}>
          <div
            ref={sectionTrackRef}
            className={styles.sectionTrack}
            style={sectionTrackWidth ? { width: sectionTrackWidth } : undefined}
          >
            {sections.length > 1 && (
              <div className={styles.sectionConnectorsLayer} aria-hidden="true">
                {connectorSpans.map((span, index) => (
                  <span
                    key={`section-connector-${index}`}
                    className={`${styles.sectionConnector} ${index < currentSectionIndex ? styles.sectionConnectorActive : ''}`}
                    style={{ left: `${span.left}px`, width: `${span.width}px` }}
                  />
                ))}
              </div>
            )}
            <div
              ref={sectionStepsRowRef}
              className={styles.sectionStepsRow}
              style={{ ['--section-step-gap' as string]: `${sectionStepGap}px` }}
            >
              {sections.map((section, index) => {
                const isActive = index === currentSectionIndex;
                const isPast = index < currentSectionIndex;
                const isReached = isActive || isPast;

                return (
                  <div key={section.id} className={styles.sectionStep}>
                    <button
                      ref={(element) => {
                        dotRefs.current[index] = element;
                      }}
                      type="button"
                      className={`${styles.sectionDot} ${isReached ? styles.sectionDotActive : ''}`}
                      onClick={() => goToSection(index)}
                      aria-label={`Go to ${section.title}`}
                    />
                    <button
                      type="button"
                      className={`${styles.sectionLabel} ${isReached ? styles.sectionLabelActive : ''}`}
                      onClick={() => goToSection(index)}
                    >
                      {section.title}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        ) : null}

        <div className={`${styles.bookShell} ${isActiveFlip ? styles.bookShellFlipping : ''}`}>
          <button
            type="button"
            className={styles.bookNavLeft}
            onClick={() => goToSpread(navigationSpreadIndex - 1, 'prev')}
            disabled={!canGoPrev}
            aria-label="Previous pages"
          >
            <NavChevron direction="left" />
          </button>

          <div className={`${styles.bookViewportWrap} ${isActiveFlip ? styles.bookViewportWrapFlipping : ''}`}>
            <div className={`${styles.bookViewport} ${isActiveFlip ? styles.bookViewportFlipping : ''} ${hideHardcover ? styles.bookViewportNoHardcover : ''}`} ref={bookViewportRef}>
            <div className={`${styles.bookStage} ${isActiveFlip ? styles.bookStageFlipping : ''}`}>
              <div className={`${styles.bookAssembly} ${isActiveFlip ? styles.bookAssemblyFlipping : ''}`} ref={bookAssemblyRef}>
                {!hideHardcover ? (
                  <div className={styles.bookHardcover} style={hardcoverStyle} aria-hidden="true" />
                ) : null}
                <div
                  ref={bookSpreadRef}
                  className={[
                    styles.bookSpread,
                    layoutSpreadIsSingle ? styles.bookSpreadSinglePage : '',
                    coverHingeFlip && !layoutSpreadIsSingle ? styles.bookSpreadPhotobookHinge : '',
                    coverHingeFlip ? styles.bookSpreadCoverTransition : '',
                    isActiveFlip ? styles.bookSpreadFlipping : '',
                    flipPhase === 'dragging' ? styles.bookSpreadDragging : '',
                    flipNext ? styles.bookSpreadFlipNext : '',
                    flipPrev ? styles.bookSpreadFlipPrev : '',
                  ].filter(Boolean).join(' ')}
                  data-flip-phase={flipPhase}
                  data-flip-progress={flipProgress}
                >
                {!layoutSpreadIsSingle ? (
                <PageCell
                  side="left"
                  wrapperRef={leftPageRef}
                  draggable={canDragPrev}
                  turning={Boolean(flipPrev)}
                  onPointerDown={(event) => handlePointerDown(event, 'prev')}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerEnd}
                  onPointerCancel={handlePointerEnd}
                >
                  {revealLeftPage && renderRevealUnderlay(revealLeftPage, 'left')}
                  <PageSurface
                    side="left"
                    page={staticLeftPage}
                    hidden={hideStaticLeft}
                    loadImage={shouldLoadPage(staticLeftPage)}
                    surfaceRef={staticLeftSurfaceRef}
                  />
                  {flipPrev && !layoutSpreadIsSingle && renderFlipSheet('prev')}
                </PageCell>
                ) : null}

                <PageCell
                  side="right"
                  wrapperRef={rightPageRef}
                  draggable={layoutSpreadIsSingle ? (canDragNext || canDragPrev) : canDragNext}
                  turning={Boolean(flipNext || flipPrev)}
                  onPointerDown={(event) => {
                    if (layoutSpreadIsSingle && spreadIndex > 0 && event.clientX < event.currentTarget.getBoundingClientRect().left + event.currentTarget.offsetWidth / 2) {
                      handlePointerDown(event, 'prev');
                      return;
                    }
                    handlePointerDown(event, 'next');
                  }}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerEnd}
                  onPointerCancel={handlePointerEnd}
                >
                  {revealRightPage && renderRevealUnderlay(revealRightPage, 'right')}
                  <PageSurface
                    side="right"
                    page={staticRightPage}
                    hidden={hideStaticRight}
                    loadImage={shouldLoadPage(staticRightPage)}
                    surfaceRef={staticRightSurfaceRef}
                    imageRef={staticRightImageRef}
                    imageTestId="right-page-image"
                  />
                  {flipNext && renderFlipSheet('next')}
                  {flipPrev && layoutSpreadIsSingle && renderFlipSheet('prev')}
                </PageCell>
                </div>
              </div>

              <div className={styles.bookShadow} aria-hidden="true" />
            </div>
          </div>
          </div>

          <button
            type="button"
            className={styles.bookNavRight}
            onClick={() => goToSpread(navigationSpreadIndex + 1, 'next')}
            disabled={!canGoNext}
            aria-label="Next pages"
          >
            <NavChevron direction="right" />
          </button>
        </div>

        <p className={styles.pageIndicator}>{pageLabel}</p>
        </div>
      </section>
    </div>
  );
}
