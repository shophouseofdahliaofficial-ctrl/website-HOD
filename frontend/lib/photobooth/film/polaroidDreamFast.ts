import type { PolaroidDreamSettings } from './types';
import {
  applyPolaroidDreamGrade,
  applyPolaroidDreamHaze,
  applyPolaroidDreamVignette,
} from './polaroidDream';
import {
  applyPolaroidRadialMotionBlur,
  motionBlurScratchFromPolaroid,
} from './polaroidMotionBlur';

/** Reused offscreen buffers — avoids per-frame canvas allocation in live preview. */
export type PolaroidDreamScratch = {
  filter: HTMLCanvasElement;
  filterCtx: CanvasRenderingContext2D;
  highlight: HTMLCanvasElement;
  highlightCtx: CanvasRenderingContext2D;
  blur: HTMLCanvasElement;
  blurCtx: CanvasRenderingContext2D;
  glow: HTMLCanvasElement;
  glowCtx: CanvasRenderingContext2D;
  highlightData: ImageData | null;
  w: number;
  h: number;
};

export function createPolaroidDreamScratch(): PolaroidDreamScratch | null {
  const filter = document.createElement('canvas');
  const highlight = document.createElement('canvas');
  const blur = document.createElement('canvas');
  const glow = document.createElement('canvas');
  const filterCtx = filter.getContext('2d');
  const highlightCtx = highlight.getContext('2d');
  const blurCtx = blur.getContext('2d');
  const glowCtx = glow.getContext('2d');
  if (!filterCtx || !highlightCtx || !blurCtx || !glowCtx) return null;
  return {
    filter,
    filterCtx,
    highlight,
    highlightCtx,
    blur,
    blurCtx,
    glow,
    glowCtx,
    highlightData: null,
    w: 0,
    h: 0,
  };
}

function ensureScratchSize(scratch: PolaroidDreamScratch, w: number, h: number): void {
  if (scratch.w === w && scratch.h === h) return;
  scratch.w = w;
  scratch.h = h;
  scratch.filter.width = w;
  scratch.highlight.width = w;
  scratch.blur.width = w;
  scratch.glow.width = w;
  scratch.filter.height = h;
  scratch.highlight.height = h;
  scratch.blur.height = h;
  scratch.glow.height = h;
  scratch.highlightData = scratch.highlightCtx.createImageData(w, h);
}

function pixelLum(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function applyCssFilterPass(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: PolaroidDreamSettings,
  scratch: PolaroidDreamScratch,
): void {
  const { brightness, contrast, saturate, sepia, blurPx } = settings;
  const filterStr = [
    `brightness(${brightness})`,
    `contrast(${contrast})`,
    `saturate(${saturate})`,
    `sepia(${sepia})`,
    blurPx > 0 ? `blur(${blurPx}px)` : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!('filter' in scratch.filterCtx)) return;

  scratch.filterCtx.filter = filterStr;
  scratch.filterCtx.drawImage(ctx.canvas, 0, 0);
  scratch.filterCtx.filter = 'none';
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(scratch.filter, 0, 0);
}

function applyPreviewHighlightGlow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: PolaroidDreamSettings,
  scratch: PolaroidDreamScratch,
): void {
  const opacity = settings.highlightGlowOpacity ?? 0;
  if (opacity <= 0) return;

  const blur = Math.max(6, (settings.highlightGlowBlur ?? 16) * 0.55);
  const threshold = settings.highlightGlowThreshold ?? 150;
  const softness = 48;

  if (!scratch.highlightData) {
    scratch.highlightData = scratch.highlightCtx.createImageData(w, h);
  }
  const src = ctx.getImageData(0, 0, w, h);
  const sd = src.data;
  const out = scratch.highlightData.data;

  for (let i = 0; i < sd.length; i += 4) {
    const lum = pixelLum(sd[i], sd[i + 1], sd[i + 2]);
    const t = Math.max(0, Math.min(1, (lum - threshold + softness) / softness));
    const m = t * t * (3 - 2 * t);
    out[i] = sd[i] * m;
    out[i + 1] = sd[i + 1] * m;
    out[i + 2] = sd[i + 2] * m;
    out[i + 3] = 255;
  }
  scratch.highlightCtx.putImageData(scratch.highlightData, 0, 0);

  scratch.blurCtx.filter = `blur(${blur}px)`;
  scratch.blurCtx.drawImage(scratch.highlight, 0, 0);
  scratch.blurCtx.filter = 'none';

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = opacity * 0.92;
  ctx.drawImage(scratch.blur, 0, 0);
  ctx.restore();
}

function applyPreviewDreamGlow(
  ctx: CanvasRenderingContext2D,
  settings: PolaroidDreamSettings,
  scratch: PolaroidDreamScratch,
): void {
  if (settings.glowOpacity <= 0) return;

  const blur = Math.max(4, settings.glowBlurPx * 0.75);
  scratch.glowCtx.filter = `blur(${blur}px)`;
  scratch.glowCtx.drawImage(ctx.canvas, 0, 0);
  scratch.glowCtx.filter = 'none';
  scratch.glowCtx.globalCompositeOperation = 'source-atop';
  scratch.glowCtx.fillStyle = 'rgba(255, 232, 205, 0.72)';
  scratch.glowCtx.fillRect(0, 0, scratch.w, scratch.h);
  scratch.glowCtx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = settings.glowOpacity * 1.05;
  ctx.drawImage(scratch.glow, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = settings.glowOpacity * 0.55;
  ctx.drawImage(scratch.glow, 0, 0);
  ctx.restore();
}

function applyPreviewGrain(
  data: Uint8ClampedArray,
  settings: PolaroidDreamSettings,
  seed: number,
): void {
  let s = seed >>> 0;
  const amp = settings.grainNoise;
  for (let i = 0; i < data.length; i += 8) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const noise = ((s / 0xffffffff) - 0.5) * amp;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    if (i + 4 < data.length) {
      data[i + 4] = Math.max(0, Math.min(255, data[i + 4] + noise * 0.92));
      data[i + 5] = Math.max(0, Math.min(255, data[i + 5] + noise * 0.92));
      data[i + 6] = Math.max(0, Math.min(255, data[i + 6] + noise * 0.92));
    }
  }
}

/** Live-preview pipeline — same look, optimized for 30–60 fps. */
export function applyPolaroidDreamFast(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: PolaroidDreamSettings,
  scratch: PolaroidDreamScratch,
  seed = 42,
): void {
  ensureScratchSize(scratch, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  applyPolaroidDreamGrade(imageData.data, settings);
  applyPreviewGrain(imageData.data, settings, seed);
  ctx.putImageData(imageData, 0, 0);

  applyPolaroidDreamHaze(ctx, w, h, settings);
  applyPolaroidDreamVignette(ctx, w, h, settings);
  applyCssFilterPass(ctx, w, h, settings, scratch);
  applyPolaroidRadialMotionBlur(
    ctx,
    w,
    h,
    settings,
    motionBlurScratchFromPolaroid(scratch),
    'fast',
  );
  applyPreviewHighlightGlow(ctx, w, h, settings, scratch);
  applyPreviewDreamGlow(ctx, settings, scratch);
}
