import type { AdaptationSettings, AdaptedParams, FilmRecipe, ImageStats } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function pixelSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  return max > 0 ? (max - min) / max : 0;
}

/** Sample image pixels and build luminance histogram + statistics. */
export function analyzeImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  stride = 16,
): ImageStats {
  const histogram = new Uint32Array(256);
  let totalBrightness = 0;
  let totalSaturation = 0;
  let totalWarmth = 0;
  let sumSq = 0;
  let sampleCount = 0;
  const lumSamples: number[] = [];

  const step = 4 * stride;
  for (let i = 0; i < data.length; i += step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const y = luminance(r, g, b);
    const bin = clamp(Math.floor(y), 0, 255);
    histogram[bin]++;
    lumSamples.push(y);
    totalBrightness += y;
    totalSaturation += pixelSaturation(r, g, b);
    totalWarmth += r - b;
    sumSq += y * y;
    sampleCount++;
  }

  const brightness = totalBrightness / sampleCount;
  const variance = sumSq / sampleCount - brightness * brightness;
  const contrast = Math.sqrt(Math.max(0, variance));

  lumSamples.sort((a, b) => a - b);
  const p5 = lumSamples[Math.floor(lumSamples.length * 0.05)] ?? 0;
  const p50 = lumSamples[Math.floor(lumSamples.length * 0.5)] ?? 0;
  const p95 = lumSamples[Math.floor(lumSamples.length * 0.95)] ?? 255;
  const dynamicRange = p95 - p5;

  return {
    brightness,
    contrast,
    saturation: totalSaturation / sampleCount,
    dynamicRange,
    warmth: totalWarmth / sampleCount,
    p5,
    p50,
    p95,
    histogram,
    sampleCount,
  };
}

export function analyzeCanvas(canvas: HTMLCanvasElement, stride = 16): ImageStats | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = canvas;
  if (width === 0 || height === 0) return null;
  const imageData = ctx.getImageData(0, 0, width, height);
  return analyzeImageData(imageData.data, width, height, stride);
}

/** Derive per-image exposure/contrast/saturation from analysis + recipe adaptation rules. */
export function adaptRecipeToImage(recipe: FilmRecipe, stats: ImageStats): AdaptedParams {
  const a = recipe.adaptation;
  let exposure = recipe.exposure;
  let contrast = recipe.contrast;
  let saturation = recipe.saturation;
  let highlights = recipe.highlights;

  if (stats.brightness < a.darkThreshold) {
    const t = (a.darkThreshold - stats.brightness) / a.darkThreshold;
    exposure += t * a.maxDarkExposureLift;
  } else if (stats.brightness > a.brightThreshold) {
    const t = (stats.brightness - a.brightThreshold) / (255 - a.brightThreshold);
    exposure -= t * a.maxBrightExposureCut;
    highlights += -t * 8;
  }

  const targetEv = Math.log2(a.targetBrightness / Math.max(stats.brightness, 1));
  exposure += clamp(targetEv * 0.15, -0.08, 0.12);

  if (stats.contrast < a.flatContrastThreshold) {
    const t = (a.flatContrastThreshold - stats.contrast) / a.flatContrastThreshold;
    contrast += t * a.flatContrastBoost;
  }

  if (stats.saturation > a.saturatedThreshold) {
    const t = (stats.saturation - a.saturatedThreshold) / (1 - a.saturatedThreshold);
    saturation -= t * a.saturatedReduction;
  }

  if (stats.p95 > 220) {
    highlights += -6;
  }

  return {
    exposure: clamp(exposure, -0.5, 0.55),
    contrast: clamp(contrast, 0.82, 1.08),
    saturation: clamp(saturation, 0.72, 0.95),
    highlights: clamp(highlights, -35, 5),
    stats,
  };
}

export function normalizeHistogram(histogram: Uint32Array): Float32Array {
  const out = new Float32Array(256);
  let max = 0;
  for (let i = 0; i < 256; i++) {
    if (histogram[i] > max) max = histogram[i];
  }
  if (max === 0) return out;
  for (let i = 0; i < 256; i++) {
    out[i] = histogram[i] / max;
  }
  return out;
}
