export type {
  ClassicURecipe,
  ClassicUProcessResult,
  ClassicULight,
  ClassicUWhiteBalance,
  ClassicUColor,
  ClassicUEffects,
  ClassicUGrain,
  ClassicUToneCurve,
  ClassicUHSL,
  ClassicUHSLBand,
  ClassicUColorGrading,
  ClassicUGradeStop,
} from './types';

export {
  applyClassicUFilter,
  exportClassicURecipeJson,
  parseClassicURecipeJson,
} from './ClassicUProcessor';

export {
  subscribeClassicUPreview,
  isClassicUFilter,
  CLASSIC_U_FILTER_ID,
} from './ClassicUPreview';

export { CLASSIC_U_RECIPE, CLASSIC_U_RECIPE_ID } from '../recipes/classic-u';

/** CSS fallback when WebGL preview is unavailable. */
export const CLASSIC_U_CSS_PREVIEW =
  'brightness(1.06) contrast(1.22) saturate(0.90) sepia(0.05)';
