import { analyzeImageData } from '../analyzeImage';
import { INST_SQ_RECIPE } from '../recipes/inst-sq';
import type { InstSQProcessResult, InstSQRecipe } from './types';
import {
  adaptInstSQRecipe,
  applyInstSQAtmosphere,
  applyInstSQColorMapping,
  applyInstSQDust,
  applyInstSQFilmCompression,
  applyInstSQGrain,
  applyInstSQHalation,
  applyInstSQHighlightBloom,
  applyInstSQPlasticLens,
  applyInstSQScratches,
  applyInstSQVeil,
  applyInstSQVignette,
  applyInstSQCombinedFastPass,
} from './passes';
import { applyInstSQRadialMotionBlur } from './motionBlur';
import { applyInstSQEmulsion } from './emulsion';
import { applyInstSQOpticalFalloff, opticalScratchFromInstSQ } from './opticalFalloff';
import { createInstSQScratch, ensureInstSQScratchSize, type InstSQScratch } from './scratch';

export type InstSQQuality = 'full' | 'fast';

function runInstSQPipeline(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  recipe: InstSQRecipe,
  exposure: number,
  seed: number,
  scratch: InstSQScratch,
  quality: InstSQQuality,
): void {
  ensureInstSQScratchSize(scratch, w, h);

  if (quality === 'fast') {
    // Fast single-pass real-time pipeline to avoid main thread lag
    const imageData = ctx.getImageData(0, 0, w, h);
    applyInstSQCombinedFastPass(imageData.data, w, h, recipe, exposure, seed);
    ctx.putImageData(imageData, 0, 0);

    applyInstSQVeil(ctx, w, h, recipe.veil);
    applyInstSQVignette(ctx, w, h, recipe.vignette);
    return;
  }

  // Full-quality capture export pipeline
  const imageData = ctx.getImageData(0, 0, w, h);
  applyInstSQColorMapping(imageData.data, recipe, exposure);
  applyInstSQFilmCompression(imageData.data, recipe);
  ctx.putImageData(imageData, 0, 0);

  applyInstSQOpticalFalloff(
    ctx,
    w,
    h,
    recipe.opticalFalloff,
    opticalScratchFromInstSQ(scratch),
    quality,
  );

  applyInstSQPlasticLens(ctx, w, h, recipe.plasticLens, scratch.soft, scratch.softCtx, scratch.edge, scratch.edgeCtx);

  const atmosData = ctx.getImageData(0, 0, w, h);
  applyInstSQAtmosphere(atmosData.data, w, h, recipe);
  ctx.putImageData(atmosData, 0, 0);

  applyInstSQEmulsion(ctx, w, h, recipe.textures.emulsionOpacity, seed, scratch.emulsion, scratch.emulsionCtx);

  const grainData = ctx.getImageData(0, 0, w, h);
  applyInstSQGrain(grainData.data, w, h, recipe, seed, quality);
  applyInstSQDust(grainData.data, w, h, recipe.textures.dustOpacity, seed + 17);
  ctx.putImageData(grainData, 0, 0);

  applyInstSQScratches(ctx, w, h, recipe.textures.scratchCount, recipe.textures.scratchOpacity, seed + 31);

  applyInstSQVeil(ctx, w, h, recipe.veil);

  if (scratch.motion) {
    applyInstSQRadialMotionBlur(ctx, w, h, recipe.motionBlur, scratch.motion, quality);
  }

  applyInstSQHighlightBloom(ctx, w, h, recipe.bloom, scratch.bloom, scratch.bloomCtx, scratch.bloomBlur, scratch.bloomBlurCtx);
  applyInstSQHalation(ctx, w, h, recipe.halation, scratch.bloom, scratch.bloomCtx, scratch.bloomBlur, scratch.bloomBlurCtx);

  applyInstSQVignette(ctx, w, h, recipe.vignette);
}

/** Full-quality Inst SQ capture pipeline. */
export function applyInstSQFilter(
  canvas: HTMLCanvasElement,
  recipe: InstSQRecipe = INST_SQ_RECIPE,
  seed = 42,
): InstSQProcessResult | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const w = canvas.width;
  const h = canvas.height;
  if (w === 0 || h === 0) return null;

  const scratch = createInstSQScratch();
  if (!scratch) return null;

  const raw = ctx.getImageData(0, 0, w, h);
  const stats = analyzeImageData(raw.data, w, h);
  const adapted = adaptInstSQRecipe(stats, recipe);

  runInstSQPipeline(ctx, w, h, recipe, adapted.exposure, seed, scratch, 'full');

  return { stats, adapted };
}

/** Fast live-preview Inst SQ pipeline — separate scratch, no Inst C state. */
export function applyInstSQPreview(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  recipe: InstSQRecipe = INST_SQ_RECIPE,
  scratch: InstSQScratch,
  seed = 42,
): void {
  runInstSQPipeline(ctx, w, h, recipe, 0, seed, scratch, 'fast');
}

export function exportInstSQRecipeJson(recipe: InstSQRecipe = INST_SQ_RECIPE): string {
  return JSON.stringify(recipe, null, 2);
}

export function parseInstSQRecipeJson(json: string): InstSQRecipe {
  const parsed = JSON.parse(json) as Partial<InstSQRecipe>;
  return {
    ...INST_SQ_RECIPE,
    ...parsed,
    grade: { ...INST_SQ_RECIPE.grade, ...parsed.grade },
    colorMapping: { ...INST_SQ_RECIPE.colorMapping, ...parsed.colorMapping },
    tonal: { ...INST_SQ_RECIPE.tonal, ...parsed.tonal },
    plasticLens: { ...INST_SQ_RECIPE.plasticLens, ...parsed.plasticLens },
    opticalFalloff: { ...INST_SQ_RECIPE.opticalFalloff, ...parsed.opticalFalloff },
    atmosphere: { ...INST_SQ_RECIPE.atmosphere, ...parsed.atmosphere },
    textures: { ...INST_SQ_RECIPE.textures, ...parsed.textures },
    veil: { ...INST_SQ_RECIPE.veil, ...parsed.veil },
    bloom: { ...INST_SQ_RECIPE.bloom, ...parsed.bloom },
    halation: { ...INST_SQ_RECIPE.halation, ...parsed.halation },
    vignette: { ...INST_SQ_RECIPE.vignette, ...parsed.vignette },
    motionBlur: { ...INST_SQ_RECIPE.motionBlur, ...parsed.motionBlur },
    adaptation: { ...INST_SQ_RECIPE.adaptation, ...parsed.adaptation },
  };
}

export { createInstSQScratch, ensureInstSQScratchSize };
export type { InstSQScratch };
