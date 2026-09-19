/** Synthetic portrait-like test card for color contamination checks. */

export function drawInstSQCTestPattern(canvas: HTMLCanvasElement): void {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#8a9aab';
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.42;
  const faceR = Math.min(w, h) * 0.22;

  const grad = ctx.createRadialGradient(cx, cy - faceR * 0.2, faceR * 0.1, cx, cy, faceR * 1.4);
  grad.addColorStop(0, '#f5d0b8');
  grad.addColorStop(0.55, '#c8886a');
  grad.addColorStop(1, '#3a2820');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, faceR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1a1410';
  ctx.fillRect(0, h * 0.78, w, h * 0.22);

  const swatches = [
    ['#e84040', 0.08],
    ['#40c060', 0.22],
    ['#4080e8', 0.36],
    ['#e8c040', 0.50],
    ['#c060e8', 0.64],
  ] as const;
  const sh = h * 0.08;
  for (const [color, xFrac] of swatches) {
    ctx.fillStyle = color;
    ctx.fillRect(w * xFrac, h * 0.88, w * 0.1, sh);
  }

  const hi = ctx.createLinearGradient(0, 0, w, 0);
  hi.addColorStop(0, '#ffffff');
  hi.addColorStop(0.5, '#f0f0f0');
  hi.addColorStop(1, '#cccccc');
  ctx.fillStyle = hi;
  ctx.fillRect(w * 0.72, h * 0.06, w * 0.22, h * 0.12);
}
