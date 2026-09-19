/** Clumped instant-film grain — visible organic clusters, not pixel noise. */

const GRAIN_PERM = new Uint8Array(512);
for (let i = 0; i < 256; i++) GRAIN_PERM[i] = i;
for (let i = 255; i > 0; i--) {
  const j = (i * 31 + 17) % (i + 1);
  const tmp = GRAIN_PERM[i];
  GRAIN_PERM[i] = GRAIN_PERM[j];
  GRAIN_PERM[j] = tmp;
}
for (let i = 0; i < 256; i++) GRAIN_PERM[i + 256] = GRAIN_PERM[i];

function grad(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/** 2D value noise in -1..1 */
export function organicNoise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const s = seed & 255;
  const aa = GRAIN_PERM[GRAIN_PERM[xi] + yi + s];
  const ab = GRAIN_PERM[GRAIN_PERM[xi] + yi + 1 + s];
  const ba = GRAIN_PERM[GRAIN_PERM[xi + 1] + yi + s];
  const bb = GRAIN_PERM[GRAIN_PERM[xi + 1] + yi + 1 + s];
  const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
  const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
  return lerp(x1, x2, v);
}

/**
 * Large clumped grain — each cell shares a value for visible instant-film texture.
 */
export function filmGrainClumpAt(x: number, y: number, size: number, seed = 0): number {
  const cell = Math.max(3, Math.round(size * 2.2));
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const n00 = organicNoise(gx, gy, seed);
  const n10 = organicNoise(gx + 1, gy, seed + 1);
  const n01 = organicNoise(gx, gy + 1, seed + 2);
  const n11 = organicNoise(gx + 1, gy + 1, seed + 3);
  const nx0 = lerp(n00, n10, fx);
  const nx1 = lerp(n01, n11, fx);
  let n = lerp(nx0, nx1, fy);
  n += organicNoise(gx * 0.5, gy * 0.5, seed + 7) * 0.35;
  return n / 1.35;
}

/** @deprecated use filmGrainClumpAt */
export function filmGrainAt(x: number, y: number, size: number, seed = 0): number {
  return filmGrainClumpAt(x, y, size, seed);
}

export function midtoneWeight(lum: number): number {
  const n = lum / 255;
  return 1 - Math.abs(n - 0.38) * 1.9;
}

/** Visible across tonal range — Instax grain shows in sky and shadows */
export function shadowMidtoneWeight(lum: number, midtoneBoost: number): number {
  const n = lum / 255;
  const shadowPeak = n < 0.42 ? 1.28 : 1.05;
  const midPeak = 1 - Math.abs(n - 0.32) * 1.1;
  let highlightCut = 1.0;
  if (n > 0.88) highlightCut = 0.78;
  else if (n > 0.72) highlightCut = 0.88;
  else if (n > 0.55) highlightCut = 0.94;
  return Math.max(0.35, midPeak * shadowPeak * highlightCut * midtoneBoost);
}
