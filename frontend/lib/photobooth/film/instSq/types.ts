/** Inst SQ — independent square instant-film recipe schema (not shared with Inst C). */

export type InstSQGrade = {
  temperature: number;
  tint: number;
  contrast: number;
  saturation: number;
  fade: number;
};

export type InstSQColorMapping = {
  greenTealShift: number;
  blueCyanShift: number;
  pinkRoseShift: number;
  whiteCreamLift: number;
  blackBlueGray: number;
};

export type InstSQTonal = {
  highlightCompression: number;
  shadowLift: number;
  shadowBlueAmount: number;
  midtoneSoftness: number;
  dynamicRangeCompression: number;
};

export type InstSQPlasticLens = {
  microContrastReduction: number;
  opticalSoftness: number;
  edgeSoftness: number;
  globalBlur: number;
};

export type InstSQOpticalFalloff = {
  strength: number;
  focusCenterY: number;
  focusBandHeight: number;
  focusBandInner: number;
  foregroundBlur: number;
  backgroundBlur: number;
  foregroundReach: number;
  backgroundReach: number;
  fieldCurvature: number;
  fieldCurvatureStrength: number;
};

export type InstSQAtmosphere = {
  cyanStrength: number;
  shadowBlueBoost: number;
};

export type InstSQTextures = {
  emulsionOpacity: number;
  grainAmount: number;
  grainSize: number;
  dustOpacity: number;
  scratchOpacity: number;
  scratchCount: number;
};

export type InstSQVeil = {
  r: number;
  g: number;
  b: number;
  opacity: number;
};

export type InstSQBloom = {
  intensity: number;
  threshold: number;
  radius: number;
};

export type InstSQHalation = {
  intensity: number;
  threshold: number;
  radius: number;
};

export type InstSQVignette = {
  strength: number;
  inner: number;
  outer: number;
};

export type InstSQMotionBlur = {
  amount: number;
  distance: number;
  angle: number;
  centerRadius: number;
  falloff: number;
};

export type InstSQAdaptation = {
  targetBrightness: number;
  maxDarkExposureLift: number;
  maxBrightExposureCut: number;
  darkThreshold: number;
  brightThreshold: number;
};

export type InstSQRecipe = {
  id: 'inst-sq';
  name: 'Inst SQ';
  version: string;
  description?: string;
  mood?: string[];
  grade: InstSQGrade;
  colorMapping: InstSQColorMapping;
  tonal: InstSQTonal;
  plasticLens: InstSQPlasticLens;
  opticalFalloff: InstSQOpticalFalloff;
  atmosphere: InstSQAtmosphere;
  textures: InstSQTextures;
  veil: InstSQVeil;
  bloom: InstSQBloom;
  halation: InstSQHalation;
  vignette: InstSQVignette;
  motionBlur: InstSQMotionBlur;
  adaptation: InstSQAdaptation;
};

export type InstSQAdaptedParams = {
  exposure: number;
  contrast: number;
  saturation: number;
};

export type InstSQProcessResult = {
  stats: import('../types').ImageStats;
  adapted: InstSQAdaptedParams;
};

export const INST_SQ_SCHEMA_VERSION = '1.2.0';
