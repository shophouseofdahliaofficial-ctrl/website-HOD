'use client';

import React, { useEffect, useRef } from 'react';
import styles from './FluidHealingEffect.module.css';

interface FluidDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  decayRate: number;
  isBroken: boolean; // whether fast velocity broke the continuous fluid bridge
  wobblePhase: number;
  wobbleSpeed: number;
  satelliteDrops: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    life: number;
  }>;
}

export default function FluidHealingEffect() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const drops: FluidDrop[] = [];
    let lastX = -1000;
    let lastY = -1000;
    let lastScrollY = window.scrollY || window.pageYOffset;
    let lastActivityTime = Date.now();
    let isLoopRunning = false;

    const resizeCanvas = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const addDrop = (x: number, y: number, vx: number, vy: number, isFastBreak: boolean) => {
      lastActivityTime = Date.now();
      const speed = Math.sqrt(vx * vx + vy * vy);

      // Smooth organic fluid radius
      const baseRadius = isFastBreak
        ? Math.min(50, Math.max(14, 38 - speed * 0.3 + Math.random() * 16)) // Broken scattered droplet beads
        : Math.min(72, Math.max(26, speed * 1.2 + 24)); // Thick continuous fluid stream

      // Spawn satellite spray beads during fast breaks or flicks
      const satelliteDrops: FluidDrop['satelliteDrops'] = [];
      const sprayCount = isFastBreak ? Math.floor(Math.random() * 4 + 2) : (Math.random() < 0.25 ? 1 : 0);
      
      for (let i = 0; i < sprayCount; i++) {
        const perpAngle = Math.atan2(vy, vx) + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2) + (Math.random() - 0.5) * 0.9;
        const spraySpeed = isFastBreak ? (Math.random() * 3 + 1.5) : 0.8;
        const offsetDist = baseRadius * (0.8 + Math.random() * 1.2);

        satelliteDrops.push({
          x: x + Math.cos(perpAngle) * offsetDist,
          y: y + Math.sin(perpAngle) * offsetDist,
          vx: Math.cos(perpAngle) * spraySpeed + (Math.random() - 0.5),
          vy: Math.sin(perpAngle) * spraySpeed + (Math.random() - 0.5),
          radius: Math.random() * (isFastBreak ? 7 : 4) + 2.5,
          life: 1.0,
        });
      }

      drops.push({
        x,
        y,
        vx: vx * 0.03,
        vy: vy * 0.03,
        radius: baseRadius,
        life: 1.0,
        // Slower, luxurious viscous healing decay
        decayRate: 0.965 + Math.random() * 0.015,
        isBroken: isFastBreak,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.04 + Math.random() * 0.04,
        satelliteDrops,
      });

      // Keep drop limit bounded
      if (drops.length > 250) {
        drops.shift();
      }

      if (!isLoopRunning) {
        isLoopRunning = true;
        animId = requestAnimationFrame(render);
      }
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e) {
        if (e.touches.length === 0) return;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      if (lastX < -500) {
        lastX = clientX;
        lastY = clientY;
        return;
      }

      const dx = clientX - lastX;
      const dy = clientY - lastY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 3) return;

      // FAST MOVEMENT DETECTION: When mouse speed exceeds threshold, break the fluid into beads!
      const FAST_SPEED_THRESHOLD = 26;
      const isFastBreak = dist > FAST_SPEED_THRESHOLD;

      if (isFastBreak) {
        // Fast sweep: spawn broken, discrete droplet beads with wider spacing and scatter
        const steps = Math.min(8, Math.max(2, Math.floor(dist / 22)));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const jitterX = (Math.random() - 0.5) * 12;
          const jitterY = (Math.random() - 0.5) * 12;
          addDrop(lastX + dx * t + jitterX, lastY + dy * t + jitterY, dx, dy, true);
        }
      } else {
        // Moderate/slow sweep: tightly interpolate into a smooth, unbroken liquid stream
        const steps = Math.min(14, Math.max(1, Math.floor(dist / 10)));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          addDrop(lastX + dx * t, lastY + dy * t, dx, dy, false);
        }
      }

      lastX = clientX;
      lastY = clientY;
    };

    const handleScroll = () => {
      const currentScrollY = window.scrollY || window.pageYOffset;
      const scrollDelta = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;

      if (Math.abs(scrollDelta) < 3) return;

      const isFastScroll = Math.abs(scrollDelta) > 35;
      const spawnX = lastX > 0 ? lastX : width * 0.5;
      const spawnY = lastY > 0 ? lastY : height * 0.5;

      addDrop(spawnX, spawnY, (Math.random() - 0.5) * 6, -scrollDelta * 0.35, isFastScroll);
    };

    const handlePointerLeave = () => {
      lastX = -1000;
      lastY = -1000;
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const now = Date.now();
      const idleTime = now - lastActivityTime;
      const isHealing = idleTime > 90; // Gentle onset before healing kicks in

      if (drops.length > 0) {
        // 1. Update fluid drops & satellite beads (slower viscous pace)
        for (let i = 0; i < drops.length; i++) {
          const drop = drops[i];
          drop.wobblePhase += drop.wobbleSpeed;

          if (isHealing) {
            // Slower, smooth exponential healing
            drop.radius *= drop.decayRate;
            drop.life *= 0.975;
            drop.x += drop.vx * 0.3;
            drop.y += drop.vy * 0.3;
          } else {
            // Subtle slow decay while actively drawing
            drop.radius *= 0.995;
            drop.life *= 0.997;
          }

          if (drop.radius < 0.6 || drop.life < 0.02) {
            drops.splice(i, 1);
            i--;
            continue;
          }

          // Update & render satellite fluid beads
          for (let s = 0; s < drop.satelliteDrops.length; s++) {
            const sat = drop.satelliteDrops[s];
            sat.x += sat.vx;
            sat.y += sat.vy;
            sat.radius *= isHealing ? 0.96 : 0.99;
            sat.life *= 0.97;

            if (sat.radius > 0.6) {
              ctx.beginPath();
              ctx.arc(sat.x, sat.y, sat.radius, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.fill();
            }
          }
        }

        // 2. Draw smooth continuous liquid bridges
        // Connected ONLY when movement wasn't broken by fast speed AND drops are thick enough
        for (let i = 1; i < drops.length; i++) {
          const p1 = drops[i - 1];
          const p2 = drops[i];

          // If either drop was created during a fast break, do NOT connect - keep them as broken beads!
          if (p1.isBroken || p2.isBroken) {
            continue;
          }

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const minRadius = Math.min(p1.radius, p2.radius);
          const maxAllowedDist = (p1.radius + p2.radius) * 1.7;

          // Connect only while above fluid necking threshold (14px) and within bridge distance
          if (minRadius >= 14 && dist < maxAllowedDist && dist > 1) {
            const normX = -dy / dist;
            const normY = dx / dist;

            const r1 = p1.radius * 0.92;
            const r2 = p2.radius * 0.92;
            const midX = (p1.x + p2.x) * 0.5;
            const midY = (p1.y + p2.y) * 0.5;
            const midR = ((r1 + r2) * 0.5) * 0.82;

            ctx.beginPath();
            ctx.moveTo(p1.x + normX * r1, p1.y + normY * r1);
            ctx.quadraticCurveTo(midX + normX * midR, midY + normY * midR, p2.x + normX * r2, p2.y + normY * r2);
            ctx.lineTo(p2.x - normX * r2, p2.y - normY * r2);
            ctx.quadraticCurveTo(midX - normX * midR, midY - normY * midR, p1.x - normX * r1, p1.y - normY * r1);
            ctx.closePath();
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          }
        }

        // 3. Render each fluid drop as an ultra-smooth round liquid bead
        for (let i = 0; i < drops.length; i++) {
          const drop = drops[i];
          const organicWobble = Math.sin(drop.wobblePhase) * (drop.radius * 0.04);
          const displayRadius = Math.max(1, drop.radius + organicWobble);

          ctx.beginPath();
          ctx.arc(drop.x, drop.y, displayRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
      }

      if (drops.length > 0) {
        animId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
        isLoopRunning = false;
      }
    };

    window.addEventListener('resize', resizeCanvas, { passive: true });
    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeave);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mouseleave', handlePointerLeave);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className={styles.fluidCanvasContainer} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.fluidCanvas} />
    </div>
  );
}
