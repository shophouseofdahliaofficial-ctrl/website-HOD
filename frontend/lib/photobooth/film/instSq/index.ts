export type {
  InstSQRecipe,
  InstSQAdaptedParams,
  InstSQProcessResult,
} from './types';

export {
  applyInstSQFilter,
  applyInstSQPreview,
  exportInstSQRecipeJson,
  parseInstSQRecipeJson,
  createInstSQScratch,
} from './InstSQProcessor';

export {
  subscribeInstSQPreview,
  isInstSQFilter,
  INST_SQ_FILTER_ID,
} from './InstSQPreview';

export { INST_SQ_RECIPE, INST_SQ_RECIPE_ID } from '../recipes/inst-sq';

/** CSS fallback only — live preview uses canvas pipeline. */
export const INST_SQ_CSS_PREVIEW =
  'brightness(0.92) contrast(0.75) saturate(0.68) sepia(0.04) hue-rotate(-8deg)';
