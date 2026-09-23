'use client';

import React, { useEffect, useRef } from 'react';
import styles from './DoctorStrangeDimension.module.css';

const CLOUDINARY_IMG = 'https://res.cloudinary.com/hythbqu9/image/upload/v1790086286/Untitled_design_34_1.png';

interface CloneConfig {
  angle: number;
  distance: number;
  rotZ: number;
  rotX: number;
  rotY: number;
  scale: number;
  zDepth: number;
  opacity: number;
}

const TIME_CLONES: CloneConfig[] = [
  // Ring 1: Inner Multiverse Orbit (8 clones)
  { angle: 0, distance: 340, rotZ: 18, rotX: 15, rotY: 10, scale: 0.9, zDepth: -60, opacity: 0.95 },
  { angle: 45, distance: 380, rotZ: -24, rotX: -12, rotY: 18, scale: 0.86, zDepth: -90, opacity: 0.92 },
  { angle: 90, distance: 320, rotZ: 32, rotX: 22, rotY: 0, scale: 0.92, zDepth: -45, opacity: 0.96 },
  { angle: 135, distance: 390, rotZ: -36, rotX: 18, rotY: -16, scale: 0.88, zDepth: -85, opacity: 0.92 },
  { angle: 180, distance: 350, rotZ: 26, rotX: -16, rotY: -22, scale: 0.9, zDepth: -65, opacity: 0.95 },
  { angle: 225, distance: 400, rotZ: -18, rotX: -22, rotY: -12, scale: 0.86, zDepth: -100, opacity: 0.91 },
  { angle: 270, distance: 330, rotZ: 42, rotX: -26, rotY: 8, scale: 0.93, zDepth: -50, opacity: 0.96 },
  { angle: 315, distance: 370, rotZ: -28, rotX: 12, rotY: 22, scale: 0.87, zDepth: -75, opacity: 0.93 },

  // Ring 2: Far Multiverse Shards (6 clones)
  { angle: 20, distance: 640, rotZ: 55, rotX: 32, rotY: 28, scale: 0.76, zDepth: -180, opacity: 0.88 },
  { angle: 80, distance: 600, rotZ: -48, rotX: 28, rotY: -32, scale: 0.78, zDepth: -160, opacity: 0.9 },
  { angle: 140, distance: 660, rotZ: 62, rotX: -36, rotY: -26, scale: 0.73, zDepth: -210, opacity: 0.85 },
  { angle: 200, distance: 620, rotZ: -56, rotX: -32, rotY: 22, scale: 0.75, zDepth: -190, opacity: 0.87 },
  { angle: 260, distance: 650, rotZ: 48, rotX: -22, rotY: 36, scale: 0.74, zDepth: -200, opacity: 0.86 },
  { angle: 320, distance: 610, rotZ: -68, rotX: 36, rotY: -22, scale: 0.77, zDepth: -170, opacity: 0.89 },

  // Ring 3: Deep Time Loop Void (4 depth tunnel clones)
  { angle: 55, distance: 180, rotZ: 95, rotX: 45, rotY: 45, scale: 0.58, zDepth: -400, opacity: 0.7 },
  { angle: 175, distance: 200, rotZ: -95, rotX: -45, rotY: -45, scale: 0.5, zDepth: -550, opacity: 0.6 },
  { angle: 295, distance: 190, rotZ: 130, rotX: 42, rotY: -42, scale: 0.44, zDepth: -700, opacity: 0.5 },
  { angle: 0, distance: 0, rotZ: 180, rotX: 0, rotY: 0, scale: 0.38, zDepth: -850, opacity: 0.4 },
];

export default function DoctorStrangeDimension() {
  const stageRef = useRef<HTMLDivElement>(null);
  const primeRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const cloneRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let mouseX = 0;
    let mouseY = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;
    let animId: number;

    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      mouseX = (e.clientX / innerWidth - 0.5) * 2;
      mouseY = (e.clientY / innerHeight - 0.5) * 2;
      targetTiltY = mouseX * 14;
      targetTiltX = -mouseY * 14;
    };

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const vh = window.innerHeight || 800;
      const isMobile = window.innerWidth <= 768;
      const distanceScale = isMobile ? 0.52 : 1.0;

      // 1. Phase 1 to Phase 2 Entrance Rise:
      // At scrollY = 0 (top of Phase 1): image is hidden (opacity: 0, 75vh down below screen)
      // As user scrolls down (from 0.15*vh to 0.95*vh): image rises smoothly up to center (0vh) and fades in
      const entranceStart = vh * 0.15;
      const entranceEnd = vh * 0.95;
      const riseProgress = Math.min(1, Math.max(0, (scrollY - entranceStart) / (entranceEnd - entranceStart)));
      const riseEase = Math.pow(riseProgress, 1.15);
      const riseY = (1 - riseEase) * 75; // In vh
      const primeOpacity = Math.min(1, riseProgress * 2.2);

      if (primeRef.current) {
        primeRef.current.style.transform = `translate3d(-50%, calc(-50% + ${riseY.toFixed(1)}vh), 0)`;
        primeRef.current.style.opacity = `${primeOpacity.toFixed(2)}`;
        primeRef.current.style.pointerEvents = primeOpacity > 0.6 ? 'auto' : 'none';
      }

      // 2. Doctor Strange Dimension Multiplication:
      // Starts once image has risen into Phase 2 (scrollY >= vh * 0.85)
      const dimensionStart = vh * 0.85;
      const dimensionRange = vh * 1.5;
      const dimensionProgress = Math.min(1, Math.max(0, (scrollY - dimensionStart) / dimensionRange));
      const fanProgress = Math.pow(dimensionProgress, 1.12);

      if (glowRef.current) {
        glowRef.current.style.opacity = `${(Math.min(1, fanProgress * 1.6) * primeOpacity).toFixed(2)}`;
      }

      cloneRefs.current.forEach((cloneEl, index) => {
        if (!cloneEl) return;
        const config = TIME_CLONES[index];
        if (!config) return;

        if (fanProgress <= 0.005 || primeOpacity <= 0.01) {
          cloneEl.style.opacity = '0';
          cloneEl.style.transform = `translate3d(-50%, calc(-50% + ${riseY.toFixed(1)}vh), 0) scale(1)`;
          return;
        }

        const rad = (config.angle * Math.PI) / 180;
        const currentDist = config.distance * distanceScale * fanProgress;
        const posX = Math.cos(rad) * currentDist;
        const posY = Math.sin(rad) * currentDist;
        const posZ = config.zDepth * fanProgress;

        const currentRotZ = config.rotZ * fanProgress;
        const currentRotX = config.rotX * fanProgress;
        const currentRotY = config.rotY * fanProgress;
        const currentScale = 1 + (config.scale - 1) * fanProgress;
        const currentOpacity = Math.min(config.opacity, fanProgress * 2.8) * primeOpacity;

        cloneEl.style.opacity = `${currentOpacity.toFixed(2)}`;
        cloneEl.style.transform = `translate3d(calc(-50% + ${posX.toFixed(1)}px), calc(-50% + ${riseY.toFixed(1)}vh + ${posY.toFixed(1)}px), ${posZ.toFixed(1)}px) rotateX(${currentRotX.toFixed(1)}deg) rotateY(${currentRotY.toFixed(1)}deg) rotateZ(${currentRotZ.toFixed(1)}deg) scale(${currentScale.toFixed(3)})`;
      });
    };

    const updateLoop = () => {
      currentTiltX += (targetTiltX - currentTiltX) * 0.08;
      currentTiltY += (targetTiltY - currentTiltY) * 0.08;

      if (stageRef.current) {
        stageRef.current.style.transform = `rotateX(${currentTiltX.toFixed(2)}deg) rotateY(${currentTiltY.toFixed(2)}deg)`;
      }

      animId = requestAnimationFrame(updateLoop);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    handleScroll();
    animId = requestAnimationFrame(updateLoop);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className={styles.fixedStage} aria-hidden="true">
      <div ref={stageRef} className={styles.dimensionStage}>
        {/* Ambient Doctor Strange Time Rift Glow */}
        <div ref={glowRef} className={styles.ambientTimeGlow} />

        {/* Multiverse Time Clones */}
        {TIME_CLONES.map((_, index) => (
          <div
            key={`clone-${index}`}
            ref={(el) => {
              cloneRefs.current[index] = el;
            }}
            className={styles.cloneWrapper}
            style={{ opacity: 0 }}
          >
            <img
              src={CLOUDINARY_IMG}
              alt="Doctor Strange Time Clone"
              className={styles.dimensionImage}
              loading="eager"
            />
          </div>
        ))}

        {/* Central Prime Anchor Image */}
        <div ref={primeRef} className={styles.primeImageWrapper} style={{ opacity: 0 }}>
          <img
            src={CLOUDINARY_IMG}
            alt="House Of Dahlia Prime Key"
            className={styles.primeImage}
            loading="eager"
          />
        </div>
      </div>
    </div>
  );
}
