export type {
  FilmRecipe,
  ImageStats,
  AdaptedParams,
  ProcessResult,
  BloomSettings,
  HalationSettings,
  GrainSettings,
  VignetteSettings,
  HueShiftSettings,
  AdaptationSettings,
  HighlightRolloffSettings,
  LensDiffusionSettings,
  AnalogSettings,
  PolaroidDreamSettings,
} from './types';

export { RECIPE_SCHEMA_VERSION } from './types';

export {
  analyzeImageData,
  analyzeCanvas,
  adaptRecipeToImage,
  normalizeHistogram,
  luminance,
  pixelSaturation,
} from './analyzeImage';

export {
  applyFilmRecipe,
  applyInstCFilter,
  processImageWithRecipe,
  exportRecipeJson,
  parseRecipeJson,
} from './applyRecipe';

import { applyInstCFilter as _applyInstCFilter } from './applyRecipe';
import { applyInstSQFilter as _applyInstSQFilter } from './instSq/InstSQProcessor';
import { applyClassicUFilter as _applyClassicUFilter } from './classicU/ClassicUProcessor';
import { applyInstSQCFilter as _applyInstSQCFilter } from './instSqc/InstSQCProcessor';
import { renderClassicUToCanvas } from './classicU/webglRenderer';
import { renderInstSQCToCanvas } from './instSqc/webglRenderer';

export { INST_C_RECIPE, INST_C_RECIPE_ID } from './recipes/inst-c';

export {
  applyInstSQFilter,
  applyInstSQPreview,
  exportInstSQRecipeJson,
  parseInstSQRecipeJson,
  INST_SQ_RECIPE,
  INST_SQ_RECIPE_ID,
  INST_SQ_CSS_PREVIEW,
  INST_SQ_FILTER_ID,
  isInstSQFilter,
  subscribeInstSQPreview,
} from './instSq';

export {
  applyClassicUFilter,
  exportClassicURecipeJson,
  parseClassicURecipeJson,
  CLASSIC_U_RECIPE,
  CLASSIC_U_RECIPE_ID,
  CLASSIC_U_CSS_PREVIEW,
  CLASSIC_U_FILTER_ID,
  isClassicUFilter,
  subscribeClassicUPreview,
} from './classicU';

export {
  applyInstSQCFilter,
  exportInstSQCRecipeJson,
  parseInstSQCRecipeJson,
  INST_SQC_RECIPE,
  INST_SQC_RECIPE_ID,
  INST_SQC_CSS_PREVIEW,
  INST_SQC_FILTER_ID,
  isInstSQCFilter,
  subscribeInstSQCPreview,
  profileInstSQCRender,
} from './instSqc';

export { filmGrainAt, filmGrainClumpAt, organicNoise, midtoneWeight, shadowMidtoneWeight } from './grain';

export { renderInstCPreviewFrame, isInstCFilter, INST_C_FILTER_ID, createInstCPreviewState } from './instCLivePreview';
export { subscribeInstCPreview, updateInstCPreviewSource } from './instCPreviewEngine';
export { applyPolaroidDreamFast, createPolaroidDreamScratch } from './polaroidDreamFast';

export const FILM_FILTER_REGISTRY = {
  'inst-c': () => import('./recipes/inst-c').then((m) => m.INST_C_RECIPE),
  'inst-sq': () => import('./recipes/inst-sq').then((m) => m.INST_SQ_RECIPE),
  'inst-sqc': () => import('./recipes/inst-sqc').then((m) => m.INST_SQC_RECIPE),
  'autumn': () => import('./recipes/classic-u').then((m) => m.CLASSIC_U_RECIPE),
} as const;

/** Filters that bake via canvas pipeline (not CSS-only). */
export function isCanvasBakedFilter(filterId: string): boolean {
  return filterId === 'retro' || filterId === 'inst-sq' || filterId === 'film' || filterId === 'autumn';
}

export function applyCanvasBakedFilter(
  canvas: HTMLCanvasElement,
  filterId: string,
  seed?: number,
): void {
  if (filterId === 'retro') {
    _applyInstCFilter(canvas, seed);
    return;
  }
  if (filterId === 'inst-sq') {
    _applyInstSQFilter(canvas, undefined, seed);
    return;
  }
  if (filterId === 'film') {
    _applyInstSQCFilter(canvas, undefined, seed);
    return;
  }
  if (filterId === 'autumn') {
    _applyClassicUFilter(canvas, undefined, seed);
  }
}

const WEBGL_CAPTURE_FILTERS = new Set(['film', 'autumn']);

/** Capture canvas-baked filters — WebGL filters read source directly (same path as live preview). */
export function captureCanvasBakedStill(
  source: CanvasImageSource,
  width: number,
  height: number,
  filterId: string,
  mirror = false,
): string | null {
  if (width <= 0 || height <= 0) return null;

  if (WEBGL_CAPTURE_FILTERS.has(filterId)) {
    const canvas = document.createElement('canvas');
    const time = performance.now() * 0.001;
    const ok =
      filterId === 'film'
        ? renderInstSQCToCanvas(canvas, source, width, height, undefined, time, mirror, 'capture')
        : renderClassicUToCanvas(canvas, source, width, height, undefined, time, mirror);
    return ok ? canvas.toDataURL('image/jpeg') : null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, width, height);
  applyCanvasBakedFilter(canvas, filterId);
  return canvas.toDataURL('image/jpeg');
}

/** Legacy CSS string — Inst C live preview uses canvas pipeline instead. */
export const INST_C_CSS_PREVIEW =
  'brightness(0.80) contrast(1.62) saturate(0.78) sepia(0.08) blur(0.3px)';

