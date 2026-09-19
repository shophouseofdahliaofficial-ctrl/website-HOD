import { INST_SQC_RECIPE } from '../recipes/inst-sqc';
import type { InstSQCProcessResult, InstSQCRecipe } from './types';
import { getInstSQCWebGLRenderer, renderInstSQCToCanvas } from './webglRenderer';
import { profileInstSQCRender } from './profiler';

/** Full-quality capture — single unified GPU pass. */
export function applyInstSQCFilter(
  canvas: HTMLCanvasElement,
  recipe: InstSQCRecipe = INST_SQC_RECIPE,
  seed = 42,
): InstSQCProcessResult | null {
  const w = canvas.width;
  const h = canvas.height;
  if (w === 0 || h === 0) return null;

  const renderer = getInstSQCWebGLRenderer();
  if (!renderer) return null;

  const source = document.createElement('canvas');
  source.width = w;
  source.height = h;
  const srcCtx = source.getContext('2d');
  if (!srcCtx) return null;
  srcCtx.drawImage(canvas, 0, 0);

  let rendered = false;
  const timing = profileInstSQCRender(() => {
    rendered = renderInstSQCToCanvas(canvas, source, w, h, recipe, seed * 0.001, false, 'capture');
  });

  return { rendered, timingMs: timing.total };
}

export function exportInstSQCRecipeJson(recipe: InstSQCRecipe = INST_SQC_RECIPE): string {
  return JSON.stringify(recipe, null, 2);
}

export function parseInstSQCRecipeJson(json: string): InstSQCRecipe {
  const parsed = JSON.parse(json) as Partial<InstSQCRecipe>;
  return {
    ...INST_SQC_RECIPE,
    ...parsed,
    stages: { ...INST_SQC_RECIPE.stages, ...parsed.stages },
    camera: { ...INST_SQC_RECIPE.camera, ...parsed.camera },
    film: { ...INST_SQC_RECIPE.film, ...parsed.film },
    print: { ...INST_SQC_RECIPE.print, ...parsed.print },
  };
}
