/** Inst SQC v3.2 — staged pipeline recipe schema. */

export type InstSQCStages = {
  hdrDestroyer: boolean;
  microcontrastDestroyer: boolean;
  creamHighlights: boolean;
  luminanceGrain: boolean;
  pastelDyeMapper: boolean;
  shadowPollution: boolean;
  developmentVariation: boolean;
  chromaticAberration: boolean;
  edgeDevelopment: boolean;
  filmLatitude: boolean;
};

export type InstSQCCamera = {
  dynamicRange: number;
  highlightRoll: number;
  shadowLoss: number;
  midtonePriority: number;
  microcontrastReduction: number;
  edgeSoftness: number;
  chromaticAberration: number;
  fieldCurvature: number;
};

export type InstSQCFilm = {
  creamHighlight: number;
  creamWarmth: number;
  pastelStrength: number;
  shadowPollution: number;
  shadowGradeHue: number;
  latitudeBrightDesat: number;
  latitudeDarkMuddy: number;
};

export type InstSQCPrint = {
  grainAmount: number;
  grainSize: number;
  developmentVariation: number;
  edgeWeakness: number;
  cornerCool: number;
  bottomWarm: number;
};

export type InstSQCRecipe = {
  id: 'film';
  name: 'Inst SQC';
  version: string;
  description?: string;
  stages: InstSQCStages;
  camera: InstSQCCamera;
  film: InstSQCFilm;
  print: InstSQCPrint;
};

export type InstSQCProcessResult = {
  rendered: boolean;
  timingMs?: number;
};

export const INST_SQC_SCHEMA_VERSION = '3.2.0';

/** Reintroduction order for validation (enable one at a time). */
export const INST_SQC_COLOR_REINTRO_ORDER = [
  'creamHighlights',
  'pastelDyeMapper',
  'shadowPollution',
  'developmentVariation',
] as const;
