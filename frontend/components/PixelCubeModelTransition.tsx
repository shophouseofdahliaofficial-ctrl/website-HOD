'use client';

import React, { useEffect, useRef, useState } from 'react';

interface PixelCubeModelTransitionProps {
  modelIndex: number;
  triggerEntry: boolean;
  className?: string;
  children?: React.ReactNode;
}

// Staggered reveal order where the 3rd model (index 2) resolves FIRST, followed randomly by others
const REVEAL_DELAYS: Record<number, number> = {
  2: 0.05, // Model 3 FIRST!
  6: 0.20, // Model 7
  0: 0.35, // Model 1
  8: 0.48, // Model 9
  3: 0.62, // Model 4
  7: 0.75, // Model 8
  1: 0.88, // Model 2
  4: 1.02, // Model 5
  9: 1.15, // Model 10
  5: 1.28, // Model 6
};

export default function PixelCubeModelTransition({
  modelIndex,
  triggerEntry,
  className,
  children,
}: PixelCubeModelTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelWrapperRef = useRef<HTMLDivElement>(null);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    if (!triggerEntry) {
      setIsResolved(false);
      if (modelWrapperRef.current) {
        modelWrapperRef.current.style.opacity = '1';
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let startTime: number | null = null;
    const delay = REVEAL_DELAYS[modelIndex] ?? 0.4;
    const DURATION = 0.55; // Total duration of random cube disintegration

    const width = (canvas.width = canvas.offsetWidth || 320);
    const height = (canvas.height = canvas.offsetHeight || 520);

    const CUBE_SIZE = 14;
    const cols = Math.ceil(width / CUBE_SIZE);
    const rows = Math.ceil(height / CUBE_SIZE);

    // Generate mannequin silhouette bounded cube coordinates
    interface Cube {
      col: number;
      row: number;
      baseColor: string;
      disappearStart: number;
      disappearDuration: number;
    }

    const cubes: Cube[] = [];
    const centerX = cols / 2;

    for (let r = 0; r < rows; r++) {
      // Approximate vertical mannequin silhouette curve (head, shoulders, waist taper, dress, legs)
      const normY = r / rows;
      let halfSpan = 0;

      if (normY < 0.12) {
        halfSpan = 1.8;
      } else if (normY < 0.18) {
        halfSpan = 1.2;
      } else if (normY < 0.38) {
        halfSpan = 3.6;
      } else if (normY < 0.50) {
        halfSpan = 2.4;
      } else if (normY < 0.65) {
        halfSpan = 4.0;
      } else if (normY < 0.88) {
        halfSpan = 2.2;
      } else {
        halfSpan = 2.6;
      }

      for (let c = Math.floor(centerX - halfSpan); c <= Math.ceil(centerX + halfSpan); c++) {
        if (c >= 0 && c < cols) {
          const distFromCenter = Math.abs(c - centerX);
          if (distFromCenter > halfSpan * 0.75 && Math.random() > 0.65) {
            continue;
          }

          cubes.push({
            col: c,
            row: r,
            baseColor: '#ffffff',
            disappearStart: Math.random() * (DURATION - 0.12),
            disappearDuration: 0.08 + Math.random() * 0.08,
          });
        }
      }
    }

    let lastBlinkTime = 0;
    let currentBlinkOpacity = 1;

    const render = (time: number) => {
      if (!startTime) startTime = time;
      const elapsed = (time - startTime) / 1000;

      ctx.clearRect(0, 0, width, height);

      if (elapsed < delay) {
        // Before dissolve starts: Model is hidden under solid pixel cubes
        if (modelWrapperRef.current) {
          modelWrapperRef.current.style.opacity = '0';
        }

        for (const cube of cubes) {
          ctx.fillStyle = cube.baseColor;
          ctx.fillRect(
            cube.col * CUBE_SIZE,
            cube.row * CUBE_SIZE,
            CUBE_SIZE,
            CUBE_SIZE
          );
        }
        animId = requestAnimationFrame(render);
        return;
      }

      // Dissolve phase: Model fast blinks (every ~35ms) until all cubes are gone
      if (time - lastBlinkTime > 35) {
        lastBlinkTime = time;
        currentBlinkOpacity = Math.random() > 0.35 ? 1 : 0.08;
      }
      if (modelWrapperRef.current) {
        modelWrapperRef.current.style.opacity = String(currentBlinkOpacity);
      }

      const dissolveElapsed = elapsed - delay;
      let remainingCount = 0;

      for (const cube of cubes) {
        if (dissolveElapsed < cube.disappearStart) {
          remainingCount++;
          ctx.fillStyle = cube.baseColor;
          ctx.fillRect(
            cube.col * CUBE_SIZE,
            cube.row * CUBE_SIZE,
            CUBE_SIZE,
            CUBE_SIZE
          );
        } else if (dissolveElapsed < cube.disappearStart + cube.disappearDuration) {
          remainingCount++;
          const t = (dissolveElapsed - cube.disappearStart) / cube.disappearDuration;
          const currentScale = Math.max(0, 1 - Math.pow(t, 1.6));
          const currentOpacity = Math.max(0, 1 - t);
          const currentSize = CUBE_SIZE * currentScale;

          if (currentSize > 0.5 && currentOpacity > 0.02) {
            ctx.save();
            ctx.globalAlpha = currentOpacity;
            ctx.fillStyle = cube.baseColor;

            const cx = cube.col * CUBE_SIZE + CUBE_SIZE / 2;
            const cy = cube.row * CUBE_SIZE + CUBE_SIZE / 2;

            ctx.fillRect(
              cx - currentSize / 2,
              cy - currentSize / 2,
              currentSize,
              currentSize
            );
            ctx.restore();
          }
        }
      }

      if (remainingCount === 0 || dissolveElapsed >= DURATION + 0.1) {
        ctx.clearRect(0, 0, width, height);
        if (modelWrapperRef.current) {
          modelWrapperRef.current.style.opacity = '1'; // Settle cleanly to solid normal model
        }
        setIsResolved(true);
        return;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      if (modelWrapperRef.current) {
        modelWrapperRef.current.style.opacity = '1';
      }
    };
  }, [triggerEntry, modelIndex]);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        ref={modelWrapperRef}
        style={{
          width: '100%',
          height: '100%',
          transition: 'opacity 0.04s ease-out',
        }}
      >
        {children}
      </div>

      {!isResolved && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 25,
          }}
        />
      )}
    </div>
  );
}
