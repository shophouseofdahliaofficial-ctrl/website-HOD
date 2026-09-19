/** Inst SQ film grain — organic, non-tiled, no clump grid or honeycomb mesh. */

function hash2(ix: number, iy: number, seed: number): number {
  let h = (seed + ix * 374761393 + iy * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967295;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smoothstep(xf);
  const v = smoothstep(yf);
  const n00 = hash2(xi, yi, seed);
  const n10 = hash2(xi + 1, yi, seed);
  const n01 = hash2(xi, yi + 1, seed);
  const n11 = hash2(xi + 1, yi + 1, seed);
  const nx0 = n00 + (n10 - n00) * u;
  const nx1 = n01 + (n11 - n01) * u;
  return nx0 + (nx1 - nx0) * v;
}

/** Sheared sample coords break axis-aligned grid seams */
function shearedNoise(x: number, y: number, seed: number): number {
  const nx = x * 0.847 + y * 0.391 + seed * 0.013;
  const ny = y * 0.823 - x * 0.277 + seed * 0.019;
  const a = valueNoise(nx * 1.7, ny * 1.7, seed + 3);
  const b = valueNoise(nx * 3.1 + 12.4, ny * 3.1 + 8.7, seed + 29) * 0.35;
  return (a + b) / 1.35;
}

/** Returns grain offset roughly in -1..1 scaled by caller */
export function instSqGrainAt(x: number, y: number, size: number, seed: number): number {
  const scale = 1 / Math.max(2.5, size);
  return (shearedNoise(x * scale, y * scale, seed) - 0.5) * 2;
}
