import { INST_SQC_RECIPE } from '../recipes/inst-sqc';
import type { InstSQCRecipe, InstSQCStages } from './types';

export type InstSQCComparisonStep = {
  id: string;
  label: string;
  stages: InstSQCStages;
  /** Film/print strengths activated with this step. */
  film?: Partial<InstSQCRecipe['film']>;
  print?: Partial<InstSQCRecipe['print']>;
};

const BASE_STAGES: InstSQCStages = {
  hdrDestroyer: true,
  microcontrastDestroyer: true,
  creamHighlights: false,
  luminanceGrain: true,
  pastelDyeMapper: false,
  shadowPollution: false,
  developmentVariation: false,
  chromaticAberration: false,
  edgeDevelopment: false,
  filmLatitude: false,
};

function recipeForStep(step: InstSQCComparisonStep): InstSQCRecipe {
  return {
    ...INST_SQC_RECIPE,
    stages: { ...step.stages },
    film: { ...INST_SQC_RECIPE.film, ...step.film },
    print: { ...INST_SQC_RECIPE.print, ...step.print },
  };
}

/** Incremental reintroduction — one color transform at a time after neutral base. */
export const INST_SQC_COMPARISON_STEPS: InstSQCComparisonStep[] = [
  {
    id: '00-neutral',
    label: 'Neutral (HDR + microcontrast + grain)',
    stages: { ...BASE_STAGES },
  },
  {
    id: '01-cream',
    label: '+ Cream highlights',
    stages: { ...BASE_STAGES, creamHighlights: true },
  },
  {
    id: '02-pastel',
    label: '+ Pastel dye mapper',
    stages: { ...BASE_STAGES, creamHighlights: true, pastelDyeMapper: true },
    film: { pastelStrength: 0.55 },
  },
  {
    id: '03-shadow',
    label: '+ Shadow pollution',
    stages: {
      ...BASE_STAGES,
      creamHighlights: true,
      pastelDyeMapper: true,
      shadowPollution: true,
    },
    film: { pastelStrength: 0.55, shadowPollution: 0.38 },
  },
  {
    id: '04-dev-var',
    label: '+ Development variation',
    stages: {
      ...BASE_STAGES,
      creamHighlights: true,
      pastelDyeMapper: true,
      shadowPollution: true,
      developmentVariation: true,
    },
    film: { pastelStrength: 0.55, shadowPollution: 0.38 },
    print: { developmentVariation: 0.22 },
  },
];

export function buildInstSQCComparisonRecipes(): { step: InstSQCComparisonStep; recipe: InstSQCRecipe }[] {
  return INST_SQC_COMPARISON_STEPS.map((step) => ({
    step,
    recipe: recipeForStep(step),
  }));
}

/** Current shipped baseline from inst-sqc.json (cream on, color stages off). */
export function instSQCBaselineRecipe(): InstSQCRecipe {
  return { ...INST_SQC_RECIPE };
}
