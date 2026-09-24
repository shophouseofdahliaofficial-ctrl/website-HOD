'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import gsap from 'gsap';
import ScrambleText from './ScrambleText';
import styles from './HomeMenuSidebar.module.css';

export interface MenuTriggerRect {
  top: number;
  left: number;
  width: number;
  height: number;
  right?: number;
}

interface HomeMenuSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRect?: MenuTriggerRect | null;
}

const MENU_ITEMS = [
  { label: 'My Account', href: '/dashboard' },
  { label: 'Orders', href: '/orders' },
  { label: 'Favorites', href: '/favorites' },
  { label: 'Wallet', href: '/dashboard' },
  { label: 'Gift Cards', href: '/customer/giftcard' },
  { label: 'Reviews', href: '/reviews' },
];

const GLYPHS = ['H', 'O', 'D', '0', '1', '7', '8', '9', 'A', 'E', 'X', '+', '§', '•'];

interface PixelCube {
  col: number;
  row: number;
  alpha: number;
  glyph: string;
  isWhite: boolean;
}

function MenuItemPixelRow({
  item,
  onClose,
  index,
  itemRef,
}: {
  item: { label: string; href: string };
  onClose: () => void;
  index: number;
  itemRef: (el: HTMLAnchorElement | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const waveStartRef = useRef<number | null>(null);

  const PIXEL_SIZE = 12;
  const WAVE_DURATION = 550; // ms for fast sweep across the row

  const runWave = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!waveStartRef.current) {
      waveStartRef.current = timestamp;
    }

    const elapsed = timestamp - waveStartRef.current;
    const progress = Math.min(1.0, elapsed / WAVE_DURATION);

    const width = canvas.width;
    const height = canvas.height;
    const cols = Math.ceil(width / PIXEL_SIZE);
    const rows = Math.ceil(height / PIXEL_SIZE);

    ctx.clearRect(0, 0, width, height);

    ctx.font = `600 7px 'Inter', -apple-system, monospace, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Wave front position in column index
    const waveFrontCol = progress * (cols + 12);
    const waveWidth = 8; // width of the active pixel band

    let hasActivePixels = false;

    for (let c = 0; c < cols; c++) {
      const distFromFront = waveFrontCol - c;

      // Only draw within the active wave band
      if (distFromFront >= 0 && distFromFront <= waveWidth) {
        hasActivePixels = true;
        const normalized = 1 - distFromFront / waveWidth; // 1 at front, 0 at tail
        const alpha = Math.pow(normalized, 1.2);

        for (let r = 0; r < rows; r++) {
          const pseudoRand = (Math.sin(c * 17.13 + r * 31.87) * 43758.5453) % 1;
          const absRand = Math.abs(pseudoRand);

          // Random density in the wave
          if (absRand > 0.42) continue;

          const px = c * PIXEL_SIZE;
          const py = r * PIXEL_SIZE;
          const cubeAlpha = Math.min(1.0, alpha * (0.85 + absRand * 0.15));

          // Draw pure white pixelated cube directly overlapping the text
          ctx.fillStyle = `rgba(255, 255, 255, ${(cubeAlpha * 1.0).toFixed(3)})`;
          ctx.fillRect(px, py, PIXEL_SIZE, PIXEL_SIZE);

          // Subtle fine burgundy cipher glyph inside white cubes
          if (cubeAlpha > 0.35 && absRand < 0.45) {
            const glyphIdx = Math.floor(absRand * GLYPHS.length) % GLYPHS.length;
            ctx.fillStyle = `rgba(128, 0, 32, ${(cubeAlpha * 0.85).toFixed(3)})`;
            ctx.fillText(GLYPHS[glyphIdx], px + PIXEL_SIZE / 2, py + PIXEL_SIZE / 2);
          }
        }
      }
    }

    if (progress < 1.0 || hasActivePixels) {
      animFrameRef.current = requestAnimationFrame(runWave);
    } else {
      ctx.clearRect(0, 0, width, height);
      animFrameRef.current = null;
      waveStartRef.current = null;
    }
  }, []);

  const triggerWave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth || 300;
      canvas.height = canvas.offsetHeight || 60;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    waveStartRef.current = null;
    animFrameRef.current = requestAnimationFrame(runWave);
  };

  const handleMouseEnter = () => {
    triggerWave();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth || 300;
      canvas.height = canvas.offsetHeight || 60;
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return (
    <Link
      href={item.href}
      ref={itemRef}
      className={styles.menuItem}
      onClick={onClose}
      onMouseEnter={handleMouseEnter}
    >
      <div className={styles.menuItemTextWrap}>
        <canvas ref={canvasRef} className={styles.pixelCanvas} aria-hidden="true" />
        <span className={styles.menuItemText}>
          <ScrambleText text={item.label} speed="fast" />
        </span>
      </div>
      <span className={styles.menuItemArrow} aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      </span>
    </Link>
  );
}

export default function HomeMenuSidebar({ isOpen, onClose, triggerRect }: HomeMenuSidebarProps) {
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const innerContentRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Smooth GSAP Close Animation: Morphs smoothly back into the small button bounds before finishing
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);

    const panel = panelRef.current;
    const innerContent = innerContentRef.current;

    const startTop = triggerRect?.top ?? 24;
    const startRight = triggerRect ? window.innerWidth - (triggerRect.left + triggerRect.width) : 36;
    const startWidth = triggerRect?.width ?? 65;
    const startHeight = triggerRect?.height ?? 32;

    if (panel) gsap.killTweensOf(panel);
    if (innerContent) gsap.killTweensOf(innerContent);

    const tl = gsap.timeline({
      onComplete: () => {
        setIsClosing(false);
        onClose();
      },
    });

    // 1. Smoothly fade inner items first
    if (innerContent) {
      tl.to(innerContent, {
        opacity: 0,
        duration: 0.16,
        ease: 'power2.out',
      }, 0);
    }

    // 2. Morph panel bounds back towards menu button while dissolving smoothly
    if (panel) {
      tl.to(panel, {
        top: startTop,
        right: startRight,
        width: startWidth,
        height: startHeight,
        duration: 0.48,
        ease: 'power3.inOut',
      }, 0);

      // 3. Continuous dissolving fade that completes naturally with the morph (no sudden disappearance)
      tl.to(panel, {
        opacity: 0,
        duration: 0.34,
        ease: 'power2.inOut',
      }, 0.14);
    }
  }, [isClosing, onClose, triggerRect]);

  // Smooth GSAP Open Animation: Expands smoothly from small menu button to 40% width panel
  useEffect(() => {
    if (!isOpen || !mounted) return;

    setIsClosing(false);

    const panel = panelRef.current;
    const innerContent = innerContentRef.current;
    const items = itemsRef.current.filter(Boolean);

    if (!panel) return;

    const startTop = triggerRect?.top ?? 24;
    const startRight = triggerRect ? window.innerWidth - (triggerRect.left + triggerRect.width) : 36;
    const startWidth = triggerRect?.width ?? 65;
    const startHeight = triggerRect?.height ?? 32;

    // Target: Dynamic height panel 15px from top, right, and bottom (height = window.innerHeight - 30px)
    const targetTop = 15;
    const targetRight = 15;
    const targetWidth = window.innerWidth <= 640
      ? Math.max(280, window.innerWidth - 30)
      : Math.min(window.innerWidth - 30, Math.max(340, window.innerWidth * 0.40));
    const targetHeight = Math.max(300, window.innerHeight - 30);

    gsap.killTweensOf([panel, innerContent, ...items]);

    // Initial state matching the small button
    gsap.set(panel, {
      top: startTop,
      right: startRight,
      width: startWidth,
      height: startHeight,
      opacity: 1,
    });
    if (innerContent) {
      gsap.set(innerContent, { opacity: 0 });
    }
    gsap.set(items, { opacity: 0, y: 16 });

    const tl = gsap.timeline();

    // 1. Smoothly expand from small button coordinates to 15px-inset dynamic panel
    tl.to(panel, {
      top: targetTop,
      right: targetRight,
      width: targetWidth,
      height: targetHeight,
      duration: 0.58,
      ease: 'power4.inOut',
    }, 0);

    // 2. Reveal inner content
    if (innerContent) {
      tl.to(innerContent, {
        opacity: 1,
        duration: 0.32,
        ease: 'power2.out',
      }, 0.24);
    }

    // 3. Stagger reveal big text menu items
    if (items.length) {
      tl.to(items, {
        opacity: 1,
        y: 0,
        stagger: 0.05,
        duration: 0.45,
        ease: 'power3.out',
      }, 0.26);
    }
  }, [isOpen, mounted, triggerRect]);

  // Keep 15px-inset dynamic height and responsive on window resize while menu is open
  useEffect(() => {
    if (!isOpen || !mounted || isClosing) return;

    const handleResize = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const targetWidth = window.innerWidth <= 640
        ? Math.max(280, window.innerWidth - 30)
        : Math.min(window.innerWidth - 30, Math.max(340, window.innerWidth * 0.40));
      const targetHeight = Math.max(300, window.innerHeight - 30);
      gsap.to(panel, {
        top: 15,
        right: 15,
        width: targetWidth,
        height: targetHeight,
        duration: 0.2,
        ease: 'power2.out',
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, mounted, isClosing]);

  // Keyboard navigation (Escape to close)
  useEffect(() => {
    if (!isOpen || !mounted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mounted, handleClose]);

  if (!isOpen || !mounted) return null;

  const sidebarJSX = (
    <div
      ref={overlayRef}
      className={styles.sidebarOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation Menu"
    >
      {/* Clear transparent click-outside backdrop (NO BLUR) */}
      <div
        className={styles.backdrop}
        onClick={handleClose}
      />

      {/* Expanding 40% Width Menu Panel */}
      <div ref={panelRef} className={styles.menuPanel}>
        <div ref={innerContentRef} className={styles.innerContent}>
          {/* Top Header: Only Close Button */}
          <div className={styles.drawerHeader}>
            <button
              type="button"
              className={styles.closeButton}
              onClick={handleClose}
              aria-label="Close menu"
            >
              <ScrambleText text="Close" />
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* 6 Menu Items with Big Text & Interactive Pixelated Cube Canvas */}
          <nav className={styles.menuNav}>
            {MENU_ITEMS.map((item, index) => (
              <MenuItemPixelRow
                key={item.label}
                item={item}
                index={index}
                onClose={handleClose}
                itemRef={(el) => {
                  itemsRef.current[index] = el;
                }}
              />
            ))}
          </nav>
        </div>
      </div>
    </div>
  );

  return createPortal(sidebarJSX, document.body);
}
