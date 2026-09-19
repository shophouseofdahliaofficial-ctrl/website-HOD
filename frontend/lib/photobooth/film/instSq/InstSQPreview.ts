import { INST_SQ_RECIPE } from '../recipes/inst-sq';
import { applyInstSQPreview, createInstSQScratch, type InstSQScratch } from './InstSQProcessor';
import {
  createPreviewCanvasContext,
  isIOS,
  isVideoFrameReady,
  primeVideoForCanvasCapture,
} from '../platform';

const PREVIEW_MAX_DIM = 400;

type CanvasImageSourceLike = CanvasImageSource;

function getSourceSize(source: CanvasImageSourceLike): { width: number; height: number } {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height };
  }
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth || source.width, height: source.videoHeight || source.height };
  }
  if (source instanceof HTMLCanvasElement) {
    return { width: source.width, height: source.height };
  }
  return { width: 0, height: 0 };
}

type Subscriber = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null; mirror: boolean };

type EngineState = {
  source: CanvasImageSourceLike | null;
  scratch: InstSQScratch | null;
  workCanvas: HTMLCanvasElement;
  workCtx: CanvasRenderingContext2D;
  resultW: number;
  resultH: number;
  subscribers: Set<Subscriber>;
  rafId: number;
  vfcHandle: number;
  painting: boolean;
  cancelled: boolean;
};

let engine: EngineState | null = null;

function getEngine(): EngineState | null {
  if (typeof document === 'undefined') return null;
  if (engine) return engine;

  const workCanvas = document.createElement('canvas');
  const workCtx = createPreviewCanvasContext(workCanvas, true);
  const scratch = createInstSQScratch();
  if (!workCtx || !scratch) return null;

  engine = {
    source: null,
    scratch,
    workCanvas,
    workCtx,
    resultW: 0,
    resultH: 0,
    subscribers: new Set(),
    rafId: 0,
    vfcHandle: 0,
    painting: false,
    cancelled: false,
  };
  return engine;
}

function blitToSubscribers(eng: EngineState): void {
  for (const sub of eng.subscribers) {
    if (sub.canvas.width !== eng.resultW || sub.canvas.height !== eng.resultH) {
      sub.canvas.width = eng.resultW;
      sub.canvas.height = eng.resultH;
      sub.ctx = createPreviewCanvasContext(sub.canvas, false);
    }
    const drawCtx = sub.ctx;
    if (!drawCtx) continue;
    drawCtx.save();
    if (sub.mirror) {
      drawCtx.translate(eng.resultW, 0);
      drawCtx.scale(-1, 1);
    }
    drawCtx.drawImage(eng.workCanvas, 0, 0);
    drawCtx.restore();
  }
}

function paintFrame(eng: EngineState): void {
  if (eng.painting || !eng.source || !eng.scratch) return;

  if (eng.source instanceof HTMLVideoElement) {
    if (!isVideoFrameReady(eng.source)) return;
    primeVideoForCanvasCapture(eng.source);
  }

  const { width: sw, height: sh } = getSourceSize(eng.source);
  if (sw <= 0 || sh <= 0) return;

  let w = sw;
  let h = sh;
  if (Math.max(w, h) > PREVIEW_MAX_DIM) {
    const scale = PREVIEW_MAX_DIM / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  if (eng.workCanvas.width !== w || eng.workCanvas.height !== h) {
    eng.workCanvas.width = w;
    eng.workCanvas.height = h;
  }

  eng.painting = true;
  try {
    const ctx = eng.workCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.drawImage(eng.source, 0, 0, w, h);
    applyInstSQPreview(ctx, w, h, INST_SQ_RECIPE, eng.scratch, 42);
    eng.resultW = w;
    eng.resultH = h;
    blitToSubscribers(eng);
  } catch {
    /* keep last frame */
  } finally {
    eng.painting = false;
  }
}

function stopLoop(eng: EngineState): void {
  eng.cancelled = true;
  cancelAnimationFrame(eng.rafId);
  eng.rafId = 0;
  if (eng.source instanceof HTMLVideoElement && eng.vfcHandle && 'cancelVideoFrameCallback' in eng.source) {
    eng.source.cancelVideoFrameCallback(eng.vfcHandle);
  }
  eng.vfcHandle = 0;
}

function startLoop(eng: EngineState): void {
  if (!eng.cancelled && (eng.rafId || eng.vfcHandle)) return;
  eng.cancelled = false;

  const tickRaf = () => {
    if (eng.cancelled || eng.subscribers.size === 0) {
      eng.rafId = 0;
      return;
    }
    paintFrame(eng);
    eng.rafId = requestAnimationFrame(tickRaf);
  };

  const source = eng.source;
  const useVfc = !isIOS() && source instanceof HTMLVideoElement && 'requestVideoFrameCallback' in source;
  if (useVfc) {
    const onVideoFrame = () => {
      if (eng.cancelled || eng.subscribers.size === 0) {
        eng.vfcHandle = 0;
        return;
      }
      paintFrame(eng);
      eng.vfcHandle = source.requestVideoFrameCallback(onVideoFrame);
    };
    eng.vfcHandle = source.requestVideoFrameCallback(onVideoFrame);
  } else {
    eng.rafId = requestAnimationFrame(tickRaf);
  }
}

export function subscribeInstSQPreview(
  canvas: HTMLCanvasElement,
  source: CanvasImageSourceLike,
  mirror = false,
): () => void {
  const eng = getEngine();
  if (!eng) return () => {};

  eng.source = source;
  const sub: Subscriber = { canvas, ctx: null, mirror };
  eng.subscribers.add(sub);
  stopLoop(eng);
  eng.cancelled = false;
  startLoop(eng);
  paintFrame(eng);

  return () => {
    eng.subscribers.delete(sub);
    if (eng.subscribers.size === 0) {
      stopLoop(eng);
      eng.source = null;
    }
  };
}

export const INST_SQ_FILTER_ID = 'inst-sq';

export function isInstSQFilter(filterId: string): boolean {
  return filterId === INST_SQ_FILTER_ID;
}
