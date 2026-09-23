'use client';

import React, { useEffect, useRef } from 'react';
import styles from './ProductBackgroundWatermark.module.css';

export default function ProductBackgroundWatermark() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;

    // Unit text & font configuration
    const textUnit = 'HOUSE OF DAHLIA   •   ';
    const baseFontSize = 8; // 0.5rem @ 16px root
    const rowHeightCss = 15.5; // vertical spacing between rows

    // Speed variations in CSS pixels per millisecond
    const speeds = [0.016, 0.022, 0.018, 0.025];

    let unitWidth = 0;

    const updateDimensions = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      // Configure font
      ctx.font = `600 ${baseFontSize * dpr}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = '#e5b3be';
      ctx.textBaseline = 'middle';

      // Measure repeat text unit
      unitWidth = ctx.measureText(textUnit).width;
    };

    updateDimensions();

    const handleResize = () => {
      updateDimensions();
    };

    window.addEventListener('resize', handleResize, { passive: true });

    let isVisible = !document.hidden;
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        lastTime = performance.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let lastTime = performance.now();
    let totalTime = 0;

    const render = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(render);

      if (!isVisible) return;

      const dt = Math.min(currentTime - lastTime, 100);
      lastTime = currentTime;
      totalTime += dt;

      // Clear frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (unitWidth <= 0) return;

      // Ensure canvas font & style persist across canvas state resets
      ctx.font = `600 ${baseFontSize * dpr}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = '#e5b3be';
      ctx.textBaseline = 'middle';

      const rowHeight = rowHeightCss * dpr;
      const totalRows = Math.ceil((height * dpr) / rowHeight) + 1;
      const canvasWidth = width * dpr;

      for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
        const y = rowIndex * rowHeight + rowHeight * 0.5;
        const isLeft = rowIndex % 2 === 0;
        const speed = speeds[rowIndex % speeds.length] * dpr;
        const direction = isLeft ? -1 : 1;

        // Calculate continuous offset
        const rawOffset = totalTime * speed * direction;
        let startX = rawOffset % unitWidth;
        if (startX > 0) startX -= unitWidth;

        // Draw repeats across current row
        for (let x = startX - unitWidth; x < canvasWidth + unitWidth * 2; x += unitWidth) {
          ctx.fillText(textUnit, x, y);
        }
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.watermarkCanvas} aria-hidden="true" />;
}
