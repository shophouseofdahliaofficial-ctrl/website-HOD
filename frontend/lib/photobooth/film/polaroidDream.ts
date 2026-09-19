import type { PolaroidDreamSettings } from './types';
import {
  applyPolaroidRadialMotionBlur,
  createRadialMotionBlurScratch,
} from './polaroidMotionBlur';

const clamp255 = (v: number) => Math.max(0, Math.min(255, v));

function pixelLum(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Piecewise matte lift curve from Polaroid Dream reference */
export function polaroidMatteCurve(v: number): number {
  if (v < 64) return 18 + (72 - 18) * (v / 64);
  if (v < 128) return 72 + (135 - 72) * ((v - 64) / 64);
  if (v < 192) return 135 + (205 - 135) * ((v - 128) / 64);
  return 205 + (245 - 205) * ((v - 192) / 63);
}

function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** Pixel grade: saturation, warm/magenta/polaroid shift, matte curve, optional shadow crush */
export function applyPolaroidDreamGrade(
  data: Uint8ClampedArray,
  settings?: PolaroidDreamSettings,
): void {
  const crush = settings?.shadowCrush ?? 0;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * 0.85;
    g = gray + (g - gray) * 0.85;
    b = gray + (b - gray) * 0.85;

    r *= 1.08 * 1.03 * 1.08;
    g *= 0.95 * 0.96;
    b *= 0.9 * 1.03 * 0.9;

    r = polaroidMatteCurve(r);
    g = polaroidMatteCurve(g);
    b = polaroidMatteCurve(b);

    if (crush > 0) {
      const lum = pixelLum(r, g, b);
      if (lum < 160) {
        const t = (160 - lum) / 160;
        const factor = 1 - crush * t * t;
        r *= factor;
        g *= factor;
        b *= factor;
      }
    }

    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
  }
}

export function applyPolaroidDreamGrain(
  data: Uint8ClampedArray,
  settings: PolaroidDreamSettings,
  seed: number,
): void {
  const rand = createSeededRandom(seed);
  const amp = settings.grainNoise;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (rand() - 0.5) * amp;
    data[i] = clamp255(data[i] + noise);
    data[i + 1] = clamp255(data[i + 1] + noise);
    data[i + 2] = clamp255(data[i + 2] + noise);
  }
}

export function applyPolaroidDreamHaze(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: PolaroidDreamSettings,
): void {
  if (settings.hazeOpacity <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(${settings.hazeR},${settings.hazeG},${settings.hazeB},${settings.hazeOpacity})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function applyPolaroidDreamVignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: PolaroidDreamSettings,
): void {
  if (settings.vignetteOpacity <= 0) return;
  const cx = w / 2;
  const cy = h / 2;
  const inner = Math.min(w, h) * settings.vignetteInner;
  const outer = Math.min(w, h) * settings.vignetteOuter;
  const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${settings.vignetteOpacity})`);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** CSS filter pass: brightness, contrast, saturate, sepia, blur */
export function applyPolaroidDreamCssFilter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: PolaroidDreamSettings,
): void {
  const filterCanvas = document.createElement('canvas');
  filterCanvas.width = w;
  filterCanvas.height = h;
  const fCtx = filterCanvas.getContext('2d');
  if (!fCtx) return;

  const { brightness, contrast, saturate, sepia, blurPx } = settings;
  fCtx.filter = [
    `brightness(${brightness})`,
    `contrast(${contrast})`,
    `saturate(${saturate})`,
    `sepia(${sepia})`,
    blurPx > 0 ? `blur(${blurPx}px)` : '',
  ]
    .filter(Boolean)
    .join(' ');

  fCtx.drawImage(ctx.canvas, 0, 0);
  fCtx.filter = 'none';

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(filterCanvas, 0, 0);
}

/** Bloom on bright areas — visible dreamy halation around sky, skin, highlights */
export function applyPolaroidDreamHighlightGlow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: PolaroidDreamSettings,
): void {
  const opacity = settings.highlightGlowOpacity ?? 0;
  if (opacity <= 0) return;

  const blur = settings.highlightGlowBlur ?? 16;
  const threshold = settings.highlightGlowThreshold ?? 150;
  const softness = 48;

  const src = ctx.getImageData(0, 0, w, h);
  const highlightCanvas = document.createElement('canvas');
  highlightCanvas.width = w;
  highlightCanvas.height = h;
  const hCtx = highlightCanvas.getContext('2d');
  if (!hCtx) return;

  const hd = new Uint8ClampedArray(src.data.length);
  for (let i = 0; i < src.data.length; i += 4) {
    const lum = pixelLum(src.data[i], src.data[i + 1], src.data[i + 2]);
    const t = Math.max(0, Math.min(1, (lum - threshold + softness) / softness));
    const m = t * t * (3 - 2 * t);
    hd[i] = src.data[i] * m;
    hd[i + 1] = src.data[i + 1] * m;
    hd[i + 2] = src.data[i + 2] * m;
    hd[i + 3] = 255;
  }
  hCtx.putImageData(new ImageData(hd, w, h), 0, 0);

  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = w;
  blurCanvas.height = h;
  const bCtx = blurCanvas.getContext('2d');
  if (!bCtx) return;

  bCtx.filter = `blur(${blur}px)`;
  bCtx.drawImage(highlightCanvas, 0, 0);
  bCtx.filter = 'none';

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = opacity;
  ctx.drawImage(blurCanvas, 0, 0);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = opacity * 0.72;
  ctx.drawImage(blurCanvas, 0, 0);
  ctx.restore();
}

/** Warm frosted veil — HTML backdrop-filter glow equivalent */
export function applyPolaroidDreamGlow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: PolaroidDreamSettings,
): void {
  if (settings.glowOpacity <= 0) return;

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = w;
  glowCanvas.height = h;
  const gCtx = glowCanvas.getContext('2d');
  if (!gCtx) return;

  gCtx.filter = `blur(${settings.glowBlurPx}px)`;
  gCtx.drawImage(ctx.canvas, 0, 0);
  gCtx.filter = 'none';

  gCtx.globalCompositeOperation = 'source-atop';
  gCtx.fillStyle = 'rgba(255, 232, 205, 0.72)';
  gCtx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = settings.glowOpacity;
  ctx.drawImage(glowCanvas, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = settings.glowOpacity * 0.9;
  ctx.drawImage(glowCanvas, 0, 0);
  ctx.restore();
}

/** Full Polaroid Dream pipeline matching the HTML reference */
export function applyPolaroidDream(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: PolaroidDreamSettings,
  seed = 42,
): void {
  const imageData = ctx.getImageData(0, 0, w, h);
  applyPolaroidDreamGrade(imageData.data, settings);
  ctx.putImageData(imageData, 0, 0);

  const grainData = ctx.getImageData(0, 0, w, h);
  applyPolaroidDreamGrain(grainData.data, settings, seed);
  ctx.putImageData(grainData, 0, 0);

  applyPolaroidDreamHaze(ctx, w, h, settings);
  applyPolaroidDreamVignette(ctx, w, h, settings);
  applyPolaroidDreamCssFilter(ctx, w, h, settings);
  applyPolaroidDreamRadialMotionBlur(ctx, w, h, settings);
  applyPolaroidDreamHighlightGlow(ctx, w, h, settings);
  applyPolaroidDreamGlow(ctx, w, h, settings);
}

/** Surroundings motion blur — subject stays sharp via radial mask */
export function applyPolaroidDreamRadialMotionBlur(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: PolaroidDreamSettings,
): void {
  if ((settings.motionBlurAmount ?? 0) <= 0) return;

  const scratch = createRadialMotionBlurScratch();
  if (!scratch) return;

  scratch.sharp.width = w;
  scratch.sharp.height = h;
  scratch.motion.width = w;
  scratch.motion.height = h;
  scratch.mask.width = w;
  scratch.mask.height = h;

  applyPolaroidRadialMotionBlur(ctx, w, h, settings, scratch, 'full');
}

export function polaroidDreamCssPreview(settings: PolaroidDreamSettings): string {
  const parts = [
    `brightness(${settings.brightness})`,
    `contrast(${settings.contrast})`,
    `saturate(${settings.saturate})`,
    `sepia(${settings.sepia})`,
  ];
  if (settings.blurPx > 0) parts.push(`blur(${settings.blurPx}px)`);
  return parts.join(' ');
}
