'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import ModelViewer3D from './ModelViewer3D';
import ScrambleText from './ScrambleText';
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
    title: 'Nathan Walkin',
    subtitle: 'Dynamic Human Motion · Curated 3D Specimen',
    tag: 'Collector Series',
    modelPath: '/rp_nathan_animated_003_walking.fbx',
    texturePath: '/rp_nathan_animated_003_dif.jpg',
  },
  {
    id: 'item-3',
    number: '03',
    title: 'Mallard Drake',
    subtitle: 'Signature Heritage Fauna · Handcrafted Edition',
    tag: 'Heritage Fauna',
    modelPath: '/12248_Bird_v1_L2.obj',
    texturePath: '/12248_Bird_v1_diff.jpg',
  },
  {
    id: 'item-4',
    number: '04',
    title: 'Nathan Stride',
    subtitle: 'Fluid Kinematics Silhouette · Studio Edition',
    tag: 'Collector Series',
    modelPath: '/rp_nathan_animated_003_walking.fbx',
    texturePath: '/rp_nathan_animated_003_dif.jpg',
  },
  {
    id: 'item-5',
    number: '05',
    title: 'Atelier Specimen',
    subtitle: 'Sculptural Runway Form · Monochrome Edition',
    tag: 'Runway Archive',
    modelPath: '/tripo_convert_28a65a5a-0e3a-403f-b084-1c63a0c3363c.obj',
    texturePath: '/fashion_model_3d_model_basecolor.JPEG',
  },
  {
    id: 'item-6',
    number: '06',
    title: 'House Of Dahlia Relic',
    subtitle: 'Architectural Sculptural Presence · Timeless Form',
    tag: 'Maison Exclusive',
    modelPath: '/12248_Bird_v1_L2.obj',
    texturePath: '/12248_Bird_v1_diff.jpg',
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

  // Layout mode state: 0 = Horizontal Lineup (Initial Phase 2), 1 = Vertical Centered Carousel
  const [layoutProgress, setLayoutProgress] = useState(0);
  const [isVerticalMode, setIsVerticalMode] = useState(false);
  const [virtualIndex, setVirtualIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [uiVisible, setUiVisible] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400);

  // Animation values tracked by GSAP
  const animRef = useRef({ layout: 0, virtualIndex: 0 });
  const isTransitioningRef = useRef(false);
  const isVerticalModeRef = useRef(false);
  isVerticalModeRef.current = isVerticalMode;

  const totalItems = ITEMS.length;

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth || 1400);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Stepped plateau virtual progress for vertical scrolling once in vertical mode
  const computeSteppedVirtualIndex = (progress: number): number => {
    if (progress <= 0) return 0;
    if (progress >= 1) return totalItems - 1;

    const totalSegments = totalItems - 1;
    const rawVirtual = progress * totalSegments;
    const segIndex = Math.floor(rawVirtual);
    const localFraction = rawVirtual - segIndex;

    if (segIndex >= totalSegments) return totalSegments;

    const PAUSE_RATIO = 0.45;
    let transition = 0;
    if (localFraction > PAUSE_RATIO) {
      const t = (localFraction - PAUSE_RATIO) / (1 - PAUSE_RATIO);
      transition = t * t * (3 - 2 * t);
    }

    return segIndex + transition;
  };

  // Scroll listener: handles vertical scrolling when in vertical mode
  useEffect(() => {
    let animId: number;
    let targetProgress = 0;
    let currentProgress = 0;

    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const windowHeight = window.innerHeight || 800;

      if (rect.top > 0) {
        targetProgress = 0;
        return;
      }

      const totalScrollable = rect.height - windowHeight;
      if (totalScrollable <= 0) {
        targetProgress = 0;
        return;
      }

      const scrolled = Math.max(0, -rect.top);
      const rawRatio = Math.min(1, scrolled / totalScrollable);
      targetProgress = Math.max(0, Math.min(1, rawRatio));
    };

    const updateLoop = () => {
      currentProgress += (targetProgress - currentProgress) * 0.15;

      // Only update virtualIndex from scroll if already in vertical mode and not currently animating click
      if (isVerticalModeRef.current && !isTransitioningRef.current) {
        const vIdx = computeSteppedVirtualIndex(currentProgress);
        setVirtualIndex(vIdx);
        animRef.current.virtualIndex = vIdx;

        const targetIndex = Math.max(0, Math.min(totalItems - 1, Math.round(vIdx)));
        setActiveIndex((prev) => (prev !== targetIndex ? targetIndex : prev));
      }

      animId = requestAnimationFrame(updateLoop);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    handleScroll();
    animId = requestAnimationFrame(updateLoop);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      cancelAnimationFrame(animId);
    };
  }, [totalItems]);

  // Click handler: smoothly turns horizontal line into vertical stack centered on clicked model
  const handleModelClick = (clickedIndex: number) => {
    // Synchronize page scroll position so scroll loop remains at selected item
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const totalScrollable = container.offsetHeight - window.innerHeight;
      if (totalScrollable > 0) {
        const containerTopInDoc = window.scrollY + rect.top;
        const targetScrollFraction = clickedIndex / Math.max(1, totalItems - 1);
        const targetScrollY = containerTopInDoc + targetScrollFraction * totalScrollable;
        window.scrollTo({ top: targetScrollY, behavior: 'instant' as any });
      }
    }

    if (!isVerticalMode) {
      setIsVerticalMode(true);
      setActiveIndex(clickedIndex);
      setUiVisible(true);
      isTransitioningRef.current = true;

      // Kill any running tweens
      gsap.killTweensOf(animRef.current);

      const tl = gsap.timeline({
        onComplete: () => {
          isTransitioningRef.current = false;
        },
      });

      // 1. Smoothly morph layout from horizontal (0) to vertical (1)
      // and align virtualIndex to the clicked model
      tl.to(
        animRef.current,
        {
          layout: 1.0,
          virtualIndex: clickedIndex,
          duration: 1.35,
          ease: 'power3.inOut',
          onUpdate: () => {
            setLayoutProgress(animRef.current.layout);
            setVirtualIndex(animRef.current.virtualIndex);
          },
        },
        0
      );

      // 2. Reveal Left Card Info and Right Indicator with GSAP
      if (cardInfoRef.current && indicatorRef.current) {
        tl.fromTo(
          cardInfoRef.current,
          { opacity: 0, x: -35 },
          { opacity: 1, x: 0, duration: 0.9, ease: 'power2.out' },
          0.45
        );
        tl.fromTo(
          indicatorRef.current,
          { opacity: 0, x: 35 },
          { opacity: 1, x: 0, duration: 0.9, ease: 'power2.out' },
          0.5
        );
      }
    } else {
      // In vertical mode: clicking any other model centers it
      if (clickedIndex !== activeIndex) {
        setActiveIndex(clickedIndex);
        isTransitioningRef.current = true;
        gsap.to(animRef.current, {
          virtualIndex: clickedIndex,
          duration: 0.9,
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
    <div ref={containerRef} className={styles.orbitWrapper}>
      {/* Sticky viewport stage */}
      <div className={styles.stickyStage}>
        {/* 1. Left Center Static Info Card (hidden initially in horizontal mode, reveals on click) */}
        <div
          ref={cardInfoRef}
          className={styles.cardInfo}
          style={{
            opacity: uiVisible ? 1 : 0,
            pointerEvents: isVerticalMode ? 'auto' : 'none',
            visibility: uiVisible ? 'visible' : 'hidden',
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

          <Link
            href="/collections"
            className={styles.shopButton}
            style={{
              opacity: isVerticalMode ? 1 : 0,
            }}
          >
            <ScrambleText text="Shop" />
          </Link>
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
            const vScale = Math.max(0.40, 0.99 - Math.abs(d) * 0.27);
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
                {/* Click trigger overlay for seamless click response on any model */}
                {(!isVerticalMode || !isFocused) && (
                  <button
                    type="button"
                    className={styles.cardClickTrigger}
                    onClick={() => handleModelClick(index)}
                    aria-label={`Select 3D model ${item.title}`}
                  />
                )}

                {/* 3D Model Instance (Continuously rotates smoothly in both horizontal & vertical modes) */}
                <div className={styles.modelContainerWrap}>
                  <ModelViewer3D
                    modelPath={item.modelPath}
                    texturePath={item.texturePath}
                    autoRotateSpeed={10.0}
                  />
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
            opacity: uiVisible ? 1 : 0,
            pointerEvents: isVerticalMode ? 'auto' : 'none',
            visibility: uiVisible ? 'visible' : 'hidden',
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
      </div>
    </div>
  );
}
