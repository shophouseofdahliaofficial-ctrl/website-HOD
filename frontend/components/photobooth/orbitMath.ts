/** Depth from orbit angle: -1 (back) … 1 (front) */
export function depthFromAngle(angle: number): number {
  return Math.sin(angle);
}

export function projectDepth(depth: number): { scale: number; opacity: number; zIndex: number } {
  const t = (depth + 1) / 2;
  const scale = 0.65 + t * (1.1 - 0.65);
  const opacity = 0.42 + t * 0.58;
  const zIndex = Math.round(10 + t * 90);
  return { scale, opacity, zIndex };
}

export function orbitPosition(
  angle: number,
  rxPercent: number,
  ryPercent: number
): { x: number; y: number; rotate: number } {
  const x = Math.cos(angle) * rxPercent;
  const y = Math.sin(angle) * ryPercent;
  const rotate = (angle * 180) / Math.PI + 90;
  return { x, y, rotate };
}

/** Ease-in-out for a smoother flow from initial static/slow entry to rotation loop */
export function introEase(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
}


export function springToward(
  current: number,
  target: number,
  velocity: number,
  dt: number,
  stiffness = 220,
  damping = 24
): { value: number; velocity: number } {
  const accel = -stiffness * (current - target) - damping * velocity;
  const v = velocity + accel * dt;
  const value = current + v * dt;
  return { value, velocity: v };
}
