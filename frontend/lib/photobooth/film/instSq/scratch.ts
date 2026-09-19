import { createInstSQMotionScratch, type InstSQMotionScratch } from './motionBlur';

export type InstSQScratch = {
  emulsion: HTMLCanvasElement;
  emulsionCtx: CanvasRenderingContext2D;
  soft: HTMLCanvasElement;
  softCtx: CanvasRenderingContext2D;
  edge: HTMLCanvasElement;
  edgeCtx: CanvasRenderingContext2D;
  bloom: HTMLCanvasElement;
  bloomCtx: CanvasRenderingContext2D;
  bloomBlur: HTMLCanvasElement;
  bloomBlurCtx: CanvasRenderingContext2D;
  motion: InstSQMotionScratch | null;
  w: number;
  h: number;
};

export function createInstSQScratch(): InstSQScratch | null {
  const emulsion = document.createElement('canvas');
  const soft = document.createElement('canvas');
  const edge = document.createElement('canvas');
  const bloom = document.createElement('canvas');
  const bloomBlur = document.createElement('canvas');
  const emulsionCtx = emulsion.getContext('2d');
  const softCtx = soft.getContext('2d');
  const edgeCtx = edge.getContext('2d');
  const bloomCtx = bloom.getContext('2d');
  const bloomBlurCtx = bloomBlur.getContext('2d');
  if (!emulsionCtx || !softCtx || !edgeCtx || !bloomCtx || !bloomBlurCtx) return null;

  return {
    emulsion,
    emulsionCtx,
    soft,
    softCtx,
    edge,
    edgeCtx,
    bloom,
    bloomCtx,
    bloomBlur,
    bloomBlurCtx,
    motion: createInstSQMotionScratch(),
    w: 0,
    h: 0,
  };
}

export function ensureInstSQScratchSize(scratch: InstSQScratch, w: number, h: number): void {
  if (scratch.w === w && scratch.h === h) return;
  scratch.w = w;
  scratch.h = h;
  for (const c of [scratch.emulsion, scratch.soft, scratch.edge, scratch.bloom, scratch.bloomBlur]) {
    c.width = w;
    c.height = h;
  }
  if (scratch.motion) {
    scratch.motion.sharp.width = w;
    scratch.motion.sharp.height = h;
    scratch.motion.motion.width = w;
    scratch.motion.motion.height = h;
    scratch.motion.mask.width = w;
    scratch.motion.mask.height = h;
  }
}
