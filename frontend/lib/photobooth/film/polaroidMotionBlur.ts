import type { PolaroidDreamSettings } from './types';

export type RadialMotionBlurScratch = {
  sharp: HTMLCanvasElement;
  sharpCtx: CanvasRenderingContext2D;
  motion: HTMLCanvasElement;
  motionCtx: CanvasRenderingContext2D;
  mask: HTMLCanvasElement;
  maskCtx: CanvasRenderingContext2D;
};

type MotionBlurQuality = 'full' | 'fast';

function getMotionBlurParams(settings: PolaroidDreamSettings) {
  const amount = settings.motionBlurAmount ?? 0;
  if (amount <= 0) return null;
  return {
    amount,
    distance: settings.motionBlurDistance ?? 12,
    angleDeg: settings.motionBlurAngle ?? 5,
    centerRadius: settings.motionBlurCenterRadius ?? 0.34,
    falloff: settings.motionBlurFalloff ?? 0.58,
  };
}

function drawDirectionalMotionBlur(
  destCtx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  w: number,
  h: number,
  distance: number,
  angleDeg: number,
  steps: number,
): void {
  if (distance <= 0 || steps < 2) {
    destCtx.drawImage(source, 0, 0, w, h);
    return;
  }

  const rad = (angleDeg * Math.PI) / 180;
  const vx = Math.cos(rad) * distance;
  const vy = Math.sin(rad) * distance;

  destCtx.setTransform(1, 0, 0, 1, 0, 0);
  destCtx.globalCompositeOperation = 'source-over';
  destCtx.clearRect(0, 0, w, h);
  destCtx.globalAlpha = 1 / steps;

  for (let i = 0; i < steps; i++) {
    const t = (i / (steps - 1)) * 2 - 1;
    destCtx.drawImage(source, vx * t * 0.5, vy * t * 0.5, w, h);
  }

  destCtx.globalAlpha = 1;
}

function buildRadialSharpMask(
  maskCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
  centerRadius: number,
  falloff: number,
  amount: number,
): void {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.hypot(w, h) * 0.5;
  const innerR = Math.max(1, maxR * centerRadius);
  const outerR = Math.max(innerR + 1, maxR * Math.min(1, centerRadius + falloff));
  const peak = Math.min(1, 0.15 + amount * 0.85);

  maskCtx.setTransform(1, 0, 0, 1, 0, 0);
  maskCtx.clearRect(0, 0, w, h);
  const grad = maskCtx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  grad.addColorStop(0, `rgba(255,255,255,${peak})`);
  grad.addColorStop(0.35, `rgba(255,255,255,${peak * 0.72})`);
  grad.addColorStop(0.72, `rgba(255,255,255,${peak * 0.18})`);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  maskCtx.fillStyle = grad;
  maskCtx.fillRect(0, 0, w, h);
}

/** Radial motion blur — sharp center (subject), streaked surroundings. */
export function applyPolaroidRadialMotionBlur(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: PolaroidDreamSettings,
  scratch: RadialMotionBlurScratch,
  quality: MotionBlurQuality = 'full',
): void {
  const params = getMotionBlurParams(settings);
  if (!params) return;

  const steps = quality === 'fast' ? 6 : 11;
  const distance = (quality === 'fast' ? params.distance * 0.72 : params.distance) * params.amount;

  scratch.sharpCtx.drawImage(ctx.canvas, 0, 0, w, h);
  drawDirectionalMotionBlur(
    scratch.motionCtx,
    ctx.canvas,
    w,
    h,
    distance,
    params.angleDeg,
    steps,
  );

  buildRadialSharpMask(
    scratch.maskCtx,
    w,
    h,
    params.centerRadius,
    params.falloff,
    params.amount,
  );

  scratch.sharpCtx.globalCompositeOperation = 'destination-in';
  scratch.sharpCtx.drawImage(scratch.mask, 0, 0);
  scratch.sharpCtx.globalCompositeOperation = 'source-over';

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(scratch.motion, 0, 0);
  ctx.drawImage(scratch.sharp, 0, 0);
}

export function createRadialMotionBlurScratch(): RadialMotionBlurScratch | null {
  const sharp = document.createElement('canvas');
  const motion = document.createElement('canvas');
  const mask = document.createElement('canvas');
  const sharpCtx = sharp.getContext('2d');
  const motionCtx = motion.getContext('2d');
  const maskCtx = mask.getContext('2d');
  if (!sharpCtx || !motionCtx || !maskCtx) return null;
  return { sharp, sharpCtx, motion, motionCtx, mask, maskCtx };
}

/** Map PolaroidDreamScratch buffers to motion-blur scratch (reuse, no extra allocation). */
export function motionBlurScratchFromPolaroid(
  scratch: {
    filter: HTMLCanvasElement;
    filterCtx: CanvasRenderingContext2D;
    blur: HTMLCanvasElement;
    blurCtx: CanvasRenderingContext2D;
    glow: HTMLCanvasElement;
    glowCtx: CanvasRenderingContext2D;
  },
): RadialMotionBlurScratch {
  return {
    sharp: scratch.filter,
    sharpCtx: scratch.filterCtx,
    motion: scratch.blur,
    motionCtx: scratch.blurCtx,
    mask: scratch.glow,
    maskCtx: scratch.glowCtx,
  };
}
