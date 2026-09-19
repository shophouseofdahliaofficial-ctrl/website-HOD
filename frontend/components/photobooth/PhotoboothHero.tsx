'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Cormorant_Garamond, Caveat } from 'next/font/google';
import {
  MARGIN_WORDS,
  ORBIT_PHOTOS,
  ORBIT_ROTATION_SPEED,
  ORBIT_RX,
  ORBIT_RY,
  BACKGROUND_PHOTOS,
  BG_ORBIT_RX,
  BG_ORBIT_RY,
  BG_ORBIT_ROTATION_SPEED,
  type PhotoboothPhoto,
} from '@/lib/photobooth/constants';
import { depthFromAngle, introEase, orbitPosition, springToward } from './orbitMath';
import PolaroidFrame from './PolaroidFrame';
import styles from './photobooth.module.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['600', '700'],
  display: 'swap',
});

const caveat = Caveat({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600'],
  display: 'swap',
});

const CARD_INTRO_DURATION = 1200;
const CARD_STAGGER_DELAY = 70;
const TOTAL_CARDS = Math.max(ORBIT_PHOTOS.length, BACKGROUND_PHOTOS.length);
const TOTAL_INTRO_DURATION = (TOTAL_CARDS - 1) * CARD_STAGGER_DELAY + CARD_INTRO_DURATION;

const ALL_PHOTOS = [...ORBIT_PHOTOS, ...BACKGROUND_PHOTOS];
const ROW_1 = ALL_PHOTOS.slice(0, 11);
const ROW_2 = ALL_PHOTOS.slice(11, 22);
const ROW_3 = ALL_PHOTOS.slice(22, 32);

const DULL_COLORS = [
  { color: '#f5dede', glow: 'rgba(245, 222, 222, 0.75)', soft: '#fcf2f2' }, // Muted Rose
  { color: '#f7ebd2', glow: 'rgba(247, 235, 210, 0.75)', soft: '#fdf8ef' }, // Dull Amber
  { color: '#def0dc', glow: 'rgba(222, 240, 220, 0.75)', soft: '#f3faf2' }, // Vintage Sage
  { color: '#e7def7', glow: 'rgba(231, 222, 247, 0.75)', soft: '#f6f2fc' }, // Dusty Lavender
  { color: '#fae3da', glow: 'rgba(250, 227, 218, 0.75)', soft: '#fdf4f0' }, // Soft Peach
  { color: '#dcf0f7', glow: 'rgba(220, 240, 247, 0.75)', soft: '#f2fafd' }, // Muted Cyan
  { color: '#f7e2d7', glow: 'rgba(247, 226, 215, 0.75)', soft: '#fdf4ef' }, // Soft Terracotta
  { color: '#faf5d9', glow: 'rgba(250, 245, 217, 0.75)', soft: '#fdfcf2' }, // Dull Butter
];

type FlyingPhase = 'straighten' | 'zoom' | 'open' | 'closing';

type FlyingState = {
  photo: PhotoboothPhoto;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  vx: number;
  vy: number;
  vs: number;
  vr: number;
  phase: FlyingPhase;
  startX: number;
  startY: number;
  startScale: number;
  targetScale: number;
  baseWidth: number;
  clickedIndex: number;
  isBackground: boolean;
  closeStartTime?: number;
};

function normalizeAngle(deg: number): number {
  let angle = deg % 360;
  if (angle > 180) angle -= 360;
  if (angle < -180) angle += 360;
  return angle;
}

const MARGIN_PLACEMENTS: { word: (typeof MARGIN_WORDS)[number]; style: React.CSSProperties }[] = [
  { word: 'some', style: { top: '16%', left: '6%', transform: 'rotate(-4deg)' } },
  { word: 'moments', style: { top: '32%', right: '31%', transform: 'rotate(2deg)' } },
  { word: 'of', style: { bottom: '38%', left: '17%', transform: 'rotate(4deg)' } },
  { word: 'my', style: { bottom: '10%', left: '45%', transform: 'rotate(-3deg)' } },
  { word: 'life', style: { bottom: '15%', right: '15%', transform: 'rotate(5deg)' } },
];

export default function PhotoboothHero() {
  const stageRef = useRef<HTMLDivElement>(null);
  const mobileMarqueeRef = useRef<HTMLDivElement>(null);
  const orbitAngleRef = useRef(0);
  const bgOrbitAngleRef = useRef(0);
  const introStartRef = useRef<number | null>(null);
  const introDoneRef = useRef(false);
  const rafRef = useRef<number>(0);
  const flyingRef = useRef<FlyingState | null>(null);

  const [frame, setFrame] = useState(0);
  const [flying, setFlying] = useState<FlyingState | null>(null);
  const [startReveal, setStartReveal] = useState(false);
  const [triggerShimmer, setTriggerShimmer] = useState(false);
  const [shimmerSettled, setShimmerSettled] = useState(false);
  const [isMobileMarqueeActive, setIsMobileMarqueeActive] = useState(false);
  const lightboxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const swipeVelocityRef = useRef(0);
  const draggedRef = useRef(false);

  const bump = useCallback(() => setFrame((n) => n + 1), []);

  const handleCardClick = useCallback(
    (photo: PhotoboothPhoto, index: number, isBackground = false, currentRotate = 0) => {
      if (draggedRef.current) return;
      if (flyingRef.current) return;
      const stage = stageRef.current;
      if (!stage) return;

      const selector = isBackground
        ? `[data-bg-orbit-index="${index}"]`
        : `[data-orbit-index="${index}"]`;
      const cards = stage.querySelectorAll<HTMLElement>(selector);
      const el = cards[0];
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const baseWidth = rect.width;

      const viewportWidth = window.innerWidth;
      const targetWidth = Math.min(viewportWidth * 0.85 + 28, 428);
      const targetScale = targetWidth / baseWidth;
      const normAngle = normalizeAngle(currentRotate);

      const next: FlyingState = {
        photo,
        x: startX,
        y: startY,
        scale: 1,
        rotate: normAngle,
        vx: 0,
        vy: 0,
        vs: 0,
        vr: 0,
        phase: 'straighten',
        startX,
        startY,
        startScale: 1,
        targetScale,
        baseWidth,
        clickedIndex: index,
        isBackground,
      };
      flyingRef.current = next;
      setFlying(next);
    },
    []
  );

  const handleMobileCardClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, photo: PhotoboothPhoto) => {
      if (flyingRef.current) return;
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const baseWidth = rect.width;
      const viewportWidth = window.innerWidth;
      const targetWidth = Math.min(viewportWidth * 0.85 + 28, 428);
      const targetScale = targetWidth / baseWidth;

      const next: FlyingState = {
        photo,
        x: startX,
        y: startY,
        scale: 1,
        rotate: 0,
        vx: 0,
        vy: 0,
        vs: 0,
        vr: 0,
        phase: 'straighten',
        startX,
        startY,
        startScale: 1,
        targetScale,
        baseWidth,
        clickedIndex: -1,
        isBackground: false,
      };
      flyingRef.current = next;
      setFlying(next);
    },
    []
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (flyingRef.current) return;
    isDraggingRef.current = true;
    draggedRef.current = false;
    startXRef.current = e.clientX;
    lastXRef.current = e.clientX;
    lastTimeRef.current = performance.now();
    swipeVelocityRef.current = 0;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (flyingRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    isDraggingRef.current = true;
    draggedRef.current = false;
    startXRef.current = touch.clientX;
    lastXRef.current = touch.clientX;
    lastTimeRef.current = performance.now();
    swipeVelocityRef.current = 0;
  }, []);

  // GSAP animation for Mobile Marquee Stage
  useEffect(() => {
    if (!mobileMarqueeRef.current) return;

    const ctx = gsap.context(() => {
      const leftTracks = mobileMarqueeRef.current?.querySelectorAll<HTMLElement>(`.${styles.marqueeLeft} .${styles.marqueeTrack}`);
      const rightTracks = mobileMarqueeRef.current?.querySelectorAll<HTMLElement>(`.${styles.marqueeRight} .${styles.marqueeTrack}`);
      const cards = mobileMarqueeRef.current?.querySelectorAll<HTMLElement>(`.${styles.mobilePolaroidCard}`);

      // Entrance animation for cards with GSAP stagger
      if (cards && cards.length > 0) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 25, scale: 0.9, rotate: () => (Math.random() - 0.5) * 6 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            rotate: 0,
            duration: 0.75,
            stagger: 0.03,
            ease: 'back.out(1.2)',
          }
        );
      }

      // Track continuous GSAP marquee loops
      const tweens: gsap.core.Tween[] = [];

      leftTracks?.forEach((track) => {
        const tween = gsap.to(track, {
          xPercent: -50,
          duration: 24,
          ease: 'none',
          repeat: -1,
        });
        tweens.push(tween);
      });

      rightTracks?.forEach((track) => {
        const tween = gsap.fromTo(
          track,
          { xPercent: -50 },
          {
            xPercent: 0,
            duration: 24,
            ease: 'none',
            repeat: -1,
          }
        );
        tweens.push(tween);
      });

      // Pause/resume on hover or touch for enhanced interactive UX
      const stageEl = mobileMarqueeRef.current;
      const slowAll = () => tweens.forEach((t) => gsap.to(t, { timeScale: 0.25, duration: 0.4 }));
      const resumeAll = () => tweens.forEach((t) => gsap.to(t, { timeScale: 1, duration: 0.4 }));

      stageEl?.addEventListener('mouseenter', slowAll);
      stageEl?.addEventListener('mouseleave', resumeAll);
      stageEl?.addEventListener('touchstart', slowAll, { passive: true });
      stageEl?.addEventListener('touchend', resumeAll, { passive: true });
    }, mobileMarqueeRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    setStartReveal(true);
    const marqueeTimer = setTimeout(() => {
      setIsMobileMarqueeActive(true);
    }, 250);

    const reducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      introDoneRef.current = true;
      introStartRef.current = performance.now() - TOTAL_INTRO_DURATION;
    } else {
      introStartRef.current = performance.now() + 200;
    }


    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const clientX = e.clientX;
      const now = performance.now();
      const dt = now - lastTimeRef.current;
      const dx = clientX - lastXRef.current;

      if (Math.abs(clientX - startXRef.current) > 8) {
        draggedRef.current = true;
      }

      const dAngle = dx * 0.0018;
      orbitAngleRef.current += dAngle;
      bgOrbitAngleRef.current -= dAngle * 0.6;

      if (dt > 0) {
        const v = dAngle / dt;
        swipeVelocityRef.current = swipeVelocityRef.current * 0.65 + v * 0.35;
      }

      lastXRef.current = clientX;
      lastTimeRef.current = now;
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const clientX = touch.clientX;
      const now = performance.now();
      const dt = now - lastTimeRef.current;
      const dx = clientX - lastXRef.current;

      if (Math.abs(clientX - startXRef.current) > 8) {
        draggedRef.current = true;
      }

      const dAngle = dx * 0.0018;
      orbitAngleRef.current += dAngle;
      bgOrbitAngleRef.current -= dAngle * 0.6;

      if (dt > 0) {
        const v = dAngle / dt;
        swipeVelocityRef.current = swipeVelocityRef.current * 0.65 + v * 0.35;
      }

      lastXRef.current = clientX;
      lastTimeRef.current = now;
    };

    const handleWindowMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleWindowTouchEnd = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: true });
    window.addEventListener('touchend', handleWindowTouchEnd);

    const loop = (now: number) => {
      const introStart = introStartRef.current ?? now;
      const introElapsed = now - introStart;
      if (introElapsed >= TOTAL_INTRO_DURATION && !introDoneRef.current) {
        introDoneRef.current = true;
        setTriggerShimmer(true);
      }

      const fs = flyingRef.current;
      if (fs) {
        const dt = 1 / 60;

        if (fs.phase === 'straighten') {
          const targetRotate = 0;
          const sx = springToward(fs.x, fs.startX, fs.vx, dt);
          const sy = springToward(fs.y, fs.startY, fs.vy, dt);
          const ss = springToward(fs.scale, fs.startScale, fs.vs, dt);
          const sr = springToward(fs.rotate, targetRotate, fs.vr, dt, 180, 22);

          const settledRotate = Math.abs(sr.value - targetRotate) < 0.25;

          const updated: FlyingState = {
            ...fs,
            x: sx.value,
            y: sy.value,
            scale: ss.value,
            rotate: sr.value,
            vx: sx.velocity,
            vy: sy.velocity,
            vs: ss.velocity,
            vr: sr.velocity,
          };

          if (settledRotate) {
            updated.phase = 'zoom';
          }
          flyingRef.current = updated;
          setFlying(updated);
        } else if (fs.phase === 'zoom') {
          const targetX = window.innerWidth / 2;
          const targetY = window.innerHeight / 2;
          const targetScale = fs.targetScale;
          const targetRotate = 0;

          const sx = springToward(fs.x, targetX, fs.vx, dt, 150, 18);
          const sy = springToward(fs.y, targetY, fs.vy, dt, 150, 18);
          const ss = springToward(fs.scale, targetScale, fs.vs, dt, 150, 18);
          const sr = springToward(fs.rotate, targetRotate, fs.vr, dt, 180, 22);

          const settled =
            Math.abs(sx.value - targetX) < 1.5 &&
            Math.abs(sy.value - targetY) < 1.5 &&
            Math.abs(ss.value - targetScale) < 0.02 &&
            Math.abs(sr.value) < 0.5;

          const updated: FlyingState = {
            ...fs,
            x: sx.value,
            y: sy.value,
            scale: ss.value,
            rotate: sr.value,
            vx: sx.velocity,
            vy: sy.velocity,
            vs: ss.velocity,
            vr: sr.velocity,
          };

          if (settled) {
            updated.phase = 'open';
            updated.x = targetX;
            updated.y = targetY;
            updated.scale = targetScale;
            updated.rotate = targetRotate;
            updated.vx = 0;
            updated.vy = 0;
            updated.vs = 0;
            updated.vr = 0;
          }
          flyingRef.current = updated;
          setFlying(updated);
        } else if (fs.phase === 'closing') {
          let targetX: number;
          let targetY: number;
          let targetScale: number;

          if (fs.clickedIndex === -1) {
            targetX = fs.startX;
            targetY = fs.startY;
            targetScale = fs.startScale;
          } else {
            const slice = (Math.PI * 2) / (fs.isBackground ? BACKGROUND_PHOTOS.length : ORBIT_PHOTOS.length);
            const currentOrbitAngle = fs.isBackground ? bgOrbitAngleRef.current : orbitAngleRef.current;
            const angle = currentOrbitAngle + fs.clickedIndex * slice;
            const depth = depthFromAngle(angle);
            const t = (depth + 1) / 2;

            const depthScale = fs.isBackground
              ? 0.42 + t * (0.65 - 0.42)
              : 0.75 + t * (1.20 - 0.75);

            const rx = fs.isBackground ? BG_ORBIT_RX : ORBIT_RX;
            const ry = fs.isBackground ? BG_ORBIT_RY : ORBIT_RY;
            const pos = orbitPosition(angle, rx, ry);

            targetX = window.innerWidth / 2 + (pos.x * window.innerWidth) / 100;
            targetY = window.innerHeight / 2 + (pos.y * window.innerHeight) / 100;
            targetScale = depthScale;
          }
          const targetRotate = 0;

          const sx = springToward(fs.x, targetX, fs.vx, dt, 150, 18);
          const sy = springToward(fs.y, targetY, fs.vy, dt, 150, 18);
          const ss = springToward(fs.scale, targetScale, fs.vs, dt, 150, 18);
          const sr = springToward(fs.rotate, targetRotate, fs.vr, dt, 180, 22);

          const elapsedClose = fs.closeStartTime ? performance.now() - fs.closeStartTime : 0;
          const settled =
            (Math.abs(sx.value - targetX) < 15 &&
             Math.abs(sy.value - targetY) < 15 &&
             Math.abs(ss.value - targetScale) < 0.08) ||
            elapsedClose > 800;

          const updated: FlyingState = {
            ...fs,
            x: sx.value,
            y: sy.value,
            scale: ss.value,
            rotate: sr.value,
            vx: sx.velocity,
            vy: sy.velocity,
            vs: ss.velocity,
            vr: sr.velocity,
          };

          if (settled) {
            draggedRef.current = false;
            flyingRef.current = null;
            setFlying(null);
          } else {
            flyingRef.current = updated;
            setFlying(updated);
          }
        }
      }

      // Continuous loop - orbit never stops rotating
      if (!reducedMotion) {
        if (isDraggingRef.current) {
          // velocity is updated by drag event listeners
        } else {
          orbitAngleRef.current += (ORBIT_ROTATION_SPEED + swipeVelocityRef.current) * 16.67;
          bgOrbitAngleRef.current += (BG_ORBIT_ROTATION_SPEED - swipeVelocityRef.current * 0.6) * 16.67;

          swipeVelocityRef.current *= 0.95;
          if (Math.abs(swipeVelocityRef.current) < 0.00001) {
            swipeVelocityRef.current = 0;
          }
        }
      }

      bump();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (lightboxTimerRef.current) clearTimeout(lightboxTimerRef.current);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
    };
  }, [bump]);

  const closeLightbox = useCallback(() => {
    const fs = flyingRef.current;
    if (!fs || fs.phase !== 'open') return;

    draggedRef.current = false;

    const next: FlyingState = {
      ...fs,
      phase: 'closing',
      startX: fs.x,
      startY: fs.y,
      startScale: fs.scale,
      closeStartTime: performance.now(),
    };
    flyingRef.current = next;
    setFlying(next);
  }, []);

  const orbitAngle = orbitAngleRef.current;
  const bgOrbitAngle = bgOrbitAngleRef.current;
  void frame;

  return (
    <section
      className={styles.hero}
      aria-labelledby="photobooth-hero-title"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className={`${styles.whiteRevealOverlay} ${startReveal ? styles.activeReveal : ''}`} aria-hidden />
      <div className={styles.heroNoise} aria-hidden />
      <div className={styles.mobileWhiteOverlay} aria-hidden />

      {/* Global Lightbox Backdrop - starts blurring immediately on click */}
      {flying && (
        <button
          type="button"
          className={`${styles.lightboxBackdropGlobal} ${flying.phase === 'closing' ? styles.lightboxBackdropClosing : ''}`}
          onClick={closeLightbox}
          style={{
            pointerEvents: flying.phase === 'open' ? 'auto' : 'none',
          }}
          aria-label="Close"
        />
      )}

      {MARGIN_PLACEMENTS.map(({ word, style }) => (
        <span key={word} className={styles.marginWord} style={style}>
          {word}
        </span>
      ))}

      <div className={styles.heroInner}>
        <header className={styles.brandBlock}>
          <h1
            id="photobooth-hero-title"
            className={`${styles.headline} ${cormorant.className} ${triggerShimmer && !shimmerSettled ? styles.shimmerActive : ''}`}
            onAnimationEnd={(e) => {
              if (e.animationName.includes('titleShimmerAnim')) {
                setShimmerSettled(true);
              }
            }}
          >
            <span className={styles.row1}>
              New Era of
              <span className={styles.headlinePlus} aria-hidden>
                <svg
                  fill="currentColor"
                  viewBox="0 0 32 32"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: '0.7em', height: '0.7em', display: 'inline-block', verticalAlign: 'middle', transform: 'translateY(-0.1em)' }}
                >
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <title>star-of-life</title>
                    <path d="M28.5 22.35l-10.999-6.35 10.999-6.351c0.231-0.131 0.385-0.375 0.385-0.655 0-0.414-0.336-0.75-0.75-0.75-0.142 0-0.275 0.040-0.388 0.108l0.003-0.002-11 6.35v-12.701c0-0.414-0.336-0.75-0.75-0.75s-0.75 0.336-0.75 0.75v0 12.7l-10.999-6.35c-0.11-0.067-0.243-0.106-0.385-0.106-0.414 0-0.75 0.336-0.75 0.75 0 0.28 0.154 0.524 0.381 0.653l0.004 0.002 10.999 6.351-10.999 6.35c-0.226 0.132-0.375 0.374-0.375 0.65 0 0.415 0.336 0.751 0.751 0.751 0 0 0 0 0.001 0h-0c0.138-0.001 0.266-0.037 0.378-0.102l-0.004 0.002 10.999-6.351v12.7c0 0.414 0.336 0.75 0.75 0.75s0.75-0.336 0.75-0.75v0-12.701l11 6.351c0.107 0.063 0.237 0.1 0.374 0.1 0.277 0 0.518-0.149 0.649-0.371l0.002-0.004c0.063-0.108 0.1-0.237 0.1-0.375 0-0.277-0.15-0.518-0.372-0.648l-0.004-0.002z"></path>
                  </g>
                </svg>
              </span>
            </span>
            <span className={styles.row2}>Clicking</span>
          </h1>
          <p className={`${styles.signature} ${caveat.className}`}>
            Smile. Snap. Repeat.
          </p>
        </header>

        <div ref={stageRef} className={styles.orbitStage}>
          {/* Background concentric loop – flowing entry from right */}
          {BACKGROUND_PHOTOS.map((photo, index) => {
            const N = BACKGROUND_PHOTOS.length;
            const slice = (Math.PI * 2) / N;

            // Reversed stagger: farthest-traveling cards enter first
            const reverseIndex = N - 1 - index;
            const cardElapsed = performance.now() - (introStartRef.current ?? performance.now()) - reverseIndex * CARD_STAGGER_DELAY;
            const tRaw = introDoneRef.current
              ? 1
              : cardElapsed <= 0
                ? 0
                : Math.min(1, cardElapsed / CARD_INTRO_DURATION);
            const eased = introDoneRef.current ? 1 : introEase(tRaw);

            // Sweep from base angle (right side) to final orbit position
            const currentAngle = introDoneRef.current
              ? bgOrbitAngle + index * slice
              : bgOrbitAngle + index * slice * eased;

            const depth = depthFromAngle(currentAngle);
            const t = (depth + 1) / 2;
            const depthScale = 0.42 + t * (0.65 - 0.42);
            const zIndex = Math.round(10 + t * 30);
            const { x, y } = orbitPosition(currentAngle, BG_ORBIT_RX, BG_ORBIT_RY);
            const behind = depth < 0;

            // Push entering cards off-screen right (tail effect)
            const entryPush = eased < 1 ? Math.pow(1 - eased, 3) * 15 : 0;
            const ix = x + entryPush;
            const iy = y;

            const transform = `translate3d(calc(-50% + ${ix}vw), calc(-50% + ${iy}vh), 0) rotate(0deg) scale(${depthScale})`;

            const isClicked = flying && flying.clickedIndex === index && flying.isBackground === true;
            const fadeIn = eased < 1 ? Math.min(1, tRaw * 4) : 1;
            const opacity = isClicked ? 0 : (0.28 + t * 0.42) * fadeIn;
            const visibility = isClicked ? 'hidden' : (tRaw <= 0 ? 'hidden' : 'visible');


            return (
              <div
                key={photo.id}
                data-bg-orbit-index={index}
                className={`${styles.orbitPolaroid} ${styles.orbitBgPolaroid} ${behind ? styles.orbitBehind : styles.orbitFront}`}
                style={{
                  transform,
                  opacity,
                  visibility,
                  zIndex,
                  pointerEvents: flying ? 'none' : undefined,
                }}
              >
                <PolaroidFrame
                  photo={photo}
                  interactive
                  onClick={() => handleCardClick(photo, index, true, 0)}
                  priority={false}
                />
              </div>
            );
          })}

          {/* Foreground Concentric Loop – flowing entry from right */}
          {ORBIT_PHOTOS.map((photo, index) => {
            const N = ORBIT_PHOTOS.length;
            const slice = (Math.PI * 2) / N;

            // Reversed stagger: farthest-traveling cards enter first
            const reverseIndex = N - 1 - index;
            const cardElapsed = performance.now() - (introStartRef.current ?? performance.now()) - reverseIndex * CARD_STAGGER_DELAY;
            const tRaw = introDoneRef.current
              ? 1
              : cardElapsed <= 0
                ? 0
                : Math.min(1, cardElapsed / CARD_INTRO_DURATION);
            const eased = introDoneRef.current ? 1 : introEase(tRaw);

            // Sweep from base angle (right side) to final orbit position
            const currentAngle = introDoneRef.current
              ? orbitAngle + index * slice
              : orbitAngle + index * slice * eased;

            const depth = depthFromAngle(currentAngle);
            const t = (depth + 1) / 2;
            const depthScale = 0.75 + t * (1.20 - 0.75);
            const zIndex = Math.round(50 + t * 50);
            const { x, y } = orbitPosition(currentAngle, ORBIT_RX, ORBIT_RY);
            const behind = depth < 0;

            // Push entering cards off-screen right (tail effect)
            const entryPush = eased < 1 ? Math.pow(1 - eased, 3) * 25 : 0;
            const ix = x + entryPush;
            const iy = y;

            const transform = `translate3d(calc(-50% + ${ix}vw), calc(-50% + ${iy}vh), 0) rotate(0deg) scale(${depthScale})`;

            const isClicked = flying && flying.clickedIndex === index && flying.isBackground === false;
            const fadeIn = eased < 1 ? Math.min(1, tRaw * 4) : 1;
            const opacity = isClicked ? 0 : (0.50 + t * 0.50) * fadeIn;
            const visibility = isClicked ? 'hidden' : (tRaw <= 0 ? 'hidden' : 'visible');


            return (
              <div
                key={photo.id}
                data-orbit-index={index}
                className={`${styles.orbitPolaroid} ${behind ? styles.orbitBehind : styles.orbitFront}`}
                style={{
                  transform,
                  opacity,
                  visibility,
                  zIndex,
                  pointerEvents: flying ? 'none' : undefined,
                }}
              >
                <PolaroidFrame
                  photo={photo}
                  interactive
                  onClick={() => handleCardClick(photo, index, false, 0)}
                  priority={index < 2}
                />
              </div>
            );
          })}
        </div>

        {/* Mobile Linear Infinite Marquee Rows (visible <= 768px) */}
        <div ref={mobileMarqueeRef} className={`${styles.mobileMarqueeStage} ${isMobileMarqueeActive ? styles.mobileMarqueeActive : ''}`}>
          {/* Row 1: Left to Right */}
          <div className={`${styles.marqueeRow} ${styles.marqueeLeft}`}>
            <div className={styles.marqueeTrack}>
              {[...ROW_1, ...ROW_1].map((photo, index) => {
                const colorObj = DULL_COLORS[index % DULL_COLORS.length];
                const delay = `${(index % ROW_1.length) * 110}ms`;
                return (
                  <div
                    key={`r1-${photo.id}-${index}`}
                    className={styles.mobilePolaroidCard}
                    style={{
                      '--card-delay': delay,
                      '--dull-color': colorObj.color,
                      '--dull-glow': colorObj.glow,
                      '--dull-color-soft': colorObj.soft,
                    } as React.CSSProperties}
                    onClick={(e) => handleMobileCardClick(e, photo)}
                  >
                    <PolaroidFrame photo={photo} interactive priority={false} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Row 2: Right to Left */}
          <div className={`${styles.marqueeRow} ${styles.marqueeRight}`}>
            <div className={styles.marqueeTrack}>
              {[...ROW_2, ...ROW_2].map((photo, index) => {
                const colorObj = DULL_COLORS[(index + 3) % DULL_COLORS.length];
                const delay = `${(index % ROW_2.length) * 110 + 160}ms`;
                return (
                  <div
                    key={`r2-${photo.id}-${index}`}
                    className={styles.mobilePolaroidCard}
                    style={{
                      '--card-delay': delay,
                      '--dull-color': colorObj.color,
                      '--dull-glow': colorObj.glow,
                      '--dull-color-soft': colorObj.soft,
                    } as React.CSSProperties}
                    onClick={(e) => handleMobileCardClick(e, photo)}
                  >
                    <PolaroidFrame photo={photo} interactive priority={false} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Row 3: Left to Right */}
          <div className={`${styles.marqueeRow} ${styles.marqueeLeft}`}>
            <div className={styles.marqueeTrack}>
              {[...ROW_3, ...ROW_3].map((photo, index) => {
                const colorObj = DULL_COLORS[(index + 5) % DULL_COLORS.length];
                const delay = `${(index % ROW_3.length) * 110 + 320}ms`;
                return (
                  <div
                    key={`r3-${photo.id}-${index}`}
                    className={styles.mobilePolaroidCard}
                    style={{
                      '--card-delay': delay,
                      '--dull-color': colorObj.color,
                      '--dull-glow': colorObj.glow,
                      '--dull-color-soft': colorObj.soft,
                    } as React.CSSProperties}
                    onClick={(e) => handleMobileCardClick(e, photo)}
                  >
                    <PolaroidFrame photo={photo} interactive priority={false} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {flying && (
        <div
          className={`${styles.flyingPolaroid} ${flying.phase === 'open' ? styles.flyingOpen : ''}`}
          style={{
            left: flying.x,
            top: flying.y,
            width: flying.phase === 'open' ? flying.baseWidth * flying.scale : flying.baseWidth,
            transform: `translate(-50%, -50%) rotate(${flying.rotate}deg) scale(${flying.phase === 'open' ? 1 : flying.scale})`,
            pointerEvents: flying.phase === 'open' ? 'auto' : 'none',
            ['--scale' as any]: flying.phase === 'open' ? 1 : flying.scale,
          }}
        >
          <PolaroidFrame
            photo={flying.photo}
            sizes="(max-width: 768px) 90vw, 440px"
          />

          {flying.phase === 'open' && (
            <button
              type="button"
              className={styles.lightboxClose}
              onClick={closeLightbox}
              aria-label="Close"
            >
              <svg
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {(flying.phase === 'open' || flying.phase === 'closing') && (
            <p className={`${styles.lightboxCaption} ${flying.phase === 'closing' ? styles.lightboxCaptionClosing : ''}`}>
              {flying.photo.alt}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
