import type { InstSQRecipe } from './types';

export type InstSQMotionScratch = {
  sharp: HTMLCanvasElement;
  sharpCtx: CanvasRenderingContext2D;
  motion: HTMLCanvasElement;
  motionCtx: CanvasRenderingContext2D;
  mask: HTMLCanvasElement;
  maskCtx: CanvasRenderingContext2D;
};

/**
 * Radial smear from frame center — no fixed diagonal angle.
 * Approximates edge-only radial motion blur without directional streaks.
 */
function drawRadialMotionBlur(
  destCtx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  w: number,
  h: number,
  distance: number,
  steps: number,
): void {
  if (distance <= 0 || steps < 2) {
    destCtx.drawImage(source, 0, 0, w, h);
    return;
  }
  const cx = w / 2;
  const cy = h / 2;
  destCtx.setTransform(1, 0, 0, 1, 0, 0);
  destCtx.clearRect(0, 0, w, h);
  destCtx.globalAlpha = 1 / steps;

  for (let i = 0; i < steps; i++) {
    const t = (i / (steps - 1)) * 2 - 1;
    const scale = 1 + (distance / Math.max(w, h)) * t * 0.04;
    destCtx.setTransform(scale, 0, 0, scale, cx * (1 - scale), cy * (1 - scale));
    destCtx.drawImage(source, 0, 0, w, h);
  }

  destCtx.setTransform(1, 0, 0, 1, 0, 0);
  destCtx.globalAlpha = 1;
}

/** Inst SQ radial motion blur — edges only; center stays sharp. Independent from Inst C. */
export function applyInstSQRadialMotionBlur(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  motion: InstSQRecipe['motionBlur'],
  scratch: InstSQMotionScratch,
  quality: 'full' | 'fast',
): void {
  if (motion.amount <= 0) return;

  const steps = quality === 'fast' ? 5 : 7;
  const distance = (quality === 'fast' ? motion.distance * 0.7 : motion.distance) * motion.amount;

  scratch.sharpCtx.setTransform(1, 0, 0, 1, 0, 0);
  scratch.sharpCtx.globalCompositeOperation = 'source-over';
  scratch.sharpCtx.drawImage(ctx.canvas, 0, 0, w, h);

  drawRadialMotionBlur(scratch.motionCtx, ctx.canvas, w, h, distance, steps);

  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.hypot(w, h) * 0.5;
  const innerR = Math.max(1, maxR * motion.centerRadius);
  const outerR = Math.max(innerR + 1, maxR * Math.min(1, motion.centerRadius + motion.falloff));
  const peak = Math.min(1, 0.1 + motion.amount * 0.75);

  scratch.maskCtx.clearRect(0, 0, w, h);
  const grad = scratch.maskCtx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, `rgba(255,255,255,${peak * 0.28})`);
  grad.addColorStop(1, `rgba(255,255,255,${peak})`);
  scratch.maskCtx.fillStyle = grad;
  scratch.maskCtx.fillRect(0, 0, w, h);

  scratch.motionCtx.globalCompositeOperation = 'destination-in';
  scratch.motionCtx.drawImage(scratch.mask, 0, 0);
  scratch.motionCtx.globalCompositeOperation = 'source-over';

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(scratch.sharp, 0, 0);
  ctx.drawImage(scratch.motion, 0, 0);
}

export function createInstSQMotionScratch(): InstSQMotionScratch | null {
  const sharp = document.createElement('canvas');
  const motion = document.createElement('canvas');
  const mask = document.createElement('canvas');
  const sharpCtx = sharp.getContext('2d');
  const motionCtx = motion.getContext('2d');
  const maskCtx = mask.getContext('2d');
  if (!sharpCtx || !motionCtx || !maskCtx) return null;
  return { sharp, sharpCtx, motion, motionCtx, mask, maskCtx };
}
