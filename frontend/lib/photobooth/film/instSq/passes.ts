import type { InstSQRecipe } from './types';
import type { ImageStats } from '../types';
import { instSqGrainAt } from './grain';

const clamp255 = (v: number) => Math.max(0, Math.min(255, v));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function lum(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

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
  const tc = (n: number) => {
    let t = n;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [tc(hk + 1 / 3) * 255, tc(hk) * 255, tc(hk - 1 / 3) * 255];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** Cold square-film color remap — teal greens, dusty cyan, dusty rose, blue-gray blacks. */
export function applyInstSQColorMapping(
  data: Uint8ClampedArray,
  recipe: InstSQRecipe,
  exposure: number,
): void {
  const { grade, colorMapping, tonal } = recipe;
  const temp = grade.temperature / 100;
  const tint = grade.tint / 100;
  const contrast = grade.contrast;
  const sat = grade.saturation;
  const fade = grade.fade;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    r += temp * 18 - tint * 4;
    g += temp * 6 + tint * 2;
    b += -temp * 22 + tint * 8;

    const y = lum(r, g, b) / 255;
    const [h, s, l] = rgbToHsl(r, g, b);

    let nr = r, ng = g, nb = b;

    if (h >= 55 && h <= 165 && s > 0.06) {
      const t = smoothstep(55, 120, h) * (1 - smoothstep(130, 165, h));
      const shift = colorMapping.greenTealShift * t * s;
      ng = ng * (1 - shift * 0.22);
      nb = nb + shift * 38;
      nr = nr - shift * 18;
    }

    if (h >= 180 && h <= 260 && s > 0.05) {
      const t = smoothstep(180, 220, h) * (1 - smoothstep(240, 260, h));
      const shift = colorMapping.blueCyanShift * t;
      ng = ng + shift * 20;
      nb = nb + shift * 14;
      nr = nr - shift * 16;
      const gray = lum(nr, ng, nb);
      nr = gray + (nr - gray) * (1 - shift * 0.28);
      ng = gray + (ng - gray) * (1 - shift * 0.18);
      nb = gray + (nb - gray) * (1 - shift * 0.1);
    }

    if ((h >= 300 || h <= 35) && s > 0.1) {
      const t = h >= 300 ? smoothstep(300, 340, h) : smoothstep(35, 0, h);
      const shift = colorMapping.pinkRoseShift * t * s;
      nr = nr * (1 - shift * 0.08) + shift * 8;
      ng = ng * (1 - shift * 0.12);
      nb = nb + shift * 14;
      const gray = lum(nr, ng, nb);
      nr = gray + (nr - gray) * (1 - shift * 0.35);
      ng = gray + (ng - gray) * (1 - shift * 0.35);
      nb = gray + (nb - gray) * (1 - shift * 0.25);
    }

    if (y > 0.72) {
      const t = smoothstep(0.72, 0.98, y);
      const cream = colorMapping.whiteCreamLift;
      nr = nr + (235 - nr) * t * (1 - cream) * 0.35;
      ng = ng + (232 - ng) * t * (1 - cream) * 0.38;
      nb = nb + (228 - nb) * t * (1 - cream) * 0.42;
    }

    if (y < 0.45) {
      const t = smoothstep(0.45, 0, y);
      const lift = tonal.shadowLift * t;
      const blue = tonal.shadowBlueAmount * colorMapping.blackBlueGray * t;
      nr = nr * (1 - lift * 0.38) + lift * 14;
      ng = ng * (1 - lift * 0.32) + lift * 18;
      nb = nb * (1 - lift * 0.12) + lift * 38 + blue * 28;
    }

    r = nr; g = ng; b = nb;

    const gray = lum(r, g, b);
    r = gray + (r - gray) * sat;
    g = gray + (g - gray) * sat;
    b = gray + (b - gray) * sat;

    r = ((r / 255 - 0.5) * contrast + 0.5) * 255;
    g = ((g / 255 - 0.5) * contrast + 0.5) * 255;
    b = ((b / 255 - 0.5) * contrast + 0.5) * 255;

    r = r + fade * 28 + exposure * 32;
    g = g + fade * 30 + exposure * 32;
    b = b + fade * 34 + exposure * 32;

    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
  }
}

/** Printed-film tonal compression — soft mids, compressed highlights, lifted blue shadows. */
export function applyInstSQFilmCompression(data: Uint8ClampedArray, recipe: InstSQRecipe): void {
  const { tonal } = recipe;
  const hc = tonal.highlightCompression;
  const dr = tonal.dynamicRangeCompression;
  const ms = tonal.midtoneSoftness;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const y = lum(r, g, b) / 255;

    const toe = smoothstep(0, 0.35, y);
    const lift = tonal.shadowLift * (1 - toe);
    r += lift * 22;
    g += lift * 24;
    b += lift * 30;

    if (y > 0.52) {
      const t = smoothstep(0.52, 1, y);
      const compress = 1 - hc * t * t * dr;
      r = 192 + (r - 192) * compress;
      g = 190 + (g - 190) * compress;
      b = 188 + (b - 188) * compress;
    }

    if (y > 0.22 && y < 0.78) {
      const mid = 1 - Math.abs(y - 0.5) * 2;
      const soft = ms * mid * 0.11;
      r = r * (1 - soft) + 128 * soft;
      g = g * (1 - soft) + 130 * soft;
      b = b * (1 - soft) + 138 * soft;
    }

    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
  }
}

/** Cyan atmospheric wash — distance haze, not bloom. Stronger toward upper frame. */
export function applyInstSQAtmosphere(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  recipe: InstSQRecipe,
): void {
  const { atmosphere } = recipe;
  if (atmosphere.cyanStrength <= 0 && atmosphere.shadowBlueBoost <= 0) return;

  for (let y = 0; y < h; y++) {
    const yNorm = y / h;
    const skyWeight = smoothstep(0.05, 0.55, 1 - yNorm);
    const depthWeight = smoothstep(0.1, 0.75, yNorm) * 0.35 + skyWeight * 0.65;

    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      const yLum = lum(r, g, b) / 255;

      const cyan = atmosphere.cyanStrength * depthWeight;
      g += cyan * 22;
      b += cyan * 32;
      r -= cyan * 14;

      if (yLum < 0.48) {
        const t = smoothstep(0.48, 0, yLum);
        const blue = atmosphere.shadowBlueBoost * t * (0.55 + depthWeight * 0.45);
        r = r * (1 - blue * 0.12) + blue * 6;
        g = g * (1 - blue * 0.06) + blue * 10;
        b = b + blue * 24;
      }

      data[i] = clamp255(r);
      data[i + 1] = clamp255(g);
      data[i + 2] = clamp255(b);
    }
  }
}

export function applyInstSQGrain(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  recipe: InstSQRecipe,
  seed: number,
  quality: 'full' | 'fast',
): void {
  const amt = recipe.textures.grainAmount;
  const size = recipe.textures.grainSize;
  const step = quality === 'fast' ? 2 : 1;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const l = lum(data[i], data[i + 1], data[i + 2]);
      const weight = 0.72 + (1 - Math.abs(l / 255 - 0.45)) * 0.65;
      const n = instSqGrainAt(x, y, size, seed) * amt * weight;
      const rv = clamp255(data[i] + n);
      const gv = clamp255(data[i + 1] + n * 0.94);
      const bv = clamp255(data[i + 2] + n * 1.08);
      data[i] = rv;
      data[i + 1] = gv;
      data[i + 2] = bv;
      if (step > 1) {
        for (let dy = 0; dy < step && y + dy < h; dy++) {
          for (let dx = 0; dx < step && x + dx < w; dx++) {
            if (dx === 0 && dy === 0) continue;
            const j = ((y + dy) * w + (x + dx)) * 4;
            data[j] = rv;
            data[j + 1] = gv;
            data[j + 2] = bv;
          }
        }
      }
    }
  }
}

export function applyInstSQDust(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  opacity: number,
  seed: number,
): void {
  if (opacity <= 0) return;
  const rand = seededRand(seed + 91);
  const fineCount = Math.floor(w * h * opacity * 0.0028);
  for (let n = 0; n < fineCount; n++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h);
    const i = (y * w + x) * 4;
    const bright = rand() > 0.48;
    const delta = bright ? 45 + rand() * 70 : -(35 + rand() * 55);
    data[i] = clamp255(data[i] + delta);
    data[i + 1] = clamp255(data[i + 1] + delta);
    data[i + 2] = clamp255(data[i + 2] + delta);
  }

  const specCount = Math.max(2, Math.floor(opacity * w * h * 0.000018));
  for (let n = 0; n < specCount; n++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h);
    const radius = 1 + Math.floor(rand() * 2);
    const bright = rand() > 0.42;
    const delta = bright ? 28 + rand() * 42 : -(22 + rand() * 32);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        if (dx * dx + dy * dy > radius * radius) continue;
        const i = (py * w + px) * 4;
        const fall = 1 - (dx * dx + dy * dy) / (radius * radius + 1);
        data[i] = clamp255(data[i] + delta * fall);
        data[i + 1] = clamp255(data[i + 1] + delta * fall);
        data[i + 2] = clamp255(data[i + 2] + delta * fall);
      }
    }
  }
}

export function applyInstSQScratches(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  count: number,
  opacity: number,
  seed: number,
): void {
  if (opacity <= 0 || count <= 0) return;
  const rand = seededRand(seed + 137);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = 'rgba(220, 225, 232, 0.55)';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < count; i++) {
    const x1 = rand() * w;
    const y1 = rand() * h;
    const len = 20 + rand() * 80;
    const ang = rand() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
    ctx.stroke();
    if (rand() > 0.55) {
      ctx.strokeStyle = 'rgba(40, 45, 55, 0.35)';
      ctx.beginPath();
      ctx.moveTo(x1 + 2, y1 + 1);
      ctx.lineTo(x1 + Math.cos(ang) * len * 0.9, y1 + Math.sin(ang) * len * 0.9);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(220, 225, 232, 0.55)';
    }
  }
  ctx.restore();
}

export function applyInstSQVeil(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  veil: InstSQRecipe['veil'],
): void {
  if (veil.opacity <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(${veil.r},${veil.g},${veil.b},${veil.opacity})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function applyInstSQVignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  vignette: InstSQRecipe['vignette'],
): void {
  if (vignette.strength <= 0) return;
  const cx = w / 2;
  const cy = h / 2;
  const inner = Math.min(w, h) * vignette.inner;
  const outer = Math.min(w, h) * vignette.outer;
  const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(12,18,28,${vignette.strength})`);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function applyInstSQHighlightBloom(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bloom: InstSQRecipe['bloom'],
  scratch: HTMLCanvasElement,
  scratchCtx: CanvasRenderingContext2D,
  blurCanvas: HTMLCanvasElement,
  blurCtx: CanvasRenderingContext2D,
): void {
  if (bloom.intensity <= 0) return;
  const src = ctx.getImageData(0, 0, w, h);
  const threshold = bloom.threshold * 255;
  const hd = scratchCtx.createImageData(w, h);
  const out = hd.data;
  for (let i = 0; i < src.data.length; i += 4) {
    const l = lum(src.data[i], src.data[i + 1], src.data[i + 2]);
    const t = smoothstep(threshold - 40, threshold + 20, l);
    const m = t * t;
    out[i] = src.data[i] * m * 0.92;
    out[i + 1] = src.data[i + 1] * m * 0.96;
    out[i + 2] = src.data[i + 2] * m * 1.02;
    out[i + 3] = 255;
  }
  scratchCtx.putImageData(hd, 0, 0);
  blurCtx.filter = `blur(${bloom.radius}px)`;
  blurCtx.drawImage(scratch, 0, 0);
  blurCtx.filter = 'none';
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = bloom.intensity;
  ctx.drawImage(blurCanvas, 0, 0);
  ctx.restore();
}

export function applyInstSQHalation(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  halation: InstSQRecipe['halation'],
  scratch: HTMLCanvasElement,
  scratchCtx: CanvasRenderingContext2D,
  blurCanvas: HTMLCanvasElement,
  blurCtx: CanvasRenderingContext2D,
): void {
  if (halation.intensity <= 0) return;
  const src = ctx.getImageData(0, 0, w, h);
  const threshold = halation.threshold * 255;
  const hd = scratchCtx.createImageData(w, h);
  const out = hd.data;
  for (let i = 0; i < src.data.length; i += 4) {
    const l = lum(src.data[i], src.data[i + 1], src.data[i + 2]);
    const t = smoothstep(threshold - 24, threshold + 8, l);
    out[i] = src.data[i] * t * 0.4;
    out[i + 1] = src.data[i + 1] * t * 0.55;
    out[i + 2] = src.data[i + 2] * t * 0.85;
    out[i + 3] = 255;
  }
  scratchCtx.putImageData(hd, 0, 0);
  blurCtx.filter = `blur(${halation.radius}px)`;
  blurCtx.drawImage(scratch, 0, 0);
  blurCtx.filter = 'none';
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = halation.intensity;
  ctx.drawImage(blurCanvas, 0, 0);
  ctx.restore();
}

/** Plastic lens — micro-contrast reduction + optical softness, not dreamy gaussian. */
export function applyInstSQPlasticLens(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lens: InstSQRecipe['plasticLens'],
  softCanvas: HTMLCanvasElement,
  softCtx: CanvasRenderingContext2D,
  edgeCanvas: HTMLCanvasElement,
  edgeCtx: CanvasRenderingContext2D,
): void {
  const micro = lens.microContrastReduction;
  const optical = lens.opticalSoftness;
  const edge = lens.edgeSoftness;
  if (micro <= 0 && optical <= 0 && edge <= 0) return;

  softCtx.setTransform(1, 0, 0, 1, 0, 0);
  softCtx.filter = 'none';
  softCtx.clearRect(0, 0, w, h);
  softCtx.drawImage(ctx.canvas, 0, 0);

  if (micro > 0) {
    softCtx.filter = 'blur(1px)';
    softCtx.drawImage(ctx.canvas, 0, 0);
    softCtx.filter = 'none';
    ctx.save();
    ctx.globalAlpha = micro * 0.52;
    ctx.drawImage(softCanvas, 0, 0);
    ctx.restore();
  }

  if (optical > 0) {
    softCtx.clearRect(0, 0, w, h);
    softCtx.filter = 'blur(1.6px)';
    softCtx.drawImage(ctx.canvas, 0, 0);
    softCtx.filter = 'none';
    ctx.save();
    ctx.globalAlpha = optical * 0.32;
    ctx.drawImage(softCanvas, 0, 0);
    ctx.restore();
  }

  if (edge > 0) {
    edgeCtx.setTransform(1, 0, 0, 1, 0, 0);
    edgeCtx.clearRect(0, 0, w, h);
    edgeCtx.filter = 'blur(2.2px)';
    edgeCtx.drawImage(ctx.canvas, 0, 0);
    edgeCtx.filter = 'none';
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.hypot(w, h) * 0.5;
    const grad = edgeCtx.createRadialGradient(cx, cy, maxR * 0.18, cx, cy, maxR);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.45, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(255,255,255,1)');
    edgeCtx.globalCompositeOperation = 'destination-in';
    edgeCtx.fillStyle = grad;
    edgeCtx.fillRect(0, 0, w, h);
    edgeCtx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalAlpha = edge * 0.34;
    ctx.drawImage(edgeCanvas, 0, 0);
    ctx.restore();
  }

  if (micro > 0.2) {
    const src = ctx.getImageData(0, 0, w, h);
    const d = src.data;
    for (let i = 0; i < d.length; i += 4) {
      const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
      const pull = micro * 0.14;
      d[i] = clamp255(d[i] + (avg - d[i]) * pull);
      d[i + 1] = clamp255(d[i + 1] + (avg - d[i + 1]) * pull);
      d[i + 2] = clamp255(d[i + 2] + (avg - d[i + 2]) * pull);
    }
    ctx.putImageData(src, 0, 0);
  }

  const globalBlur = lens.globalBlur ?? 0;
  if (globalBlur > 0) {
    softCtx.setTransform(1, 0, 0, 1, 0, 0);
    softCtx.clearRect(0, 0, w, h);
    softCtx.filter = `blur(${globalBlur}px)`;
    softCtx.drawImage(ctx.canvas, 0, 0);
    softCtx.filter = 'none';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(softCanvas, 0, 0);
  }
}

export function adaptInstSQRecipe(stats: ImageStats, recipe: InstSQRecipe) {
  const a = recipe.adaptation;
  let exposure = 0;
  if (stats.brightness < a.darkThreshold) {
    exposure = ((a.darkThreshold - stats.brightness) / a.darkThreshold) * a.maxDarkExposureLift;
  } else if (stats.brightness > a.brightThreshold) {
    exposure = -((stats.brightness - a.brightThreshold) / (255 - a.brightThreshold)) * a.maxBrightExposureCut;
  }
  return {
    exposure,
    contrast: recipe.grade.contrast,
    saturation: recipe.grade.saturation,
  };
}

export function applyInstSQCombinedFastPass(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  recipe: InstSQRecipe,
  exposure: number,
  seed: number,
): void {
  const { grade, colorMapping, tonal, atmosphere, plasticLens, textures } = recipe;
  const temp = grade.temperature / 100;
  const tint = grade.tint / 100;
  const contrast = grade.contrast;
  const sat = grade.saturation;
  const fade = grade.fade;

  const hc = tonal.highlightCompression;
  const dr = tonal.dynamicRangeCompression;
  const ms = tonal.midtoneSoftness;

  const cyanStr = atmosphere.cyanStrength;
  const blueBoost = atmosphere.shadowBlueBoost;

  const micro = plasticLens.microContrastReduction;
  const pull = micro > 0.2 ? micro * 0.14 : 0;

  const amt = textures.grainAmount;
  const size = textures.grainSize;

  for (let y = 0; y < h; y++) {
    const yNorm = y / h;
    const skyWeight = smoothstep(0.05, 0.55, 1 - yNorm);
    const depthWeight = smoothstep(0.1, 0.75, yNorm) * 0.35 + skyWeight * 0.65;

    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // 1. Color mapping temp/tint shifts
      r += temp * 18 - tint * 4;
      g += temp * 6 + tint * 2;
      b += -temp * 22 + tint * 8;

      const yColorMap = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Inlined rgbToHsl to avoid array allocations
      const rNorm = r / 255;
      const gNorm = g / 255;
      const bNorm = b / 255;
      const maxVal = Math.max(rNorm, gNorm, bNorm);
      const minVal = Math.min(rNorm, gNorm, bNorm);
      const lColor = (maxVal + minVal) / 2;
      let hColor = 0;
      let sColor = 0;

      if (maxVal !== minVal) {
        const dColor = maxVal - minVal;
        sColor = lColor > 0.5 ? dColor / (2 - maxVal - minVal) : dColor / (maxVal + minVal);
        if (maxVal === rNorm) {
          hColor = ((gNorm - bNorm) / dColor + (gNorm < bNorm ? 6 : 0)) / 6;
        } else if (maxVal === gNorm) {
          hColor = ((bNorm - rNorm) / dColor + 2) / 6;
        } else {
          hColor = ((rNorm - gNorm) / dColor + 4) / 6;
        }
      }
      hColor *= 360;

      let nr = r;
      let ng = g;
      let nb = b;

      if (hColor >= 55 && hColor <= 165 && sColor > 0.06) {
        const t = smoothstep(55, 120, hColor) * (1 - smoothstep(130, 165, hColor));
        const shift = colorMapping.greenTealShift * t * sColor;
        ng = ng * (1 - shift * 0.22);
        nb = nb + shift * 38;
        nr = nr - shift * 18;
      }

      if (hColor >= 180 && hColor <= 260 && sColor > 0.05) {
        const t = smoothstep(180, 220, hColor) * (1 - smoothstep(240, 260, hColor));
        const shift = colorMapping.blueCyanShift * t;
        ng = ng + shift * 20;
        nb = nb + shift * 14;
        nr = nr - shift * 16;
        const gray = 0.299 * nr + 0.587 * ng + 0.114 * nb;
        nr = gray + (nr - gray) * (1 - shift * 0.28);
        ng = gray + (ng - gray) * (1 - shift * 0.18);
        nb = gray + (nb - gray) * (1 - shift * 0.1);
      }

      if ((hColor >= 300 || hColor <= 35) && sColor > 0.1) {
        const t = hColor >= 300 ? smoothstep(300, 340, hColor) : smoothstep(35, 0, hColor);
        const shift = colorMapping.pinkRoseShift * t * sColor;
        nr = nr * (1 - shift * 0.08) + shift * 8;
        ng = ng * (1 - shift * 0.12);
        nb = nb + shift * 14;
        const gray = 0.299 * nr + 0.587 * ng + 0.114 * nb;
        nr = gray + (nr - gray) * (1 - shift * 0.35);
        ng = gray + (ng - gray) * (1 - shift * 0.35);
        nb = gray + (nb - gray) * (1 - shift * 0.25);
      }

      if (yColorMap > 0.72) {
        const t = smoothstep(0.72, 0.98, yColorMap);
        const cream = colorMapping.whiteCreamLift;
        nr = nr + (235 - nr) * t * (1 - cream) * 0.35;
        ng = ng + (232 - ng) * t * (1 - cream) * 0.38;
        nb = nb + (228 - nb) * t * (1 - cream) * 0.42;
      }

      if (yColorMap < 0.45) {
        const t = smoothstep(0.45, 0, yColorMap);
        const shadowLiftVal = tonal.shadowLift * t;
        const blue = tonal.shadowBlueAmount * colorMapping.blackBlueGray * t;
        nr = nr * (1 - shadowLiftVal * 0.38) + shadowLiftVal * 14;
        ng = ng * (1 - shadowLiftVal * 0.32) + shadowLiftVal * 18;
        nb = nb * (1 - shadowLiftVal * 0.12) + shadowLiftVal * 38 + blue * 28;
      }

      r = nr; g = ng; b = nb;

      const grayVal = 0.299 * r + 0.587 * g + 0.114 * b;
      r = grayVal + (r - grayVal) * sat;
      g = grayVal + (g - grayVal) * sat;
      b = grayVal + (b - grayVal) * sat;

      r = ((r / 255 - 0.5) * contrast + 0.5) * 255;
      g = ((g / 255 - 0.5) * contrast + 0.5) * 255;
      b = ((b / 255 - 0.5) * contrast + 0.5) * 255;

      r = r + fade * 28 + exposure * 32;
      g = g + fade * 30 + exposure * 32;
      b = b + fade * 34 + exposure * 32;

      // 2. Film compression
      const yComp = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const toe = smoothstep(0, 0.35, yComp);
      const lift = tonal.shadowLift * (1 - toe);
      r += lift * 22;
      g += lift * 24;
      b += lift * 30;

      if (yComp > 0.52) {
        const t = smoothstep(0.52, 1, yComp);
        const compress = 1 - hc * t * t * dr;
        r = 192 + (r - 192) * compress;
        g = 190 + (g - 190) * compress;
        b = 188 + (b - 188) * compress;
      }

      if (yComp > 0.22 && yComp < 0.78) {
        const mid = 1 - Math.abs(yComp - 0.5) * 2;
        const soft = ms * mid * 0.11;
        r = r * (1 - soft) + 128 * soft;
        g = g * (1 - soft) + 130 * soft;
        b = b * (1 - soft) + 138 * soft;
      }

      // 3. Atmosphere
      const yLum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const cyan = cyanStr * depthWeight;
      g += cyan * 22;
      b += cyan * 32;
      r -= cyan * 14;

      if (yLum < 0.48) {
        const t = smoothstep(0.48, 0, yLum);
        const blue = blueBoost * t * (0.55 + depthWeight * 0.45);
        r = r * (1 - blue * 0.12) + blue * 6;
        g = g * (1 - blue * 0.06) + blue * 10;
        b = b + blue * 24;
      }

      // 4. Plastic lens micro desaturation
      if (pull > 0) {
        const avg = (r + g + b) / 3;
        r = r + (avg - r) * pull;
        g = g + (avg - g) * pull;
        b = b + (avg - b) * pull;
      }

      // 5. Grain (Calculate every 2x2 block in fast mode to be extremely fast)
      if (amt > 0) {
        const gx = x - (x % 2);
        const gy = y - (y % 2);
        const lFast = 0.299 * r + 0.587 * g + 0.114 * b;
        const weight = 0.72 + (1 - Math.abs(lFast / 255 - 0.45)) * 0.65;
        const n = instSqGrainAt(gx, gy, size, seed) * amt * weight;
        r += n;
        g += n * 0.94;
        b += n * 1.08;
      }

      data[i] = clamp255(r);
      data[i + 1] = clamp255(g);
      data[i + 2] = clamp255(b);
    }
  }
}

