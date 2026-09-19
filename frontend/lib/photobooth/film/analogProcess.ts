import type { AnalogSettings } from './types';
import { luminance } from './analyzeImage';
import { organicNoise } from './grain';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp255 = (v: number) => clamp(v, 0, 255);

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Minimal lens blur — only when explicitly enabled; Inst C keeps this at 0 */
export function applyLensSoftness(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  source: HTMLCanvasElement,
  strength: number,
): void {
  if (strength <= 0) return;
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = w;
  blurCanvas.height = h;
  const bCtx = blurCanvas.getContext('2d');
  if (!bCtx) return;
  const radius = 0.4 + strength * 1.4;
  bCtx.filter = `blur(${radius}px)`;
  bCtx.drawImage(source, 0, 0);
  bCtx.filter = 'none';
  ctx.save();
  ctx.globalAlpha = 0.12 + strength * 0.22;
  ctx.drawImage(blurCanvas, 0, 0);
  ctx.restore();
}

/** Light high-frequency taming — preserves edge sharpness, not a beauty soften */
export function applyMicroDetailReduction(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  amount: number,
): void {
  if (amount <= 0) return;
  const orig = ctx.getImageData(0, 0, w, h);
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = w;
  blurCanvas.height = h;
  const bCtx = blurCanvas.getContext('2d');
  if (!bCtx) return;
  bCtx.filter = 'blur(1.5px)';
  bCtx.drawImage(ctx.canvas, 0, 0);
  bCtx.filter = 'none';
  const blurred = bCtx.getImageData(0, 0, w, h);
  const d = orig.data;
  const b = blurred.data;
  const str = amount * 0.55;
  for (let i = 0; i < d.length; i += 4) {
    const lum = luminance(d[i], d[i + 1], d[i + 2]) / 255;
    const edgePreserve = 1 - smoothstep(0.12, 0.42, Math.abs(lum - 0.5)) * 0.15;
    const local = str * edgePreserve;
    d[i] = clamp255(d[i] - (d[i] - b[i]) * local);
    d[i + 1] = clamp255(d[i + 1] - (d[i + 1] - b[i + 1]) * local);
    d[i + 2] = clamp255(d[i + 2] - (d[i + 2] - b[i + 2]) * local);
  }
  ctx.putImageData(orig, 0, 0);
}

/** Instax underexposure curve — darker shadows, compressed blue-gray highlights */
export function compressInstaxTone(l: number, strength: number): number {
  const s = strength;
  let t = l;
  t = t * (1 - s * 0.06) - s * 0.045;
  t = clamp(t, 0, 1);
  if (t < 0.24) {
    t = t * (1 - s * 0.2);
  }
  t = 1 - Math.pow(1 - t, 1 + s * 0.88);
  return clamp(t, 0, 1);
}

/** Cool blue-gray highlight tint only — no blur, no mist, no glow */
export function applyInstaxHighlightTint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength: number,
): void {
  if (strength <= 0) return;

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const coolWhite = [212, 224, 238];

  for (let i = 0; i < d.length; i += 4) {
    const lum = luminance(d[i], d[i + 1], d[i + 2]) / 255;
    const tint = smoothstep(0.58, 0.94, lum) * strength * 0.14;
    d[i] = clamp255(d[i] * (1 - tint) + coolWhite[0] * tint);
    d[i + 1] = clamp255(d[i + 1] * (1 - tint) + coolWhite[1] * tint);
    d[i + 2] = clamp255(d[i + 2] * (1 - tint) + coolWhite[2] * tint);
  }
  ctx.putImageData(img, 0, 0);
}

/** @deprecated use applyInstaxHighlightTint — kept for recipe param name compatibility */
export function applyAtmosphericVeil(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength: number,
): void {
  applyInstaxHighlightTint(ctx, w, h, strength);
}

/** Subtle channel inconsistency — printed-film texture */
export function applyColorDrift(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  strength: number,
  seed: number,
): void {
  if (strength <= 0) return;
  const amt = strength * 6.5;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const driftR = organicNoise(x * 0.018, y * 0.018, seed + 11) * amt * 0.85;
      const driftG = organicNoise(x * 0.016 + 40, y * 0.016, seed + 19) * amt * 0.9;
      const driftB = organicNoise(x * 0.014 + 80, y * 0.014, seed + 27) * amt;
      data[i] = clamp255(data[i] + driftR);
      data[i + 1] = clamp255(data[i + 1] + driftG);
      data[i + 2] = clamp255(data[i + 2] + driftB);
    }
  }
}

export type PastelShiftContext = {
  pastelCompression: number;
  skinPreserve: number;
  greens: number;
  blues: number;
};

/** Instax color compression — muted, cool, chemically shifted; not pastel wash */
export function applyPastelInkShift(
  h: number,
  s: number,
  l: number,
  skin: boolean,
  ctx: PastelShiftContext,
): [number, number, number] {
  const p = ctx.pastelCompression;
  if (p <= 0) return [h, s, l];

  const skinGuard = skin ? ctx.skinPreserve : 0;

  if (h >= 175 && h <= 265) {
    h = h + (ctx.blues - 10 * p);
    s *= 1 - p * 0.38;
    l = l - p * 0.02;
  } else if (h >= 55 && h <= 165) {
    h = h + (ctx.greens - 8 * p) * (1 - skinGuard);
    s *= 1 - p * 0.34;
  } else if ((h >= 340 || h <= 25) && !skin) {
    s *= 1 - p * 0.28;
    l = l - p * 0.02;
  }

  s *= 1 - p * 0.18;
  return [h, s, l];
}

/** Cool crushed shadows — instax black point, not lifted warm gray */
export function applyWarmGrayBlacks(r: number, g: number, b: number, strength: number): [number, number, number] {
  return applyInstaxShadowCrush(r, g, b, strength);
}

export function applyInstaxShadowCrush(
  r: number,
  g: number,
  b: number,
  strength: number,
): [number, number, number] {
  const lum = luminance(r, g, b) / 255;
  if (lum > 0.24) return [r, g, b];
  const t = (0.24 - lum) / 0.24;
  const crush = t * strength * 0.38;
  return [
    clamp255(r * (1 - crush)),
    clamp255(g * (1 - crush * 0.96)),
    clamp255(b * (1 - crush * 0.78)),
  ];
}

export function runAnalogPrepPasses(
  tempCtx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  w: number,
  h: number,
  analog: AnalogSettings,
): void {
  if (analog.lensSoftness > 0) {
    applyLensSoftness(tempCtx, w, h, source, analog.lensSoftness);
  }
  if (analog.microContrast > 0) {
    applyMicroDetailReduction(tempCtx, w, h, analog.microContrast);
  }
}

export function runAnalogPostPasses(
  tempCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
  analog: AnalogSettings,
): void {
  if (analog.atmosphericVeil > 0) {
    applyInstaxHighlightTint(tempCtx, w, h, analog.atmosphericVeil);
  }
}
