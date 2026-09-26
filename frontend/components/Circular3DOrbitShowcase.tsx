'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import ModelViewer3D from './ModelViewer3D';
import ScrambleText from './ScrambleText';
import PixelCubeModelTransition from './PixelCubeModelTransition';
import HorizontalProductGalleryModal, { TriggerRect } from './HorizontalProductGalleryModal';
import styles from './Circular3DOrbitShowcase.module.css';

interface ShowcaseItem {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  tag: string;
  modelPath: string;
  texturePath: string;
}

const ITEMS: ShowcaseItem[] = [
  {
    id: 'item-1',
    number: '01',
    title: 'Fashion Silhouette',
    subtitle: 'Avant-Garde Tailored Form · Runway Specimen',
    tag: 'Autumn / Winter 2026',
    modelPath: '/fashion+model+3d+model-reduced (1).glb',
    texturePath: '',
  },
  {
    id: 'item-2',
    number: '02',
    title: 'Evening Couture',
    subtitle: 'Sculptural Evening Draping · Haute Couture Edition',
    tag: 'Collector Series',
    modelPath: '/evening+dress+3d+model.glb',
    texturePath: '',
  },
  {
    id: 'item-3',
    number: '03',
    title: 'Dahlia Signature Archetype',
    subtitle: 'Signature Sculptural Form · Master Edition',
    tag: 'Heritage Archive',
    modelPath: '/realone.glb',
    texturePath: '',
  },
  {
    id: 'item-4',
    number: '04',
    title: 'Maison Mannequin',
    subtitle: 'Precision Tailored Form · Collector Edition',
    tag: 'Collector Series',
    modelPath: '/fashion+model+3d+model-reduced (1).glb',
    texturePath: '',
  },
  {
    id: 'item-5',
    number: '05',
    title: 'Runway Form',
    subtitle: 'Architectural Draping · Archive 2026',
    tag: 'Runway Archive',
    modelPath: '/fashion+model+3d+model-reduced (1).glb',
    texturePath: '',
  },
  {
    id: 'item-6',
    number: '06',
    title: 'House Of Dahlia Relic',
    subtitle: 'Timeless Sculptural Presence · Signature Specimen',
    tag: 'Maison Exclusive',
    modelPath: '/fashion+model+3d+model-reduced (1).glb',
    texturePath: '',
  },
  {
    id: 'item-7',
    number: '07',
    title: 'Velvet Silhouette',
    subtitle: 'Fluid Tailored Anatomy · Edition 07',
    tag: 'Runway Archive',
    modelPath: '/fashion+model+3d+model-reduced (1).glb',
    texturePath: '',
  },
  {
    id: 'item-8',
    number: '08',
    title: 'Sovereign Form',
    subtitle: 'Grand Proportion & Minimalist Drape',
    tag: 'Limited Haute Couture',
    modelPath: '/pink+sequin+dress+3d+model.glb',
    texturePath: '',
  },
  {
    id: 'item-9',
    number: '09',
    title: 'Celestial Mannequin',
    subtitle: 'Kinetic Geometry & Haute Couture Line',
    tag: 'Atelier Capsule',
    modelPath: '/fashion+model+3d+model-reduced (1).glb',
    texturePath: '',
  },
  {
    id: 'item-10',
    number: '10',
    title: 'Elysian Sculpture',
    subtitle: 'Masterpiece Monolith · Eternal Specimen',
    tag: 'Permanent Collection',
    modelPath: '/fashion+model+3d+model-reduced (1).glb',
    texturePath: '',
  },
];

// Smoothstep Hermite curve for silky continuous scroll transitions
function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

// Kinetic Text Component: Each letter cuts and tracks directly with scroll position
function ScrollDrivenKineticText({
  text,
  dist,
  className,
}: {
  text: string;
  dist: number;
  className?: string;
}) {
  const words = text.split(' ');
  let charCounter = 0;
  const totalChars = text.length || 1;

  return (
    <span className={className}>
      {words.map((word, wIdx) => {
        const chars = Array.from(word);
        return (
          <span key={wIdx} className={styles.kineticWord}>
            {chars.map((char, cIdx) => {
              const charRatio = (charCounter / totalChars) * 0.25;
              charCounter++;

              let charY = 0;
              if (dist > 0) {
                const effectiveD = Math.max(0, dist - charRatio);
                charY = effectiveD * 38;
              } else if (dist < 0) {
                const effectiveD = Math.min(0, dist + charRatio);
                charY = effectiveD * 38;
              }

              return (
                <span key={cIdx} className={styles.charMask}>
                  <span
                    className={styles.charCutScroll}
                    style={{
                      transform: `translate3d(0, ${charY.toFixed(2)}px, 0)`,
                    }}
                  >
                    {char}
                  </span>
                </span>
              );
            })}
            {wIdx < words.length - 1 && <span className={styles.spaceMask}>&nbsp;</span>}
          </span>
        );
      })}
    </span>
  );
}

export default function Circular3DOrbitShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardInfoRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const shopBtnRef = useRef<HTMLButtonElement>(null);
  const mobileArrowsRef = useRef<HTMLDivElement>(null);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Layout mode state: 0 = Horizontal Lineup (Initial Phase 2), 1 = Vertical Centered Carousel
  const [layoutProgress, setLayoutProgress] = useState(0);
  const [isVerticalMode, setIsVerticalMode] = useState(false);
  const [virtualIndex, setVirtualIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [uiVisible, setUiVisible] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400);
  const [isProduct2GalleryOpen, setIsProduct2GalleryOpen] = useState(false);
  const [galleryTriggerRect, setGalleryTriggerRect] = useState<TriggerRect | null>(null);

  // First-time prompt cycle state: cycles between "Our Collection" and "Click on any model to view" every 4s
  const [hasClickedModel, setHasClickedModel] = useState(false);
  const [hintToggle, setHintToggle] = useState(false);

  // 360 Drag Prompt: permanently dismissed for session once user tries to drag a 3D model
  const [hasDismissed360Forever, setHasDismissed360Forever] = useState(false);
  const [isSectionInView, setIsSectionInView] = useState(true);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !containerRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        setIsSectionInView(entries[0]?.isIntersecting ?? true);
      },
      { threshold: 0.01 }
    );
    io.observe(containerRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (hasClickedModel) return;

    const interval = setInterval(() => {
      setHintToggle((prev) => !prev);
    }, 4000);

    return () => clearInterval(interval);
  }, [hasClickedModel]);

  // Distinct orbital starting points for each model rotating in the same direction
  const ROTATION_OFFSETS = [
    0,                     // Model 1
    (Math.PI * 2) * 0.35,  // Model 2
    (Math.PI * 2) * 0.72,  // Model 3
    (Math.PI * 2) * 0.18,  // Model 4
    (Math.PI * 2) * 0.85,  // Model 5
    (Math.PI * 2) * 0.45,  // Model 6
    (Math.PI * 2) * 0.60,  // Model 7
    (Math.PI * 2) * 0.12,  // Model 8
    (Math.PI * 2) * 0.92,  // Model 9
    (Math.PI * 2) * 0.28,  // Model 10
  ];

  // Curated product codes for horizontal hover indicator
  const PRODUCT_CODES = [
    'Product No. 324',
    'Product No. 812',
    'Product No. 409',
    'Product No. 655',
    'Product No. 190',
    'Product No. 488',
    'Product No. 774',
    'Product No. 021',
    'Product No. 916',
    'Product No. 543',
  ];

  // Track scroll entry from Phase 1 into Phase 2 for statement & 3D model scale entrance
  const [introProgress, setIntroProgress] = useState(0);

  // Animation values tracked by GSAP
  const animRef = useRef({ layout: 0, virtualIndex: 0, introProgress: 0 });
  const isTransitioningRef = useRef(false);
  const isVerticalModeRef = useRef(false);
  isVerticalModeRef.current = isVerticalMode;
  const isGalleryOpenRef = useRef(false);
  isGalleryOpenRef.current = isProduct2GalleryOpen;
  const progressRef = useRef({ current: 0, target: 0 });

  // GSAP quickTo setters for buttery 60fps/120fps fluid scroll tracking
  const quickVirtualIndexRef = useRef<((value: number) => void) | null>(null);
  const quickIntroRef = useRef<((value: number) => void) | null>(null);

  useEffect(() => {
    quickVirtualIndexRef.current = gsap.quickTo(animRef.current, 'virtualIndex', {
      duration: 0.65,
      ease: 'power3.out',
      onUpdate: () => {
        setVirtualIndex(animRef.current.virtualIndex);
      },
    });

    quickIntroRef.current = gsap.quickTo(animRef.current, 'introProgress', {
      duration: 0.45,
      ease: 'power2.out',
      onUpdate: () => {
        setIntroProgress(animRef.current.introProgress);
      },
    });
  }, []);

  useEffect(() => {
    const handleScrollIntro = () => {
      if (isVerticalModeRef.current) return;
      const scrollY = window.scrollY || window.pageYOffset;
      const vh = window.innerHeight || 800;

      const phase2 = document.getElementById('phase-2-section');
      const p2Top = phase2 ? phase2.offsetTop : vh;

      // Start statement entrance easily as user starts scrolling and pixel squares emerge
      const startScroll = Math.max(0, p2Top - vh * 0.85);
      const scrollRange = vh * 1.95;

      const progress = Math.max(0, Math.min(1, (scrollY - startScroll) / scrollRange));
      if (quickIntroRef.current) {
        quickIntroRef.current(progress);
      } else {
        setIntroProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScrollIntro, { passive: true });
    window.addEventListener('resize', handleScrollIntro);
    handleScrollIntro();

    return () => {
      window.removeEventListener('scroll', handleScrollIntro);
      window.removeEventListener('resize', handleScrollIntro);
    };
  }, []);

  const totalItems = ITEMS.length;
  const SCROLL_SCALE = 0.88;

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth || 1400);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dwell plateau curve: models linger in center before smoothly transitioning to the next model
  const applyDwellCurve = (rawIndex: number, total: number, dwellRatio = 0.36): number => {
    if (rawIndex <= 0) return 0;
    if (rawIndex >= total - 1) return total - 1;

    const base = Math.floor(rawIndex);
    const frac = rawIndex - base;

    if (frac <= dwellRatio) {
      const t = frac / dwellRatio;
      return base + 0.5 * Math.pow(t, 2) * 0.06;
    } else if (frac >= 1 - dwellRatio) {
      const t = (1 - frac) / dwellRatio;
      return base + 1 - 0.5 * Math.pow(t, 2) * 0.06;
    } else {
      const p = (frac - dwellRatio) / (1 - 2 * dwellRatio);
      const smooth = p * p * (3 - 2 * p);
      return base + 0.03 + smooth * 0.94;
    }
  };

  // Continuous scroll-driven vertical model navigation with stopping dwell time (Desktop only)
  useEffect(() => {
    if (!isVerticalMode) return;

    const handleVerticalScroll = () => {
      if (!containerRef.current || isTransitioningRef.current || windowWidth <= 768) return;
      const scrollY = window.scrollY || window.pageYOffset;
      const vh = window.innerHeight || 800;
      const phase2El = document.getElementById('phase-2-section');
      const p2Top = phase2El ? phase2El.offsetTop : vh;
      const p2Height = containerRef.current.offsetHeight || vh * 7.2;
      const scrollableDistance = p2Height - vh;

      if (scrollableDistance <= 0) return;

      const rawProgress = (scrollY - p2Top) / scrollableDistance;
      const progress = Math.max(0, Math.min(1, rawProgress));

      const rawVirtual = progress * (totalItems - 1);
      const targetVirtualIndex = applyDwellCurve(rawVirtual, totalItems, 0.36);
      const newActiveIndex = Math.min(totalItems - 1, Math.max(0, Math.round(targetVirtualIndex)));

      setActiveIndex(newActiveIndex);

      gsap.to(animRef.current, {
        virtualIndex: targetVirtualIndex,
        duration: 0.32,
        ease: 'power1.out',
        overwrite: 'auto',
        onUpdate: () => {
          setVirtualIndex(animRef.current.virtualIndex);
        },
      });
    };

    window.addEventListener('scroll', handleVerticalScroll, { passive: true });
    window.addEventListener('resize', handleVerticalScroll);

    return () => {
      window.removeEventListener('scroll', handleVerticalScroll);
      window.removeEventListener('resize', handleVerticalScroll);
    };
  }, [isVerticalMode, totalItems, windowWidth]);

  // Prevent vertical page scrolling on mobile when in vertical 3D mode (allows 3D rotation, navigation by arrow only)
  useEffect(() => {
    const isMobile = windowWidth <= 768;
    if (isMobile && isVerticalMode && !isProduct2GalleryOpen) {
      if ((window as any).lenis) {
        (window as any).lenis.stop();
      }

      const preventTouchScroll = (e: TouchEvent) => {
        const target = e.target as HTMLElement;
        // Allow clicking buttons
        if (target && (target.tagName === 'BUTTON' || target.closest('button'))) {
          return;
        }
        if (e.cancelable) {
          e.preventDefault();
        }
      };

      window.addEventListener('touchmove', preventTouchScroll, { passive: false });

      return () => {
        if ((window as any).lenis) {
          (window as any).lenis.start();
        }
        window.removeEventListener('touchmove', preventTouchScroll);
      };
    }
  }, [isVerticalMode, windowWidth, isProduct2GalleryOpen]);

  // Programmatic navigation to a specific model index (Mobile arrows & card clicks)
  const goToModel = (targetIndex: number) => {
    if (isTransitioningRef.current) return;
    const clampedIndex = Math.max(0, Math.min(totalItems - 1, targetIndex));
    if (clampedIndex === activeIndex) return;

    setActiveIndex(clampedIndex);
    isTransitioningRef.current = true;

    const isMobile = windowWidth <= 768;
    if (!isMobile) {
      const vh = window.innerHeight || 800;
      const phase2 = document.getElementById('phase-2-section');
      const p2Top = phase2 ? phase2.offsetTop : vh;
      const scrollableDistance = vh * 6.2;
      const targetTop = p2Top + (clampedIndex / (totalItems - 1)) * scrollableDistance;

      window.scrollTo({ top: targetTop, behavior: 'instant' as any });
      if ((window as any).lenis) {
        (window as any).lenis.scrollTo(targetTop, { immediate: true });
      }
    }

    gsap.killTweensOf(animRef.current);
    gsap.to(animRef.current, {
      virtualIndex: clampedIndex,
      duration: 0.65,
      ease: 'power3.out',
      onUpdate: () => {
        setVirtualIndex(animRef.current.virtualIndex);
      },
      onComplete: () => {
        isTransitioningRef.current = false;
      },
    });
  };

  // Toggle handler: switches between horizontal lineup and vertical carousel with smooth reverse animation
  const toggleLayoutMode = () => {
    if (isTransitioningRef.current) return;
    setHoveredIndex(null);
    isTransitioningRef.current = true;
    gsap.killTweensOf(animRef.current);

    if (!isVerticalMode) {
      // HORIZONTAL -> VERTICAL
      setIsVerticalMode(true);

      if (cardInfoRef.current) gsap.set(cardInfoRef.current, { opacity: 0 });
      if (indicatorRef.current) gsap.set(indicatorRef.current, { opacity: 0 });
      if (toggleBtnRef.current) gsap.set(toggleBtnRef.current, { opacity: 0 });

      const tl = gsap.timeline({
        onComplete: () => {
          setHoveredIndex(null);
          setUiVisible(true);

          const vh = window.innerHeight || 800;
          const phase2 = document.getElementById('phase-2-section');
          const p2Top = phase2 ? phase2.offsetTop : vh;
          const scrollableDistance = vh * 6.2;
          const targetTop = p2Top + (activeIndex / (totalItems - 1)) * scrollableDistance;

          window.scrollTo({ top: targetTop, behavior: 'instant' as any });
          if ((window as any).lenis) {
            (window as any).lenis.scrollTo(targetTop, { immediate: true });
          }

          isTransitioningRef.current = false;
        },
      });

      // Morph 3D models to vertical center column
      tl.to(
        animRef.current,
        {
          layout: 1.0,
          virtualIndex: activeIndex,
          duration: 1.25,
          ease: 'power3.inOut',
          onUpdate: () => {
            setLayoutProgress(animRef.current.layout);
            setVirtualIndex(animRef.current.virtualIndex);
          },
        },
        0
      );

      // ONLY fade in left text and UI after models have cleared the left area
      if (cardInfoRef.current && indicatorRef.current) {
        tl.to(
          [cardInfoRef.current, indicatorRef.current],
          { opacity: 1, duration: 0.45, ease: 'power2.out' },
          0.85
        );
      }
      if (toggleBtnRef.current && shopBtnRef.current) {
        tl.to(
          [toggleBtnRef.current, shopBtnRef.current],
          { opacity: 1, duration: 0.45, ease: 'power2.out' },
          0.85
        );
      }
      if (mobileArrowsRef.current) {
        tl.to(
          mobileArrowsRef.current,
          { opacity: 1, duration: 0.45, ease: 'power2.out' },
          0.85
        );
      }
    } else {
      // VERTICAL -> HORIZONTAL

      // Ensure introProgress is locked to 1.0 so statement text is completely invisible
      animRef.current.introProgress = 1.0;
      setIntroProgress(1.0);
      if (quickIntroRef.current) {
        quickIntroRef.current(1.0);
      }

      const tl = gsap.timeline({
        onComplete: () => {
          setIsVerticalMode(false);
          setHoveredIndex(null);
          setUiVisible(false);
          isTransitioningRef.current = false;

          const vh = window.innerHeight || 800;
          const phase2 = document.getElementById('phase-2-section');
          const p2Top = phase2 ? phase2.offsetTop : vh;
          // Target position where horizontal models are 100% visible and statement text is fully dissolved
          const targetTop = p2Top + vh * 1.45;

          animRef.current.introProgress = 1.0;
          setIntroProgress(1.0);
          if (quickIntroRef.current) {
            quickIntroRef.current(1.0);
          }

          window.scrollTo({ top: targetTop, behavior: 'instant' as any });
          if ((window as any).lenis) {
            (window as any).lenis.scrollTo(targetTop, { immediate: true });
          }
        },
      });

      if (cardInfoRef.current && indicatorRef.current) {
        tl.to(
          [cardInfoRef.current, indicatorRef.current],
          { opacity: 0, duration: 0.35, ease: 'power2.in' },
          0
        );
      }
      if (toggleBtnRef.current && shopBtnRef.current) {
        tl.to(
          [toggleBtnRef.current, shopBtnRef.current],
          { opacity: 0, duration: 0.25, ease: 'power2.in' },
          0
        );
      }
      if (mobileArrowsRef.current) {
        tl.to(
          mobileArrowsRef.current,
          { opacity: 0, duration: 0.25, ease: 'power2.in' },
          0
        );
      }

      tl.to(
        animRef.current,
        {
          layout: 0.0,
          duration: 1.25,
          ease: 'power3.inOut',
          onUpdate: () => {
            setLayoutProgress(animRef.current.layout);
            setVirtualIndex(animRef.current.virtualIndex);
          },
        },
        0.15
      );
    }
  };

  // Hover handler in horizontal mode
  const handleModelHover = (index: number) => {
    if (!isVerticalMode && !isTransitioningRef.current) {
      setHoveredIndex(index);
    }
  };

  // Click handler: smoothly turns horizontal line into vertical stack centered on clicked model
  const handleModelClick = (clickedIndex: number) => {
    setHoveredIndex(null);
    setHasClickedModel(true);

    if (!isVerticalMode) {
      // HORIZONTAL -> VERTICAL on click
      setIsVerticalMode(true);
      setActiveIndex(clickedIndex);
      isTransitioningRef.current = true;

      if (cardInfoRef.current) gsap.set(cardInfoRef.current, { opacity: 0 });
      if (indicatorRef.current) gsap.set(indicatorRef.current, { opacity: 0 });
      if (toggleBtnRef.current) gsap.set(toggleBtnRef.current, { opacity: 0 });
      if (shopBtnRef.current) gsap.set(shopBtnRef.current, { opacity: 0 });
      if (mobileArrowsRef.current) gsap.set(mobileArrowsRef.current, { opacity: 0 });

      // Kill any running tweens
      gsap.killTweensOf(animRef.current);

      animRef.current.introProgress = 1.0;
      setIntroProgress(1.0);
      if (quickIntroRef.current) {
        quickIntroRef.current(1.0);
      }

      const tl = gsap.timeline({
        onComplete: () => {
          setUiVisible(true);

          const isMobile = windowWidth <= 768;
          const vh = window.innerHeight || 800;
          const phase2 = document.getElementById('phase-2-section');
          const p2Top = phase2 ? phase2.offsetTop : vh;
          const scrollableDistance = vh * 6.2;
          const targetTop = isMobile
            ? p2Top + vh * 1.45
            : p2Top + (clickedIndex / (totalItems - 1)) * scrollableDistance;

          window.scrollTo({ top: targetTop, behavior: 'instant' as any });
          if ((window as any).lenis) {
            (window as any).lenis.scrollTo(targetTop, { immediate: true });
          }

          isTransitioningRef.current = false;
        },
      });

      // 1. Smoothly morph layout from horizontal (0) to vertical (1) centered directly on clickedIndex
      tl.to(
        animRef.current,
        {
          layout: 1.0,
          virtualIndex: clickedIndex,
          duration: 1.25,
          ease: 'power3.inOut',
          onUpdate: () => {
            setLayoutProgress(animRef.current.layout);
            setVirtualIndex(animRef.current.virtualIndex);
          },
        },
        0
      );

      // 2. ONLY reveal Left Card Info, Right Indicator, and Toggle Button AFTER models clear the left
      if (cardInfoRef.current && indicatorRef.current) {
        tl.to(
          [cardInfoRef.current, indicatorRef.current],
          { opacity: 1, duration: 0.45, ease: 'power2.out' },
          0.85
        );
      }
      if (toggleBtnRef.current && shopBtnRef.current) {
        tl.to(
          [toggleBtnRef.current, shopBtnRef.current],
          { opacity: 1, duration: 0.45, ease: 'power2.out' },
          0.85
        );
      }
      if (mobileArrowsRef.current) {
        tl.to(
          mobileArrowsRef.current,
          { opacity: 1, duration: 0.45, ease: 'power2.out' },
          0.85
        );
      }
    } else {
      // In vertical mode: clicking any other model centers it
      if (clickedIndex !== activeIndex) {
        goToModel(clickedIndex);
      }
    }
  };

  // Horizontal spacing calculation for full line distribution
  const centerIndexOffset = (totalItems - 1) / 2;
  const horizontalSpacing = Math.min(180, Math.max(120, (windowWidth * 0.86) / totalItems));

  const isMobile = windowWidth <= 768;

  // Statement text animation values ("Wear what feels like yours")
  // 1. Easy & early fade in as user begins scrolling from Phase 1 (0.00 -> 0.07)
  const fadeIn = smoothstep(0.00, 0.07, introProgress);
  // 2. Dissolve phase: On desktop, text dissolves before models arrive (0.68 -> 0.84); on mobile, text stays with models
  const dissolveProgress = isMobile ? 0 : smoothstep(0.68, 0.84, introProgress);

  // Opacity remains visible together with models in mobile horizontal mode
  const textOpacity = isMobile ? fadeIn : fadeIn * (1.0 - dissolveProgress);
  const statementOpacity = isVerticalMode ? 0 : Number(textOpacity.toFixed(3));
  const statementBlur = isMobile ? 0 : dissolveProgress * 4.5;

  // 3D Models emergence: on mobile, models emerge together with the statement text (0.00 -> 0.10)
  const modelsIn = isMobile
    ? smoothstep(0.00, 0.10, introProgress)
    : smoothstep(0.84, 1.00, introProgress);
  const horizontalScale = 0.38; // Constant scale: no scale up/down distortion during scroll
  const horizontalOpacity = isMobile ? modelsIn : Math.pow(modelsIn, 1.25);
  const horizontalBlur = isMobile ? 0 : (1 - modelsIn) * 8;

  const hasEnteredPhase2 = modelsIn > 0.005 || isVerticalMode;

  return (
    <div
      ref={containerRef}
      className={`${styles.orbitWrapper} ${isVerticalMode ? styles.orbitWrapperVertical : ''}`}
    >
      {/* Sticky viewport stage */}
      <div className={styles.stickyStage}>
        {/* 0. Statement Entrance Text: "Wear what feels like yours" (unified phrase in center) */}
        {!isVerticalMode && statementOpacity > 0.005 && (
          <div
            className={styles.introStatementWrap}
            style={{
              opacity: statementOpacity,
              transform: 'translate3d(-50%, -50%, 0)',
              filter: statementBlur > 0.05 ? `blur(${statementBlur.toFixed(1)}px)` : 'none',
            }}
            aria-hidden={statementOpacity < 0.1}
          >
            <h2 className={styles.introStatementHeading}>
              Wear what feels like yours
            </h2>
          </div>
        )}

        {/* 1. Left Center Static Info Card (hidden initially in horizontal mode, reveals on click) */}
        <div
          ref={cardInfoRef}
          className={styles.cardInfo}
          style={{
            pointerEvents: isVerticalMode && uiVisible ? 'auto' : 'none',
          }}
        >
          <div className={styles.textStack}>
            {ITEMS.map((item, index) => {
              const textD = index - virtualIndex;
              const isTextVisible = isVerticalMode && Math.abs(textD) <= 1.0;

              const textY = textD * 28;
              const textOpacity = Math.max(0, Math.min(1, 1 - Math.pow(Math.abs(textD) / 0.62, 1.4)));
              const textBlur = Math.min(14, Math.pow(Math.abs(textD), 1.2) * 16);

              const isMobile = windowWidth <= 768;
              const textTransform = isMobile
                ? `translate3d(0, ${textY.toFixed(2)}px, 0)`
                : `translate3d(0, calc(-50% + ${textY.toFixed(2)}px), 0)`;

              return (
                <div
                  key={item.id}
                  className={styles.textBlock}
                  style={{
                    transform: textTransform,
                    opacity: isTextVisible ? Number(textOpacity.toFixed(3)) : 0,
                    filter: textBlur > 0.08 ? `blur(${textBlur.toFixed(2)}px)` : 'none',
                    visibility: isTextVisible ? 'visible' : 'hidden',
                    pointerEvents: Math.abs(textD) < 0.25 ? 'auto' : 'none',
                  }}
                >
                  <h2 className={styles.itemTitle}>
                    <ScrollDrivenKineticText text={item.title} dist={textD} />
                  </h2>
                  <p className={styles.itemSubtitle}>
                    <ScrollDrivenKineticText text={item.subtitle} dist={textD} />
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. 3D Model Items: Horizontal line initially, GSAP morphs to Vertical Center on click */}
        <div className={styles.itemsLayer}>
          {ITEMS.map((item, index) => {
            // Distance from focus in vertical layout
            const d = index - virtualIndex;
            const isFocused = Math.abs(d) < 0.25;

            // --- Horizontal Layout Coordinates (layoutProgress = 0) ---
            const isMobile = windowWidth <= 768;
            let hOffsetPx: number;
            let hOffsetYVh: number;
            const hScale = isMobile ? 0.265 : horizontalScale;

            if (isMobile) {
              // 2 Rows on mobile: Row 0 has 5 models (0..4), Row 1 has 5 models (5..9)
              const rowIndex = Math.floor(index / 5); // 0 for top row, 1 for bottom row
              const colIndex = index % 5;             // 0, 1, 2, 3, 4
              const colCenterOffset = 2;              // Centered at middle index 2
              const mobileColSpacing = Math.min(74, Math.max(54, (windowWidth * 0.94) / 5));

              hOffsetPx = (colIndex - colCenterOffset) * mobileColSpacing;
              // Vertical row gap with +5px spacing
              hOffsetYVh = rowIndex === 0 ? -9.4 : 9.4;
            } else {
              hOffsetPx = (index - centerIndexOffset) * horizontalSpacing;
              hOffsetYVh = 0;
            }

            const hOpacity = horizontalOpacity;
            const hBlur = horizontalBlur;

            // --- Vertical Layout Coordinates (layoutProgress = 1) ---
            const vOffsetPx = 0;
            const vCenterOffsetVh = isMobile ? -13.5 : 0;
            const vOffsetYVh = vCenterOffsetVh + d * 60;
            const vScale = Math.max(0.40, 0.98 - Math.abs(d) * 0.28); // Focused model scales up to full 0.98 in vertical mode
            const vOpacity = Math.max(0, 1.0 - Math.pow(Math.abs(d) / 0.95, 1.35));
            const vBlur = Math.min(16, Math.pow(Math.abs(d), 1.2) * 14);

            // --- Interpolate smoothly using layoutProgress (0 -> 1) ---
            const currentXPx = gsap.utils.interpolate(hOffsetPx, vOffsetPx, layoutProgress);
            const currentYVh = gsap.utils.interpolate(hOffsetYVh, vOffsetYVh, layoutProgress);
            const currentScale = gsap.utils.interpolate(hScale, vScale, layoutProgress);
            const currentOpacity = gsap.utils.interpolate(hOpacity, vOpacity, layoutProgress);
            const currentBlur = gsap.utils.interpolate(hBlur, vBlur, layoutProgress);

            const isVisible = currentOpacity > 0.01;
            const zIndex = isFocused ? 50 : Math.max(1, Math.round((2.0 - Math.abs(d)) * 20));

            return (
              <div
                key={item.id}
                className={`${styles.orbitCard} ${!isVerticalMode ? styles.horizontalCard : ''}`}
                style={{
                  transform: `translate3d(calc(-50% + ${currentXPx.toFixed(1)}px), calc(-50% + ${currentYVh.toFixed(2)}vh), 0px) scale(${currentScale.toFixed(3)})`,
                  opacity: isVisible ? Number(currentOpacity.toFixed(3)) : 0,
                  filter: !isMobile && currentBlur > 0.05 ? `blur(${currentBlur.toFixed(1)}px)` : 'none',
                  zIndex: zIndex,
                  visibility: isVisible ? 'visible' : 'hidden',
                  pointerEvents: !isVerticalMode ? (modelsIn > 0.15 ? 'auto' : 'none') : 'auto',
                  cursor: !isVerticalMode ? 'pointer' : 'default',
                }}
                onClick={!isVerticalMode ? () => handleModelClick(index) : undefined}
              >
                {/* Click & Hover trigger overlay for seamless hover scramble & click response */}
                {(!isVerticalMode || !isFocused) && (isVerticalMode || modelsIn > 0.15) && (
                  <button
                    type="button"
                    className={styles.cardClickTrigger}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleModelClick(index);
                    }}
                    onMouseEnter={() => handleModelHover(index)}
                    onMouseLeave={() => {
                      if (!isVerticalMode) setHoveredIndex((prev) => (prev === index ? null : prev));
                    }}
                    aria-label={`Select 3D model ${item.title}`}
                  />
                )}

                {/* 3D Model Instance with Pixelated Cubic Transition and Individual Starting Angle */}
                {(() => {
                  let isModelActive = false;
                  if (isSectionInView) {
                    if (!isVerticalMode) {
                      isModelActive = hasEnteredPhase2;
                    } else {
                      if (isMobile) {
                        isModelActive = index === activeIndex || Math.abs(index - virtualIndex) < 0.85;
                      } else {
                        isModelActive = Math.abs(index - virtualIndex) < 1.8;
                      }
                    }
                  }

                  return (
                    <div
                      className={styles.modelContainerWrap}
                      onPointerDown={() => setHasDismissed360Forever(true)}
                      onTouchStart={() => setHasDismissed360Forever(true)}
                      onMouseDown={() => setHasDismissed360Forever(true)}
                    >
                      <PixelCubeModelTransition
                        modelIndex={index}
                        triggerEntry={hasEnteredPhase2}
                      >
                        <ModelViewer3D
                          modelPath={item.modelPath}
                          texturePath={item.texturePath}
                          autoRotateSpeed={10.0}
                          initialRotation={ROTATION_OFFSETS[index] || 0}
                          sunToLeft={false}
                          isVisible={isModelActive}
                          onInteractionStart={() => setHasDismissed360Forever(true)}
                        />
                      </PixelCubeModelTransition>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* 3. Orbit Progress & Quick Pagination Indicator (hidden in horizontal mode, reveals on click) */}
        <div
          ref={indicatorRef}
          className={styles.orbitIndicator}
          style={{
            pointerEvents: isVerticalMode && uiVisible ? 'auto' : 'none',
          }}
        >
          <div className={styles.counterText}>
            <span className={styles.activeNumber}>{activeIndex + 1}</span>
            <span className={styles.divider}>/</span>
            <span className={styles.totalNumber}>{totalItems}</span>
          </div>
          <div className={styles.indicatorTrack}>
            <div
              className={styles.indicatorThumb}
              style={{
                height: `${((activeIndex + 1) / totalItems) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* 3.5 Mobile Left-Center Up / Down Arrow Navigation (Mobile vertical mode only) */}
        <div
          ref={mobileArrowsRef}
          className={styles.mobileNavArrows}
          style={{
            pointerEvents: isVerticalMode && uiVisible ? 'auto' : 'none',
          }}
        >
          <button
            type="button"
            onClick={() => goToModel(activeIndex - 1)}
            disabled={activeIndex === 0}
            className={styles.mobileArrowBtn}
            aria-label="Previous 3D model"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => goToModel(activeIndex + 1)}
            disabled={activeIndex === totalItems - 1}
            className={styles.mobileArrowBtn}
            aria-label="Next 3D model"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {/* 4. Mode Toggle Button at Bottom-Left (reveals smoothly in vertical mode) */}
        <button
          ref={toggleBtnRef}
          type="button"
          onClick={toggleLayoutMode}
          className={styles.toggleModeBtn}
          style={{
            pointerEvents: isVerticalMode && uiVisible ? 'auto' : 'none',
          }}
          aria-label="Back"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <ScrambleText text="Back" />
        </button>

        {/* 5. Shop Button at Bottom-Right (Extreme Right) */}
        <button
          ref={shopBtnRef}
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setGalleryTriggerRect({
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            });
            setIsProduct2GalleryOpen(true);
          }}
          className={styles.shopButton}
          style={{
            pointerEvents: isVerticalMode && uiVisible ? 'auto' : 'none',
          }}
          aria-label="Shop product"
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <ScrambleText text="Shop" />
        </button>

        {/* 5. 360° Drag Explore Curved Indicator below Model in Vertical Mode */}
        {(() => {
          const scrollSettled = Math.abs(virtualIndex - Math.round(virtualIndex)) < 0.08;
          const show360Prompt = isVerticalMode && uiVisible && scrollSettled && !hasDismissed360Forever;

          return (
            <div
              className={`${styles.orbit360Prompt} ${show360Prompt ? styles.orbit360PromptVisible : styles.orbit360PromptHidden}`}
              aria-hidden={!show360Prompt}
            >
              <svg
                viewBox="0 0 440 92"
                className={styles.orbitArcSvg}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                {/* Authentic 3D perspective half-circle elliptical orbital ring */}
                <path
                  d="M 22 18 A 198 64 0 0 0 418 18"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
                {/* Center dot indicator on the orbital ring */}
                <circle cx="220" cy="82" r="3.6" fill="currentColor" />
              </svg>
              <div className={styles.orbit360Labels}>
                <span className={styles.orbit360Explore}>DRAG TO EXPLORE</span>
                <span className={styles.orbit360Degree}>360° VIEW</span>
              </div>
            </div>
          );
        })()}

        {/* 6. Bottom Center "Our Collection" / Prompt / Product Scramble Indicator in Horizontal Mode */}
        <div
          className={`${styles.bottomCenterIndicator} ${!isVerticalMode && (isMobile ? modelsIn > 0.05 : modelsIn > 0.82) ? styles.bottomCenterIndicatorVisible : ''}`}
        >
          <ScrambleText
            text={
              !isVerticalMode && hoveredIndex !== null
                ? (PRODUCT_CODES[hoveredIndex] || 'Product No. 324')
                : !hasClickedModel && hintToggle
                  ? 'Click on any model to view'
                  : 'Our Collection'
            }
            triggerOnChange={true}
            triggerKey={
              isVerticalMode
                ? 'vertical'
                : hoveredIndex !== null
                  ? `hover_${hoveredIndex}`
                  : `idle_${hasClickedModel}_${hintToggle}`
            }
            speed="fast"
          />
        </div>

        {/* 7. GSAP Horizontal Full Ratio Product 2 Image Gallery Viewer */}
        <HorizontalProductGalleryModal
          isOpen={isProduct2GalleryOpen}
          onClose={() => setIsProduct2GalleryOpen(false)}
          productId="2"
          triggerRect={galleryTriggerRect}
        />
      </div>
    </div>
  );
}
