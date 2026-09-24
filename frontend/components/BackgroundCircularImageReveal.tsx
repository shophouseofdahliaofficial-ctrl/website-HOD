'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import styles from './BackgroundCircularImageReveal.module.css';

interface BackgroundCircularImageRevealProps {
  isActive: boolean;
  imageSrc?: string;
  onToggle?: () => void;
}

export default function BackgroundCircularImageReveal({
  isActive,
  imageSrc = '/nature_3dmodel.png',
  onToggle,
}: BackgroundCircularImageRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const activeImageSrcRef = useRef(imageSrc);
  if (isActive && imageSrc) {
    activeImageSrcRef.current = imageSrc;
  }
  const animTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onToggle) {
        e.preventDefault();
        onToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onToggle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const image = imageRef.current;

    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (animTimelineRef.current) {
      animTimelineRef.current.kill();
    }

    if (isActive) {
      setIsVisible(true);

      const width = (canvas.width = window.innerWidth);
      const height = (canvas.height = window.innerHeight);

      // Start with solid white canvas covering the background image
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      if (image) {
        gsap.set(image, { scale: 1.04, opacity: 1 });
      }
      gsap.set(container, { opacity: 1 });

      const pseudoRandom = (seed: number) => {
        const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
        return x - Math.floor(x);
      };

      const PIXEL_SIZE = 22;
      const cols = Math.ceil(width / PIXEL_SIZE);
      const rows = Math.ceil(height / PIXEL_SIZE);
      const tileSize = PIXEL_SIZE + 0.8; // 0.8px subpixel overlap eliminates seam lines

      const cx = width / 2;
      const cy = height / 2;
      const maxDist = Math.hypot(cx, cy);

      // Luxury alphanumeric cipher character set matching Preloader
      const GLYPHS = ['H', 'O', 'D', '0', '1', '7', '8', '9', 'A', 'E', 'X', 'Z', 'V', 'K', '3', '4', 'F', '+', '§', 'Ø', '9', '2'];
      const fontSize = Math.max(8, Math.round(PIXEL_SIZE * 0.52));

      const progressObj = { val: 0 };

      const tl = gsap.timeline();
      animTimelineRef.current = tl;

      // 1. Single center dot blinks
      const dotSize = Math.round(PIXEL_SIZE * 1.3);
      const dotPx = Math.round(cx - dotSize / 2);
      const dotPy = Math.round(cy - dotSize / 2);
      const blinkState = { alpha: 0 };

      const drawBlinkFrame = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        if (blinkState.alpha > 0.01) {
          ctx.fillStyle = `rgba(0, 0, 0, ${(blinkState.alpha * 0.35).toFixed(3)})`;
          ctx.fillRect(dotPx, dotPy, dotSize, dotSize);
        }
      };

      // Initial blink pulse
      tl.set(blinkState, { alpha: 1.0, onUpdate: drawBlinkFrame });
      tl.to(blinkState, {
        alpha: 0.0,
        duration: 0.28,
        ease: 'power2.out',
        onUpdate: drawBlinkFrame,
      });

      // 2. Circular mark white pixel spread across the entire background behind the 3D model
      tl.to(
        progressObj,
        {
          val: 1,
          duration: 3.0,
          ease: 'power2.inOut',
          onUpdate: () => {
            ctx.clearRect(0, 0, width, height);

            const rThreshold = progressObj.val * (maxDist * 1.45);
            const noiseScale = Math.min(1.0, progressObj.val * 3.5);
            const coronaZone = PIXEL_SIZE * 9.0;
            const crestWidth = PIXEL_SIZE * 2.2;
            const dissolveZone = PIXEL_SIZE * 10.0;

            ctx.font = `600 ${fontSize}px 'Inter', -apple-system, monospace, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let c = 0; c < cols; c++) {
              for (let r = 0; r < rows; r++) {
                const px = c * PIXEL_SIZE;
                const py = r * PIXEL_SIZE;
                const dist = Math.hypot(px + PIXEL_SIZE / 2 - cx, py + PIXEL_SIZE / 2 - cy);
                const angle = Math.atan2(py + PIXEL_SIZE / 2 - cy, px + PIXEL_SIZE / 2 - cx);

                // Multi-frequency organic stepped noise curve scaling with radius
                const wave1 = Math.sin(angle * 5) * 0.18;
                const wave2 = Math.sin(angle * 11 + 1.4) * 0.14;
                const randomSpike = (pseudoRandom(c * 19 + r * 37) - 0.5) * 0.4;
                const noise = (wave1 + wave2 + randomSpike) * (rThreshold * 0.32 * noiseScale);

                const effectiveDist = dist + noise;
                const delta = rThreshold - effectiveDist;

                if (delta < -coronaZone) {
                  // Outer white mask
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(px, py, tileSize, tileSize);
                } else if (delta < 0) {
                  // Forward Spreading Fringe (Solid white base with emerging subtle cipher glyphs)
                  const growProgress = (delta + coronaZone) / coronaZone;
                  const cellSeed = pseudoRandom(c * 137 + r * 283);

                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(px, py, tileSize, tileSize);

                  if (cellSeed < 0.75 * noiseScale) {
                    const cubeAlpha = Math.min(1.0, Math.pow(growProgress, 1.1) * 1.15);

                    if (pseudoRandom(c * 47 + r * 73) < 0.5) {
                      const gIdx =
                        Math.floor(
                          (pseudoRandom(c * 101 + r * 131) + progressObj.val * 4) * GLYPHS.length
                        ) % GLYPHS.length;
                      ctx.fillStyle = `rgba(0, 0, 0, ${(cubeAlpha * 0.35).toFixed(3)})`;
                      ctx.fillText(GLYPHS[gIdx], px + PIXEL_SIZE / 2, py + PIXEL_SIZE / 2);
                    }
                  }
                } else if (delta < crestWidth) {
                  // Active boundary pixel crest (pure white pixel block with crisp glyph)
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(px, py, tileSize, tileSize);

                  if (pseudoRandom(c * 23 + r * 41) < 0.6) {
                    const gIdx =
                      Math.floor(
                        (pseudoRandom(c * 67 + r * 89) + progressObj.val * 5) * GLYPHS.length
                      ) % GLYPHS.length;
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                    ctx.fillText(GLYPHS[gIdx], px + PIXEL_SIZE / 2, py + PIXEL_SIZE / 2);
                  }
                } else if (delta < crestWidth + dissolveZone) {
                  // Trailing Dissolution Zone: white cubes shrink & fade, revealing background image
                  const dissolveProgress = (delta - crestWidth) / dissolveZone;
                  const cellSeed = pseudoRandom(c * 43 + r * 67);

                  if (cellSeed < 0.65 * (1 - dissolveProgress * 0.5)) {
                    const shrinkScale = Math.max(0, 1.0 - Math.pow(dissolveProgress, 1.15));
                    const fadeAlpha = Math.max(0, Math.pow(1.0 - dissolveProgress, 1.35));
                    const cubeSize = PIXEL_SIZE * shrinkScale;
                    const pOffset = (PIXEL_SIZE - cubeSize) / 2;

                    ctx.fillStyle = `rgba(255, 255, 255, ${fadeAlpha.toFixed(3)})`;
                    ctx.fillRect(px + pOffset, py + pOffset, cubeSize, cubeSize);

                    if (shrinkScale > 0.48 && pseudoRandom(c * 31 + r * 53) < 0.5) {
                      const gIdx =
                        Math.floor(
                          (pseudoRandom(c * 71 + r * 97) + progressObj.val * 3) * GLYPHS.length
                        ) % GLYPHS.length;
                      ctx.fillStyle = `rgba(0, 0, 0, ${(fadeAlpha * 0.65).toFixed(3)})`;
                      ctx.fillText(GLYPHS[gIdx], px + PIXEL_SIZE / 2, py + PIXEL_SIZE / 2);
                    }
                  }
                }
              }
            }
          },
          onComplete: () => {
            ctx.clearRect(0, 0, width, height);
          },
        },
        0.15
      );

      // Subtle smooth camera settle on the image behind the 3D model
      if (image) {
        tl.to(
          image,
          {
            scale: 1.0,
            duration: 3.4,
            ease: 'power2.out',
          },
          0.15
        );
      }
    } else {
      // Smooth fade-out back to clean white Phase 2 background
      const tl = gsap.timeline({
        onComplete: () => {
          setIsVisible(false);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        },
      });
      animTimelineRef.current = tl;

      tl.to(container, {
        opacity: 0,
        duration: 0.55,
        ease: 'power2.inOut',
      });
    }

    return () => {
      if (animTimelineRef.current) {
        animTimelineRef.current.kill();
      }
    };
  }, [isActive, imageSrc]);

  return (
    <div
      ref={containerRef}
      className={styles.backgroundLayer}
      style={{
        display: isVisible || isActive ? 'block' : 'none',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      {/* Landscape Image Behind 3D Model */}
      <div className={styles.imageWrap}>
        <img
          ref={imageRef}
          src={activeImageSrcRef.current || imageSrc}
          alt="Visual Background Specimen"
          className={styles.backgroundImage}
          draggable={false}
        />
        <div className={styles.ambientOverlay} />
      </div>

      {/* Circular Pixel Mark Canvas Transition */}
      <canvas ref={canvasRef} className={styles.pixelCanvas} />
    </div>
  );
}
