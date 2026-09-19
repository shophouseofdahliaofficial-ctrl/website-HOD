import type { AdaptedParams, FilmRecipe, HighlightRolloffSettings, ProcessResult } from './types';
import { adaptRecipeToImage, analyzeImageData, luminance, pixelSaturation } from './analyzeImage';
import {
  applyPastelInkShift,
  applyWarmGrayBlacks,
  applyColorDrift,
  compressInstaxTone,
  runAnalogPostPasses,
  runAnalogPrepPasses,
} from './analogProcess';
import { filmGrainClumpAt, organicNoise, shadowMidtoneWeight } from './grain';
import { applyPolaroidDream } from './polaroidDream';
import { INST_C_RECIPE } from './recipes/inst-c';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp255 = (v: number) => clamp(v, 0, 255);

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  const t2r = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [t2r(hk + 1 / 3) * 255, t2r(hk) * 255, t2r(hk - 1 / 3) * 255];
}

function isSkinHue(h: number, s: number): boolean {
  return s > 0.08 && h >= 5 && h <= 55;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Film shoulder — compress highlights into cool blue-gray (Instax), not cream glow.
 */
function applyFilmHighlightRolloff(
  r: number,
  g: number,
  b: number,
  rolloff: HighlightRolloffSettings,
): [number, number, number] {
  const lum = luminance(r, g, b) / 255;
  const knee = rolloff.knee;

  if (lum <= knee) return [r, g, b];

  const targetLum = luminance(rolloff.whitePointR, rolloff.whitePointG, rolloff.whitePointB) / 255;
  const t = smoothstep(knee, 0.98, lum);
  const shoulder = 1 - Math.pow(t, 1.75) * rolloff.strength;

  const compressedLum = knee + (lum - knee) * shoulder * (1 - t * 0.4);
  const finalLum = compressedLum + (targetLum - compressedLum) * t * 0.48;
  const scale = finalLum / Math.max(lum, 0.001);

  let nr = r * scale;
  let ng = g * scale;
  let nb = b * scale;

  const coolBlend = t * 0.34;
  nr = nr * (1 - coolBlend) + rolloff.whitePointR * coolBlend;
  ng = ng * (1 - coolBlend) + rolloff.whitePointG * coolBlend;
  nb = nb * (1 - coolBlend) + rolloff.whitePointB * coolBlend;

  const maxChannel = Math.max(nr, ng, nb);
  const cap = Math.min(rolloff.whitePointB, 242);
  if (maxChannel > cap) {
    const s = cap / maxChannel;
    nr *= s;
    ng *= s;
    nb *= s;
  }

  return [nr, ng, nb];
}

function applyColorGrade(
  data: Uint8ClampedArray,
  recipe: FilmRecipe,
  adapted: AdaptedParams,
): void {
  const exp = Math.pow(2, adapted.exposure);
  const con = adapted.contrast;
  const sat = adapted.saturation;
  const temp = recipe.temperature / 100;
  const tint = recipe.tint / 100;
  const fade = recipe.fade;
  const skinPreserve = recipe.hueShifts.skinPreserve;
  const tonalCompression = recipe.analog?.tonalCompression ?? 0;
  const pastelCompression = recipe.analog?.pastelCompression ?? 0;
  const pastelCtx = {
    pastelCompression,
    skinPreserve,
    greens: recipe.hueShifts.greens,
    blues: recipe.hueShifts.blues,
  };

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    r *= exp;
    g *= exp;
    b *= exp;

    let lum = luminance(r, g, b) / 255;

    if (tonalCompression > 0) {
      const compressed = compressInstaxTone(lum, tonalCompression);
      const scale = compressed / Math.max(lum, 0.001);
      r *= scale;
      g *= scale;
      b *= scale;
      lum = compressed;
    }

    const blackLift = recipe.blacks * smoothstep(0, 0.35, 1 - lum);
    r += blackLift;
    g += blackLift;
    b += blackLift;

    const localCon = con * (1 - tonalCompression * 0.18);
    r = 128 + (r - 128) * localCon;
    g = 128 + (g - 128) * localCon;
    b = 128 + (b - 128) * localCon;

    r += temp * 14 - tint * 4;
    g -= tint * 8;
    b -= temp * 14 + tint * 2;

    const avg = (r + g + b) / 3;
    if (avg < 128) {
      const f = (128 - avg) / 128;
      r += recipe.shadows * f;
      g += recipe.shadows * f;
      b += recipe.shadows * f;
    } else {
      const f = (avg - 128) / 128;
      r += adapted.highlights * f;
      g += adapted.highlights * f;
      b += adapted.highlights * f;
    }

    if (avg > 180) {
      const f = (avg - 180) / 75;
      const cool = recipe.whites * f;
      r += cool * 0.42;
      g += cool * 0.62;
      b += cool * 0.95;
    }

    let [h, s, l] = rgbToHsl(r, g, b);

    const skin = isSkinHue(h, s);
    const satMul = skin ? 1 + (sat - 1) * (1 - skinPreserve) : sat;
    s *= satMul;

    if (pastelCompression <= 0) {
      if (h >= 60 && h <= 160) {
        h += recipe.hueShifts.greens * (1 - skinPreserve * (skin ? 1 : 0));
      } else if (h >= 180 && h <= 260) {
        h += recipe.hueShifts.blues;
      }
    } else {
      [h, s, l] = applyPastelInkShift(h, s, l, skin, pastelCtx);
    }

    l = l + fade * (0.5 - Math.abs(l - 0.5));

    [r, g, b] = hslToRgb(h, clamp(s, 0, 1), clamp(l, 0, 1));

    if (tonalCompression > 0) {
      [r, g, b] = applyWarmGrayBlacks(r, g, b, tonalCompression * 0.85);
    }

    [r, g, b] = applyFilmHighlightRolloff(r, g, b, recipe.highlightRolloff);

    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
  }
}

function extractHighlightMask(
  data: Uint8ClampedArray,
  threshold: number,
  softness: number,
): Float32Array {
  const mask = new Float32Array(data.length / 4);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = luminance(data[i], data[i + 1], data[i + 2]) / 255;
    mask[p] = smoothstep(threshold - softness, threshold + softness, lum);
  }
  return mask;
}

function applyMaskedHighlightBlur(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mask: Float32Array,
  intensity: number,
  radius: number,
  blendMode: GlobalCompositeOperation,
): void {
  if (intensity <= 0) return;

  const highlightCanvas = document.createElement('canvas');
  highlightCanvas.width = w;
  highlightCanvas.height = h;
  const hCtx = highlightCanvas.getContext('2d');
  if (!hCtx) return;

  const img = ctx.getImageData(0, 0, w, h);
  const hd = img.data;
  for (let i = 0, p = 0; i < hd.length; i += 4, p++) {
    const m = mask[p];
    hd[i] = hd[i] * m;
    hd[i + 1] = hd[i + 1] * m;
    hd[i + 2] = hd[i + 2] * m;
  }
  hCtx.putImageData(img, 0, 0);

  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = w;
  blurCanvas.height = h;
  const bCtx = blurCanvas.getContext('2d');
  if (!bCtx) return;

  bCtx.save();
  bCtx.filter = `blur(${radius}px)`;
  bCtx.drawImage(highlightCanvas, 0, 0);
  bCtx.restore();

  ctx.save();
  ctx.globalAlpha = intensity;
  ctx.globalCompositeOperation = blendMode;
  ctx.drawImage(blurCanvas, 0, 0);
  ctx.restore();
}

function applyHighlightBloom(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mask: Float32Array,
  intensity: number,
  radius: number,
): void {
  applyMaskedHighlightBlur(ctx, w, h, mask, intensity, radius, 'screen');
}

function applyLensDiffusion(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mask: Float32Array,
  recipe: FilmRecipe['lensDiffusion'],
): void {
  applyMaskedHighlightBlur(
    ctx,
    w,
    h,
    mask,
    recipe.intensity,
    recipe.radius,
    'soft-light',
  );
}

function applyHalation(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mask: Float32Array,
  recipe: FilmRecipe['halation'],
): void {
  const src = ctx.getImageData(0, 0, w, h);
  const halCanvas = document.createElement('canvas');
  halCanvas.width = w;
  halCanvas.height = h;
  const halCtx = halCanvas.getContext('2d');
  if (!halCtx) return;

  const hd = new Uint8ClampedArray(src.data.length);
  for (let i = 0, p = 0; i < src.data.length; i += 4, p++) {
    const r = src.data[i];
    const g = src.data[i + 1];
    const b = src.data[i + 2];
    const lum = luminance(r, g, b) / 255;
    const m = mask[p] * smoothstep(recipe.threshold - recipe.softness, recipe.threshold + recipe.softness, lum);
    const redBleed = r * recipe.redBleed * m;
    hd[i] = clamp255(redBleed);
    hd[i + 1] = clamp255(redBleed * 0.12);
    hd[i + 2] = 0;
    hd[i + 3] = clamp255(m * 255 * recipe.intensity * 2.5);
  }
  halCtx.putImageData(new ImageData(hd, w, h), 0, 0);

  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = w;
  blurCanvas.height = h;
  const bCtx = blurCanvas.getContext('2d');
  if (!bCtx) return;

  bCtx.save();
  bCtx.filter = `blur(${recipe.radius}px)`;
  bCtx.drawImage(halCanvas, 0, 0);
  bCtx.restore();

  ctx.save();
  ctx.globalAlpha = recipe.intensity;
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(blurCanvas, 0, 0);
  ctx.restore();
}

function applyFilmGrain(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  recipe: FilmRecipe['grain'],
  seed: number,
): void {
  const amt = recipe.amount * 0.76;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = luminance(data[i], data[i + 1], data[i + 2]);
      const weight = shadowMidtoneWeight(lum, recipe.midtoneBoost);
      const clump = filmGrainClumpAt(x, y, recipe.size, seed);
      const fine = organicNoise(x * 0.85, y * 0.85, seed + 5) * 0.5;
      const n = (clump * 0.68 + fine * 0.32) * amt * weight;
      data[i] = clamp255(data[i] + n * 0.92);
      data[i + 1] = clamp255(data[i + 1] + n * 0.96);
      data[i + 2] = clamp255(data[i + 2] + n * 1.08);
    }
  }
}

function applyVignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  recipe: FilmRecipe['vignette'],
): void {
  if (recipe.strength <= 0) return;
  const cx = w / 2;
  const cy = h / 2;
  const inner = Math.min(w, h) * (0.38 + recipe.softness * 0.12);
  const outer = Math.max(w, h) * (0.72 + recipe.roundness * 0.08);
  const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(18,16,14,${recipe.strength * 0.55})`);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export type ApplyRecipeOptions = {
  seed?: number;
  skipEffects?: boolean;
};

/** Full Inst C / film recipe pipeline: analyze → adapt → grade → bloom → halation → grain → vignette */
export function applyFilmRecipe(
  canvas: HTMLCanvasElement,
  recipe: FilmRecipe,
  options: ApplyRecipeOptions = {},
): ProcessResult | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const w = canvas.width;
  const h = canvas.height;
  if (w === 0 || h === 0) return null;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
  if (!tempCtx) return null;

  tempCtx.drawImage(canvas, 0, 0);

  const rawData = tempCtx.getImageData(0, 0, w, h);
  const stats = analyzeImageData(rawData.data, w, h);
  const adapted = adaptRecipeToImage(recipe, stats);

  if (recipe.polaroidDream?.enabled && !options.skipEffects) {
    applyPolaroidDream(tempCtx, w, h, recipe.polaroidDream, options.seed ?? 42);
  } else if (!recipe.polaroidDream?.enabled) {
    if (recipe.analog && !options.skipEffects) {
      runAnalogPrepPasses(tempCtx, tempCanvas, w, h, recipe.analog);
    }

    const graded = tempCtx.getImageData(0, 0, w, h);
    applyColorGrade(graded.data, recipe, adapted);
    tempCtx.putImageData(graded, 0, 0);

    if (!options.skipEffects) {
      const bloomMask = extractHighlightMask(graded.data, recipe.bloom.threshold, recipe.bloom.softness);
      applyHighlightBloom(tempCtx, w, h, bloomMask, recipe.bloom.intensity, recipe.bloom.radius);

      const diffMask = extractHighlightMask(graded.data, recipe.lensDiffusion.threshold, recipe.lensDiffusion.softness);
      applyLensDiffusion(tempCtx, w, h, diffMask, recipe.lensDiffusion);

      const halMask = extractHighlightMask(graded.data, recipe.halation.threshold, recipe.halation.softness);
      applyHalation(tempCtx, w, h, halMask, recipe.halation);

      if (recipe.analog) {
        runAnalogPostPasses(tempCtx, w, h, recipe.analog);
      }

      const grainData = tempCtx.getImageData(0, 0, w, h);
      applyFilmGrain(grainData.data, w, h, recipe.grain, options.seed ?? 42);

      if (recipe.analog?.colorDrift) {
        applyColorDrift(grainData.data, w, h, recipe.analog.colorDrift, options.seed ?? 42);
      }

      tempCtx.putImageData(grainData, 0, 0);

      applyVignette(tempCtx, w, h, recipe.vignette);
    }
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.restore();

  return { stats, adapted };
}

/** Apply Inst C to any canvas — photobooth entry point */
export function applyInstCFilter(canvas: HTMLCanvasElement, seed?: number): ProcessResult | null {
  return applyFilmRecipe(canvas, INST_C_RECIPE, { seed });
}

export function processImageWithRecipe(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  recipe: FilmRecipe,
  targetWidth?: number,
  targetHeight?: number,
  seed?: number,
): { canvas: HTMLCanvasElement; result: ProcessResult | null } {
  const canvas = document.createElement('canvas');
  const sw = 'videoWidth' in source ? source.videoWidth : source.width;
  const sh = 'videoHeight' in source ? source.videoHeight : source.height;
  canvas.width = targetWidth ?? sw;
  canvas.height = targetHeight ?? sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { canvas, result: null };
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const result = applyFilmRecipe(canvas, recipe, { seed });
  return { canvas, result };
}

export function exportRecipeJson(recipe: FilmRecipe): string {
  return JSON.stringify(recipe, null, 2);
}

export function parseRecipeJson(json: string): FilmRecipe {
  const parsed = JSON.parse(json) as Partial<FilmRecipe>;
  return {
    ...INST_C_RECIPE,
    ...parsed,
    hueShifts: { ...INST_C_RECIPE.hueShifts, ...parsed.hueShifts },
    analog: parsed.analog
      ? { ...INST_C_RECIPE.analog!, ...parsed.analog }
      : INST_C_RECIPE.analog,
    polaroidDream: parsed.polaroidDream
      ? { ...INST_C_RECIPE.polaroidDream!, ...parsed.polaroidDream }
      : INST_C_RECIPE.polaroidDream,
    highlightRolloff: { ...INST_C_RECIPE.highlightRolloff, ...parsed.highlightRolloff },
    bloom: { ...INST_C_RECIPE.bloom, ...parsed.bloom },
    lensDiffusion: { ...INST_C_RECIPE.lensDiffusion, ...parsed.lensDiffusion },
    halation: { ...INST_C_RECIPE.halation, ...parsed.halation },
    grain: { ...INST_C_RECIPE.grain, ...parsed.grain },
    vignette: { ...INST_C_RECIPE.vignette, ...parsed.vignette },
    adaptation: { ...INST_C_RECIPE.adaptation, ...parsed.adaptation },
  };
}
