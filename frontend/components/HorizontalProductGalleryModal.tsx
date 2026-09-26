'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import gsap from 'gsap';
import ScrambleText from './ScrambleText';
import { productsApi } from '@/lib/api';
import { getOrderedProductImageUrls } from '@/lib/utils/productImages';
import type { Product } from '@/types';
import styles from './HorizontalProductGalleryModal.module.css';

export interface TriggerRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface HorizontalProductGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId?: string;
  fallbackTitle?: string;
  triggerRect?: TriggerRect | null;
}

const DEFAULT_FALLBACK_IMAGES = [
  '/images/intro-01.webp',
  '/images/intro-02.webp',
  '/images/intro-03.webp',
  '/images/intro-04.webp',
  '/images/intro-05.webp',
  '/images/intro-06.webp',
];

export default function HorizontalProductGalleryModal({
  isOpen,
  onClose,
  productId = '2',
  fallbackTitle = 'Dahlia Couturier · Product No. 02',
  triggerRect,
}: HorizontalProductGalleryModalProps) {
  const [mounted, setMounted] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<string[]>(DEFAULT_FALLBACK_IMAGES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const innerContentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const imageCardsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Drag-to-scroll refs
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch product 2 data from API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await productsApi.getById(productId, true);
        if (!cancelled && data) {
          setProduct(data);
          const orderedUrls = getOrderedProductImageUrls(data);
          if (orderedUrls.length > 0) {
            setImages(orderedUrls);
          } else {
            setImages(DEFAULT_FALLBACK_IMAGES);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setImages(DEFAULT_FALLBACK_IMAGES);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Handle GSAP Smooth Exit - Full visible reverse morph directly into button shape before finishing
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);

    const box = boxRef.current;
    const backdrop = backdropRef.current;
    const innerContent = innerContentRef.current;

    const startTop = triggerRect?.top ?? window.innerHeight / 2 - 20;
    const startLeft = triggerRect?.left ?? window.innerWidth / 2 - 50;
    const startWidth = triggerRect?.width ?? 100;
    const startHeight = triggerRect?.height ?? 38;

    if (box) gsap.killTweensOf(box);
    if (backdrop) gsap.killTweensOf(backdrop);
    if (innerContent) gsap.killTweensOf(innerContent);

    const tl = gsap.timeline({
      onComplete: () => {
        setIsClosing(false);
        onClose();
      },
    });

    // 1. Instantly fade out internal text and images so the solid box shape morphs cleanly
    if (innerContent) {
      tl.to(innerContent, {
        opacity: 0,
        duration: 0.16,
        ease: 'power2.in',
      }, 0);
    }

    // 2. Shrink and morph the whole box back into the exact button coordinates
    // Keeps full opacity during the entire morph animation
    if (box) {
      tl.to(box, {
        top: startTop,
        left: startLeft,
        width: startWidth,
        height: startHeight,
        duration: 0.58,
        ease: 'power4.inOut',
      }, 0.04);

      // Fade out only at the very final moment as it lands on the button
      tl.to(box, {
        opacity: 0,
        duration: 0.08,
        ease: 'power1.out',
      }, 0.54);
    }

    // 3. Fade out blurred backdrop in sync with the morph
    if (backdrop) {
      tl.to(backdrop, {
        opacity: 0,
        duration: 0.52,
        ease: 'power2.inOut',
      }, 0.06);
    }
  }, [isClosing, onClose, triggerRect]);

  // GSAP Expanding Animation: Expands smoothly from the button's exact borders with 15px margins
  useEffect(() => {
    if (!isOpen || !mounted) return;

    setIsClosing(false);
    setCurrentIndex(0);

    if (trackRef.current) {
      trackRef.current.scrollLeft = 0;
    }

    const box = boxRef.current;
    const backdrop = backdropRef.current;
    const innerContent = innerContentRef.current;
    const cards = imageCardsRef.current.filter(Boolean);

    if (!box) return;

    // 10px gap on mobile (<= 768px), 15px gap on desktop from each side of the screen
    const isMobile = window.innerWidth <= 768;
    const gap = isMobile ? 10 : 15;
    const targetTop = gap;
    const targetLeft = gap;
    const targetWidth = window.innerWidth - gap * 2;
    const targetHeight = window.innerHeight - gap * 2;

    const startTop = triggerRect?.top ?? window.innerHeight / 2 - 20;
    const startLeft = triggerRect?.left ?? window.innerWidth / 2 - 50;
    const startWidth = triggerRect?.width ?? 100;
    const startHeight = triggerRect?.height ?? 38;

    gsap.killTweensOf([box, backdrop, innerContent]);

    // Set initial expanded-from-button state
    gsap.set(backdrop, { opacity: 0 });
    gsap.set(box, {
      top: startTop,
      left: startLeft,
      width: startWidth,
      height: startHeight,
      opacity: 1,
    });
    if (innerContent) {
      gsap.set(innerContent, { opacity: 0 });
    }
    gsap.set(cards, { opacity: 0, x: 50, scale: 0.96 });

    const tl = gsap.timeline();

    // 1. Fade in blurred backdrop
    tl.to(backdrop, {
      opacity: 1,
      duration: 0.38,
      ease: 'power2.out',
    }, 0);

    // 2. Smoothly expand the whole box from the button's borders out to 15px margin
    tl.to(box, {
      top: targetTop,
      left: targetLeft,
      width: targetWidth,
      height: targetHeight,
      duration: 0.65,
      ease: 'power4.inOut',
    }, 0);

    // 3. Fade and reveal inner container
    if (innerContent) {
      tl.to(innerContent, {
        opacity: 1,
        duration: 0.38,
        ease: 'power2.out',
      }, 0.28);
    }

    // 4. Stagger reveal horizontal full ratio cards
    tl.to(cards, {
      opacity: 1,
      x: 0,
      scale: 1,
      stagger: 0.05,
      duration: 0.6,
      ease: 'power3.out',
    }, 0.35);
  }, [isOpen, mounted, triggerRect]);

  // Handle window resize dynamically while open
  useEffect(() => {
    if (!isOpen || !mounted) return;

    const handleResize = () => {
      const box = boxRef.current;
      if (!box || isClosing) return;
      const isMobile = window.innerWidth <= 768;
      const gap = isMobile ? 10 : 15;
      gsap.set(box, {
        top: gap,
        left: gap,
        width: window.innerWidth - gap * 2,
        height: window.innerHeight - gap * 2,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, mounted, isClosing]);

  // Capture wheel globally with capture: true & passive: false to prevent background scroll and pan images
  useEffect(() => {
    if (!isOpen || !mounted) return;

    const handleGlobalWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const track = trackRef.current;
      if (!track) return;

      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      track.scrollLeft += delta * 1.35;
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (modalRef.current && !trackRef.current?.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: false, capture: true });
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false, capture: true });

    return () => {
      window.removeEventListener('wheel', handleGlobalWheel, { capture: true });
      window.removeEventListener('touchmove', handleGlobalTouchMove, { capture: true });
    };
  }, [isOpen, mounted]);

  // Keyboard navigation (Escape to close, Arrow keys to pan)
  useEffect(() => {
    if (!isOpen || !mounted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'ArrowRight') {
        scrollToImage(Math.min(images.length - 1, currentIndex + 1));
      } else if (e.key === 'ArrowLeft') {
        scrollToImage(Math.max(0, currentIndex - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mounted, currentIndex, images.length, handleClose]);

  // Smooth scroll to a specific image index
  const scrollToImage = (index: number) => {
    const track = trackRef.current;
    const targetCard = imageCardsRef.current[index];
    if (!track || !targetCard) return;

    const trackRect = track.getBoundingClientRect();
    const cardRect = targetCard.getBoundingClientRect();
    const targetScrollLeft = track.scrollLeft + (cardRect.left - trackRect.left) - (trackRect.width / 2 - cardRect.width / 2);

    gsap.to(track, {
      scrollLeft: Math.max(0, targetScrollLeft),
      duration: 0.55,
      ease: 'power3.out',
    });

    setCurrentIndex(index);
  };

  // Drag-to-scroll handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;
    isDraggingRef.current = true;
    dragStartXRef.current = e.pageX - track.offsetLeft;
    dragScrollLeftRef.current = track.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;
    const x = e.pageX - track.offsetLeft;
    const walk = (x - dragStartXRef.current) * 1.4;
    track.scrollLeft = dragScrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  // Track active item index during user scroll
  const handleTrackScroll = () => {
    const track = trackRef.current;
    if (!track) return;

    const trackCenter = track.scrollLeft + track.clientWidth / 2;
    let closestIndex = 0;
    let minDistance = Infinity;

    imageCardsRef.current.forEach((card, idx) => {
      if (!card) return;
      const cardCenter = card.offsetLeft + card.clientWidth / 2;
      const dist = Math.abs(trackCenter - cardCenter);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = idx;
      }
    });

    if (closestIndex !== currentIndex) {
      setCurrentIndex(closestIndex);
    }
  };

  if (!isOpen || !mounted) return null;

  const displayTitle = product?.name || fallbackTitle;

  const modalJSX = (
    <div
      ref={modalRef}
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      onWheel={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchMove={(e) => {
        if (!trackRef.current?.contains(e.target as Node)) {
          e.preventDefault();
        }
      }}
    >
      {/* Blurred Translucent Backdrop */}
      <div
        ref={backdropRef}
        className={styles.backdrop}
        onClick={handleClose}
      />

      {/* Expanding Box: Animates from View button borders to 15px margin viewport */}
      <div ref={boxRef} className={styles.popupBox}>
        {/* Inner Content Wrapper */}
        <div ref={innerContentRef} className={styles.innerContent}>
          {/* Top Header */}
          <div ref={headerRef} className={styles.headerBar}>
            <div className={styles.headerLeft}>
              <h2 className={styles.productTitle}>
                <ScrambleText text={displayTitle} speed="fast" />
              </h2>
            </div>

            <div className={styles.headerRight}>
              {/* "Buy" Button */}
              <Link
                href={`/product/${productId}`}
                className={styles.buyButton}
                aria-label={`Buy ${displayTitle}`}
              >
                <ScrambleText text="Buy" />
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>

              {/* Close Button */}
              <button
                type="button"
                className={styles.closeButton}
                onClick={handleClose}
                aria-label="Close product gallery"
              >
                <ScrambleText text="Close" />
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Horizontal Full Ratio Image Track: Touches the bottom edge */}
          <div
            ref={trackRef}
            className={styles.horizontalTrack}
            onScroll={handleTrackScroll}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
          >
            <div className={styles.trackSpacer} />

            {images.map((imgUrl, index) => {
              const isSelected = index === currentIndex;

              return (
                <div
                  key={`${imgUrl}-${index}`}
                  ref={(el) => {
                    imageCardsRef.current[index] = el;
                  }}
                  className={`${styles.imageCard} ${isSelected ? styles.imageCardActive : ''}`}
                  onClick={() => scrollToImage(index)}
                >
                  <div className={styles.imageFrame}>
                    <img
                      src={imgUrl}
                      alt={`${displayTitle} - Perspective ${index + 1}`}
                      className={styles.imageElement}
                      draggable={false}
                    />
                  </div>
                </div>
              );
            })}

            <div className={styles.trackSpacer} />
          </div>

          {/* Left / Right Arrow Navigation Buttons */}
          <button
            type="button"
            className={`${styles.sideNavBtn} ${styles.sideNavLeft}`}
            onClick={() => scrollToImage(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            aria-label="Previous image"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            type="button"
            className={`${styles.sideNavBtn} ${styles.sideNavRight}`}
            onClick={() => scrollToImage(Math.min(images.length - 1, currentIndex + 1))}
            disabled={currentIndex === images.length - 1}
            aria-label="Next image"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalJSX, document.body);
}
