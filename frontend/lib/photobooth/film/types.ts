/** Film filter recipe — serializable JSON schema for Reto Filter Studio + FilmPipeline. */

export type BloomSettings = {
  intensity: number;
  threshold: number;
  softness: number;
  radius: number;
};

export type HalationSettings = {
  intensity: number;
  threshold: number;
  softness: number;
  radius: number;
  redBleed: number;
};

export type HighlightRolloffSettings = {
  /** Luminance (0–1) where shoulder compression begins — typically 0.70–0.75 */
  knee: number;
  /** Cream white point RGB — avoids clipping to pure white */
  whitePointR: number;
  whitePointG: number;
  whitePointB: number;
  /** Rolloff strength 0–1 */
  strength: number;
};

export type LensDiffusionSettings = {
  /** Blend amount — typically 0.05–0.10 */
  intensity: number;
  threshold: number;
  softness: number;
  /** Large-radius atmospheric blur (px) */
  radius: number;
};

export type GrainSettings = {
  amount: number;
  midtoneBoost: number;
  /** Grain scale — higher = larger, softer grain */
  size: number;
  seed?: number;
};

export type VignetteSettings = {
  strength: number;
  softness: number;
  roundness: number;
};

export type HueShiftSettings = {
  /** Degrees — positive shifts greens toward yellow/olive */
  greens: number;
  /** Degrees — positive shifts blues toward cyan */
  blues: number;
  /** 0–1 — reduce saturation change on skin-tone hues */
  skinPreserve: number;
};

export type AdaptationSettings = {
  targetBrightness: number;
  maxDarkExposureLift: number;
  maxBrightExposureCut: number;
  darkThreshold: number;
  brightThreshold: number;
  flatContrastThreshold: number;
  flatContrastBoost: number;
  saturatedThreshold: number;
  saturatedReduction: number;
};

export type PolaroidDreamSettings = {
  enabled: boolean;
  brightness: number;
  contrast: number;
  saturate: number;
  sepia: number;
  blurPx: number;
  grainNoise: number;
  hazeR: number;
  hazeG: number;
  hazeB: number;
  hazeOpacity: number;
  vignetteOpacity: number;
  vignetteInner: number;
  vignetteOuter: number;
  glowOpacity: number;
  glowBlurPx: number;
  /** Bright-area bloom — visible dreamy halation on sky/skin/highlights */
  highlightGlowOpacity: number;
  highlightGlowBlur: number;
  highlightGlowThreshold: number;
  /** Pull shadows toward black — 0–1 */
  shadowCrush?: number;
  /** Radial motion blur — 0 disables; edges streak, center stays sharp */
  motionBlurAmount?: number;
  /** Max motion streak length in px (at full edge strength) */
  motionBlurDistance?: number;
  /** Motion direction in degrees — slight tilt feels like handheld drift */
  motionBlurAngle?: number;
  /** 0–1 inner zone radius (fully sharp subject area) */
  motionBlurCenterRadius?: number;
  /** 0–1 width of blur ramp from center to edges */
  motionBlurFalloff?: number;
};

export type AnalogSettings = {
  /** Early optical softening — reduces digital sharpness */
  lensSoftness: number;
  /** High-frequency / local contrast reduction */
  microContrast: number;
  /** Pastel ink compression — sage greens, peach reds, cyan-gray blues */
  pastelCompression: number;
  /** Milky highlight wash + cream haze */
  atmosphericVeil: number;
  /** Dynamic range compression — lifted blacks, soft highlights */
  tonalCompression: number;
  /** Subtle per-channel film inconsistency */
  colorDrift: number;
  /** Full-frame optical diffusion character */
  opticalSoftness: number;
};

export type FilmRecipe = {
  id: string;
  name: string;
  version: string;
  description?: string;
  mood?: string[];

  /** Base color grade (EV) */
  exposure: number;
  contrast: number;
  saturation: number;

  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  fade: number;

  temperature: number;
  tint: number;

  hueShifts: HueShiftSettings;

  /** Instax / instant-film analog character (optional) */
  analog?: AnalogSettings;

  /** Polaroid Dream grade — warm matte curve, high contrast, grain, glow */
  polaroidDream?: PolaroidDreamSettings;

  highlightRolloff: HighlightRolloffSettings;
  bloom: BloomSettings;
  lensDiffusion: LensDiffusionSettings;
  halation: HalationSettings;
  grain: GrainSettings;
  vignette: VignetteSettings;

  adaptation: AdaptationSettings;
};

export type ImageStats = {
  brightness: number;
  contrast: number;
  saturation: number;
  dynamicRange: number;
  warmth: number;
  p5: number;
  p50: number;
  p95: number;
  histogram: Uint32Array;
  sampleCount: number;
};

export type AdaptedParams = {
  exposure: number;
  contrast: number;
  saturation: number;
  highlights: number;
  stats: ImageStats;
};

export type ProcessResult = {
  stats: ImageStats;
  adapted: AdaptedParams;
};

export const RECIPE_SCHEMA_VERSION = '1.0.0';
