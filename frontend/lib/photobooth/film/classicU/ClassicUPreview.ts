import { CLASSIC_U_RECIPE } from '../recipes/classic-u';
import { getClassicUWebGLRenderer } from './webglRenderer';
import {
  createPreviewCanvasContext,
  isIOS,
  isVideoFrameReady,
  primeVideoForCanvasCapture,
} from '../platform';

const PREVIEW_MAX_DIM = 480;

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
  if (!getClassicUWebGLRenderer()) return null;
  if (engine) return engine;

  engine = {
    source: null,
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

function blitToSubscribers(eng: EngineState, glCanvas: HTMLCanvasElement): void {
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
    drawCtx.drawImage(glCanvas, 0, 0);
    drawCtx.restore();
  }
}

function paintFrame(eng: EngineState): void {
  if (eng.painting || !eng.source) return;

  if (eng.source instanceof HTMLVideoElement) {
    if (!isVideoFrameReady(eng.source)) return;
    primeVideoForCanvasCapture(eng.source);
  }

  const renderer = getClassicUWebGLRenderer();
  if (!renderer) return;

  const { width: sw, height: sh } = getSourceSize(eng.source);
  if (sw <= 0 || sh <= 0) return;

  let w = sw;
  let h = sh;
  if (Math.max(w, h) > PREVIEW_MAX_DIM) {
    const scale = PREVIEW_MAX_DIM / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  eng.painting = true;
  try {
    if (renderer.render(eng.source, w, h, CLASSIC_U_RECIPE, performance.now() * 0.001, false)) {
      eng.resultW = w;
      eng.resultH = h;
      blitToSubscribers(eng, renderer.canvas);
    }
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

export function subscribeClassicUPreview(
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

export const CLASSIC_U_FILTER_ID = 'autumn';

export function isClassicUFilter(filterId: string): boolean {
  return filterId === CLASSIC_U_FILTER_ID;
}
