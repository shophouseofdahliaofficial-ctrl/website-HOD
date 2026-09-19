import type { InstSQOpticalFalloff } from './types';

export type OpticalFalloffScratch = {
  sharp: HTMLCanvasElement;
  sharpCtx: CanvasRenderingContext2D;
  fgBlur: HTMLCanvasElement;
  fgBlurCtx: CanvasRenderingContext2D;
  bgBlur: HTMLCanvasElement;
  bgBlurCtx: CanvasRenderingContext2D;
  curvBlur: HTMLCanvasElement;
  curvBlurCtx: CanvasRenderingContext2D;
  mask: HTMLCanvasElement;
  maskCtx: CanvasRenderingContext2D;
};

function blurCopy(
  dest: CanvasRenderingContext2D,
  source: CanvasImageSource,
  w: number,
  h: number,
  px: number,
): void {
  dest.setTransform(1, 0, 0, 1, 0, 0);
  dest.filter = px > 0 ? `blur(${px}px)` : 'none';
  dest.clearRect(0, 0, w, h);
  dest.drawImage(source, 0, 0, w, h);
  dest.filter = 'none';
}

function compositeMasked(
  ctx: CanvasRenderingContext2D,
  maskCtx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  source: CanvasImageSource,
  fill: string | CanvasGradient,
  w: number,
  h: number,
): void {
  maskCtx.setTransform(1, 0, 0, 1, 0, 0);
  maskCtx.clearRect(0, 0, w, h);
  maskCtx.drawImage(source, 0, 0, w, h);
  maskCtx.globalCompositeOperation = 'destination-in';
  maskCtx.fillStyle = fill;
  maskCtx.fillRect(0, 0, w, h);
  maskCtx.globalCompositeOperation = 'source-over';
  ctx.drawImage(maskCanvas, 0, 0);
}

/**
 * Cheap Instax SQ optics — subject plane readable, foreground/background melt, corner field curvature.
 * Not uniform Gaussian; depth-weighted compositing of separate blur planes.
 */
export function applyInstSQOpticalFalloff(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  falloff: InstSQOpticalFalloff,
  scratch: OpticalFalloffScratch,
  quality: 'full' | 'fast',
): void {
  if (falloff.strength <= 0) return;

  const strength = falloff.strength;
  const scale = quality === 'fast' ? 0.72 : 1;
  const fgPx = falloff.foregroundBlur * scale;
  const bgPx = falloff.backgroundBlur * scale;
  const curvPx = falloff.fieldCurvature * scale;
  const focusY = falloff.focusCenterY * h;
  const bandHalf = falloff.focusBandHeight * h * 0.5;

  scratch.sharpCtx.setTransform(1, 0, 0, 1, 0, 0);
  scratch.sharpCtx.drawImage(ctx.canvas, 0, 0, w, h);

  blurCopy(scratch.fgBlurCtx, scratch.sharp, w, h, fgPx);
  blurCopy(scratch.bgBlurCtx, scratch.sharp, w, h, bgPx);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(scratch.sharp, 0, 0);

  const topGrad = scratch.maskCtx.createLinearGradient(0, 0, 0, h);
  topGrad.addColorStop(0, `rgba(255,255,255,${strength})`);
  topGrad.addColorStop(Math.max(0.06, falloff.backgroundReach), `rgba(255,255,255,${strength * 0.88})`);
  topGrad.addColorStop(Math.min(0.94, falloff.backgroundReach + 0.2), 'rgba(255,255,255,0)');
  topGrad.addColorStop(1, 'rgba(255,255,255,0)');
  compositeMasked(ctx, scratch.maskCtx, scratch.mask, scratch.bgBlur, topGrad, w, h);

  const botGrad = scratch.maskCtx.createLinearGradient(0, 0, 0, h);
  botGrad.addColorStop(0, 'rgba(255,255,255,0)');
  botGrad.addColorStop(Math.min(0.94, 1 - falloff.foregroundReach - 0.2), 'rgba(255,255,255,0)');
  botGrad.addColorStop(Math.max(0.06, 1 - falloff.foregroundReach), `rgba(255,255,255,${strength * 0.92})`);
  botGrad.addColorStop(1, `rgba(255,255,255,${strength})`);
  compositeMasked(ctx, scratch.maskCtx, scratch.mask, scratch.fgBlur, botGrad, w, h);

  if (curvPx > 0) {
    blurCopy(scratch.curvBlurCtx, scratch.sharp, w, h, curvPx);
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.hypot(w, h) * 0.52;
    const cornerGrad = scratch.maskCtx.createRadialGradient(cx, cy, maxR * 0.38, cx, cy, maxR);
    cornerGrad.addColorStop(0, 'rgba(255,255,255,0)');
    cornerGrad.addColorStop(0.62, 'rgba(255,255,255,0)');
    cornerGrad.addColorStop(1, `rgba(255,255,255,${strength * falloff.fieldCurvatureStrength})`);
    compositeMasked(ctx, scratch.maskCtx, scratch.mask, scratch.curvBlur, cornerGrad, w, h);
  }

  const cx = w / 2;
  const innerR = Math.min(w, h) * falloff.focusBandInner;
  const outerR = Math.max(innerR + 2, bandHalf);
  const focusGrad = scratch.maskCtx.createRadialGradient(cx, focusY, innerR, cx, focusY, outerR);
  focusGrad.addColorStop(0, `rgba(255,255,255,${0.35 * strength})`);
  focusGrad.addColorStop(0.5, `rgba(255,255,255,${0.2 * strength})`);
  focusGrad.addColorStop(1, 'rgba(255,255,255,0)');
  compositeMasked(ctx, scratch.maskCtx, scratch.mask, scratch.sharp, focusGrad, w, h);
}

export function opticalScratchFromInstSQ(scratch: {
  emulsion: HTMLCanvasElement;
  emulsionCtx: CanvasRenderingContext2D;
  soft: HTMLCanvasElement;
  softCtx: CanvasRenderingContext2D;
  edge: HTMLCanvasElement;
  edgeCtx: CanvasRenderingContext2D;
  bloom: HTMLCanvasElement;
  bloomCtx: CanvasRenderingContext2D;
  bloomBlur: HTMLCanvasElement;
  bloomBlurCtx: CanvasRenderingContext2D;
}): OpticalFalloffScratch {
  return {
    sharp: scratch.emulsion,
    sharpCtx: scratch.emulsionCtx,
    fgBlur: scratch.soft,
    fgBlurCtx: scratch.softCtx,
    bgBlur: scratch.edge,
    bgBlurCtx: scratch.edgeCtx,
    curvBlur: scratch.bloomBlur,
    curvBlurCtx: scratch.bloomBlurCtx,
    mask: scratch.bloom,
    maskCtx: scratch.bloomCtx,
  };
}
