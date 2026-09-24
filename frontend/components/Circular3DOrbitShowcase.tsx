'use client';

import React, { useEffect, useRef, useState } from 'react';
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
    title: 'Dahlia Couturier',
    subtitle: 'Sculptural Draped Form · Haute Couture Edition',
    tag: 'Collector Series',
    modelPath: '/fashion+model+3d+model-reduced (1).glb',
    texturePath: '',
  },
  {
    id: 'item-3',
    number: '03',
    title: 'Atelier Silhouette',
    subtitle: 'Monochromatic Structural Form · Studio Series',
    tag: 'Heritage Archive',
    modelPath: '/fashion+model+3d+model-reduced (1).glb',
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
    modelPath: '/fashion+model+3d+model-reduced (1).glb',
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

  // Track scroll entry from Phase 1 to Phase 2 to trigger pixelated cubic model transition
  const [hasEnteredPhase2, setHasEnteredPhase2] = useState(false);

  useEffect(() => {
    const handleScrollEntry = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      if (scrollY > 60) {
        setHasEnteredPhase2(true);
      } else {
        setHasEnteredPhase2(false);
      }
    };
    window.addEventListener('scroll', handleScrollEntry, { passive: true });
    handleScrollEntry();
    return () => window.removeEventListener('scroll', handleScrollEntry);
  }, []);

  // Animation values tracked by GSAP
  const animRef = useRef({ layout: 0, virtualIndex: 0 });
  const isTransitioningRef = useRef(false);
  const isVerticalModeRef = useRef(false);
  isVerticalModeRef.current = isVerticalMode;
  const isGalleryOpenRef = useRef(false);
  isGalleryOpenRef.current = isProduct2GalleryOpen;
  const progressRef = useRef({ current: 0, target: 0 });

  const totalItems = ITEMS.length;
  const SCROLL_SCALE = 0.88;

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth || 1400);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isNavigatingRef = useRef(false);

  // Wheel navigation inside vertical mode: smoothly steps through models
  const handleWheel = (e: React.WheelEvent) => {
    if (!isVerticalMode || isTransitioningRef.current || isNavigatingRef.current) return;
    if (isProduct2GalleryOpen) return;

    if (Math.abs(e.deltaY) > 20) {
      if (e.deltaY > 0 && activeIndex < totalItems - 1) {
        isNavigatingRef.current = true;
        const nextIdx = activeIndex + 1;
        setActiveIndex(nextIdx);
        gsap.to(animRef.current, {
          virtualIndex: nextIdx,
          duration: 0.65,
          ease: 'power2.out',
          onUpdate: () => {
            setVirtualIndex(animRef.current.virtualIndex);
          },
          onComplete: () => {
            isNavigatingRef.current = false;
          },
        });
      } else if (e.deltaY < 0 && activeIndex > 0) {
        isNavigatingRef.current = true;
        const prevIdx = activeIndex - 1;
        setActiveIndex(prevIdx);
        gsap.to(animRef.current, {
          virtualIndex: prevIdx,
          duration: 0.65,
          ease: 'power2.out',
          onUpdate: () => {
            setVirtualIndex(animRef.current.virtualIndex);
          },
          onComplete: () => {
            isNavigatingRef.current = false;
          },
        });
      }
    }
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
      if (toggleBtnRef.current) {
        tl.to(
          toggleBtnRef.current,
          { opacity: 1, duration: 0.45, ease: 'power2.out' },
          0.85
        );
      }
    } else {
      // VERTICAL -> HORIZONTAL
      const tl = gsap.timeline({
        onComplete: () => {
          setIsVerticalMode(false);
          setHoveredIndex(null);
          setUiVisible(false);
          isTransitioningRef.current = false;
        },
      });

      if (cardInfoRef.current && indicatorRef.current) {
        tl.to(
          [cardInfoRef.current, indicatorRef.current],
          { opacity: 0, duration: 0.35, ease: 'power2.in' },
          0
        );
      }
      if (toggleBtnRef.current) {
        tl.to(
          toggleBtnRef.current,
          { opacity: 0, duration: 0.35, ease: 'power2.in' },
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

    if (!isVerticalMode) {
      // HORIZONTAL -> VERTICAL on click
      setIsVerticalMode(true);
      setActiveIndex(clickedIndex);
      isTransitioningRef.current = true;

      if (cardInfoRef.current) gsap.set(cardInfoRef.current, { opacity: 0 });
      if (indicatorRef.current) gsap.set(indicatorRef.current, { opacity: 0 });
      if (toggleBtnRef.current) gsap.set(toggleBtnRef.current, { opacity: 0 });

      // Kill any running tweens
      gsap.killTweensOf(animRef.current);

      const tl = gsap.timeline({
        onComplete: () => {
          setUiVisible(true);
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
      if (toggleBtnRef.current) {
        tl.to(
          toggleBtnRef.current,
          { opacity: 1, duration: 0.45, ease: 'power2.out' },
          0.85
        );
      }
    } else {
      // In vertical mode: clicking any other model centers it
      if (clickedIndex !== activeIndex) {
        setActiveIndex(clickedIndex);
        isTransitioningRef.current = true;
        gsap.to(animRef.current, {
          virtualIndex: clickedIndex,
          duration: 0.75,
          ease: 'power2.out',
          onUpdate: () => {
            setVirtualIndex(animRef.current.virtualIndex);
          },
          onComplete: () => {
            isTransitioningRef.current = false;
          },
        });
      }
    }
  };

  // Horizontal spacing calculation for full line distribution
  const centerIndexOffset = (totalItems - 1) / 2;
  const horizontalSpacing = Math.min(180, Math.max(120, (windowWidth * 0.86) / totalItems));

  return (
    <div
      ref={containerRef}
      className={`${styles.orbitWrapper} ${isVerticalMode ? styles.orbitWrapperVertical : ''}`}
      onWheel={handleWheel}
    >
      {/* Sticky viewport stage */}
      <div className={styles.stickyStage}>
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

              return (
                <div
                  key={item.id}
                  className={styles.textBlock}
                  style={{
                    transform: `translate3d(0, ${textY.toFixed(2)}px, 0)`,
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

          <button
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
            aria-label="View product 2 images"
          >
            <ScrambleText text="View" />
          </button>
        </div>

        {/* 2. 3D Model Items: Horizontal line initially, GSAP morphs to Vertical Center on click */}
        <div className={styles.itemsLayer}>
          {ITEMS.map((item, index) => {
            // Distance from focus in vertical layout
            const d = index - virtualIndex;
            const isFocused = Math.abs(d) < 0.25;

            // --- Horizontal Layout Coordinates (layoutProgress = 0) ---
            const hOffsetPx = (index - centerIndexOffset) * horizontalSpacing;
            const hScale = 0.38;
            const hOpacity = 1.0;
            const hBlur = 0;

            // --- Vertical Layout Coordinates (layoutProgress = 1) ---
            const vOffsetPx = 0;
            const vOffsetYVh = d * 60;
            const vScale = Math.max(0.36, 0.89 - Math.abs(d) * 0.25); // 10% smaller centered model in vertical mode
            const vOpacity = Math.max(0, 1.0 - Math.pow(Math.abs(d) / 0.95, 1.35));
            const vBlur = Math.min(16, Math.pow(Math.abs(d), 1.2) * 14);

            // --- Interpolate using layoutProgress (0 -> 1) ---
            const currentXPx = gsap.utils.interpolate(hOffsetPx, vOffsetPx, layoutProgress);
            const currentYVh = gsap.utils.interpolate(0, vOffsetYVh, layoutProgress);
            const currentScale = gsap.utils.interpolate(hScale, vScale, layoutProgress);
            const currentOpacity = gsap.utils.interpolate(hOpacity, vOpacity, layoutProgress);
            const currentBlur = gsap.utils.interpolate(hBlur, vBlur, layoutProgress);

            const isVisible = layoutProgress < 0.15 ? true : currentOpacity > 0.02;
            const zIndex = isFocused ? 50 : Math.max(1, Math.round((2.0 - Math.abs(d)) * 20));

            return (
              <div
                key={item.id}
                className={`${styles.orbitCard} ${!isVerticalMode ? styles.horizontalCard : ''}`}
                style={{
                  transform: `translate3d(calc(-50% + ${currentXPx.toFixed(1)}px), calc(-50% + ${currentYVh.toFixed(2)}vh), 0px) scale(${currentScale.toFixed(3)})`,
                  opacity: isVisible ? Number(currentOpacity.toFixed(3)) : 0,
                  filter: currentBlur > 0.05 ? `blur(${currentBlur.toFixed(1)}px)` : 'none',
                  zIndex: zIndex,
                  visibility: isVisible ? 'visible' : 'hidden',
                  pointerEvents: !isVerticalMode ? 'auto' : isFocused ? 'auto' : 'auto',
                }}
              >
                {/* Click & Hover trigger overlay for seamless hover scramble & click response */}
                {(!isVerticalMode || !isFocused) && (
                  <button
                    type="button"
                    className={styles.cardClickTrigger}
                    onClick={() => handleModelClick(index)}
                    onMouseEnter={() => handleModelHover(index)}
                    onMouseLeave={() => {
                      if (!isVerticalMode) setHoveredIndex((prev) => (prev === index ? null : prev));
                    }}
                    aria-label={`Select 3D model ${item.title}`}
                  />
                )}

                {/* 3D Model Instance with Pixelated Cubic Transition and Individual Starting Angle */}
                <div className={styles.modelContainerWrap}>
                  <PixelCubeModelTransition
                    modelIndex={index}
                    triggerEntry={hasEnteredPhase2}
                  >
                    <ModelViewer3D
                      modelPath={item.modelPath}
                      texturePath={item.texturePath}
                      autoRotateSpeed={10.0}
                      initialRotation={ROTATION_OFFSETS[index] || 0}
                    />
                  </PixelCubeModelTransition>
                </div>
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

        {/* 4. Mode Toggle Button at Bottom-Left (hidden in horizontal mode, reveals smoothly in vertical mode) */}
        <button
          ref={toggleBtnRef}
          type="button"
          onClick={toggleLayoutMode}
          className={styles.toggleModeBtn}
          style={{
            pointerEvents: isVerticalMode && uiVisible ? 'auto' : 'none',
          }}
          aria-label="Return to Horizontal 3D Showcase"
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
            <rect x="2" y="6" width="5" height="12" rx="0.5" />
            <rect x="9.5" y="6" width="5" height="12" rx="0.5" />
            <rect x="17" y="6" width="5" height="12" rx="0.5" />
          </svg>
          <ScrambleText text="Horizontal" />
        </button>

        {/* 5. Bottom Center "Our Collection" / Product Scramble Indicator in Phase 2 */}
        <div
          className={`${styles.bottomCenterIndicator} ${!isVerticalMode ? styles.bottomCenterIndicatorVisible : ''}`}
        >
          <ScrambleText
            text={!isVerticalMode && hoveredIndex !== null ? (PRODUCT_CODES[hoveredIndex] || 'Product No. 324') : 'Our Collection'}
            triggerOnChange={true}
            triggerKey={isVerticalMode ? 'vertical' : hoveredIndex}
            speed="fast"
          />
        </div>

        {/* 6. GSAP Horizontal Full Ratio Product 2 Image Gallery Viewer */}
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
