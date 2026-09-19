/** Inst SQ emulsion — organic cloud density, no tiled overlays or grid seams. */

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

/** Low-frequency cloud FBM with sheared coords — avoids diagonal grid seams */
function cloudFbm(x: number, y: number, seed: number): number {
  const sx = x * 0.831 + y * 0.417 + seed * 0.011;
  const sy = y * 0.809 - x * 0.263 + seed * 0.017;
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    sum += valueNoise(sx * freq, sy * freq, seed + o * 167) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

/**
 * Pixel-level emulsion density only — no canvas overlay (prevents moire / seam lines).
 */
export function applyInstSQEmulsion(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opacity: number,
  seed: number,
  _scratch: HTMLCanvasElement,
  _scratchCtx: CanvasRenderingContext2D,
): void {
  if (opacity <= 0) return;

  const pixels = ctx.getImageData(0, 0, w, h);
  const data = pixels.data;
  const strength = opacity * 0.38;
  const ox = (seed % 503) * 0.19 + 41.2;
  const oy = (seed % 389) * 0.23 + 57.8;

  for (let y = 0; y < h; y++) {
    const ny = (y / h) * 6.8 + oy;
    for (let x = 0; x < w; x++) {
      const nx = (x / w) * 6.8 + ox;
      const density = cloudFbm(nx, ny, seed + 401);
      const delta = (density - 0.5) * strength * 68;
      const i = (y * w + x) * 4;
      data[i] = Math.max(0, Math.min(255, data[i] + delta));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + delta * 0.97));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + delta * 1.05));
    }
  }

  ctx.putImageData(pixels, 0, 0);
}
