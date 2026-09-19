import { CLASSIC_U_RECIPE } from '../recipes/classic-u';
import type { ClassicUProcessResult, ClassicURecipe } from './types';
import { getClassicUWebGLRenderer, renderClassicUToCanvas } from './webglRenderer';

/** Full-quality capture — single GPU shader pass, no CPU pixel loops. */
export function applyClassicUFilter(
  canvas: HTMLCanvasElement,
  recipe: ClassicURecipe = CLASSIC_U_RECIPE,
  seed = 42,
): ClassicUProcessResult | null {
  const w = canvas.width;
  const h = canvas.height;
  if (w === 0 || h === 0) return null;

  const renderer = getClassicUWebGLRenderer();
  if (!renderer) return null;

  const source = document.createElement('canvas');
  source.width = w;
  source.height = h;
  const srcCtx = source.getContext('2d');
  if (!srcCtx) return null;
  srcCtx.drawImage(canvas, 0, 0);

  const ok = renderClassicUToCanvas(canvas, source, w, h, recipe, seed * 0.001, false);
  return { rendered: ok };
}

export function exportClassicURecipeJson(recipe: ClassicURecipe = CLASSIC_U_RECIPE): string {
  return JSON.stringify(recipe, null, 2);
}

export function parseClassicURecipeJson(json: string): ClassicURecipe {
  const parsed = JSON.parse(json) as Partial<ClassicURecipe>;
  return {
    ...CLASSIC_U_RECIPE,
    ...parsed,
    light: { ...CLASSIC_U_RECIPE.light, ...parsed.light },
    whiteBalance: { ...CLASSIC_U_RECIPE.whiteBalance, ...parsed.whiteBalance },
    color: { ...CLASSIC_U_RECIPE.color, ...parsed.color },
    effects: { ...CLASSIC_U_RECIPE.effects, ...parsed.effects },
    grain: { ...CLASSIC_U_RECIPE.grain, ...parsed.grain },
    toneCurve: { ...CLASSIC_U_RECIPE.toneCurve, ...parsed.toneCurve },
    hsl: {
      red: { ...CLASSIC_U_RECIPE.hsl.red, ...parsed.hsl?.red },
      orange: { ...CLASSIC_U_RECIPE.hsl.orange, ...parsed.hsl?.orange },
      yellow: { ...CLASSIC_U_RECIPE.hsl.yellow, ...parsed.hsl?.yellow },
      green: { ...CLASSIC_U_RECIPE.hsl.green, ...parsed.hsl?.green },
      blue: { ...CLASSIC_U_RECIPE.hsl.blue, ...parsed.hsl?.blue },
      magenta: { ...CLASSIC_U_RECIPE.hsl.magenta, ...parsed.hsl?.magenta },
    },
    colorGrading: {
      shadows: { ...CLASSIC_U_RECIPE.colorGrading.shadows, ...parsed.colorGrading?.shadows },
      highlights: { ...CLASSIC_U_RECIPE.colorGrading.highlights, ...parsed.colorGrading?.highlights },
    },
  };
}
