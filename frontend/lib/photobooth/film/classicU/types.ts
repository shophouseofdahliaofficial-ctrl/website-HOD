/** Classic U — full Lightroom preset schema (v3.2, GPU shader). */

export type ClassicULight = {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
};

export type ClassicUWhiteBalance = {
  temperature: number;
  tint: number;
};

export type ClassicUColor = {
  vibrance: number;
  saturation: number;
};

export type ClassicUEffects = {
  texture: number;
  clarity: number;
  dehaze: number;
};

export type ClassicUGrain = {
  amount: number;
  size: number;
  roughness: number;
};

export type ClassicUToneCurve = {
  blackLift: number;
  shadowLift: number;
  midContrast: number;
  highlightCompress: number;
  whiteCeiling: number;
};

export type ClassicUHSLBand = {
  hue: number;
  saturation: number;
  luminance: number;
};

export type ClassicUHSL = {
  red: ClassicUHSLBand;
  orange: ClassicUHSLBand;
  yellow: ClassicUHSLBand;
  green: ClassicUHSLBand;
  blue: ClassicUHSLBand;
  magenta: ClassicUHSLBand;
};

export type ClassicUGradeStop = {
  hue: number;
  saturation: number;
};

export type ClassicUColorGrading = {
  shadows: ClassicUGradeStop;
  highlights: ClassicUGradeStop;
};

export type ClassicURecipe = {
  id: 'autumn';
  name: 'Classic U';
  version: string;
  description?: string;
  light: ClassicULight;
  whiteBalance: ClassicUWhiteBalance;
  color: ClassicUColor;
  effects: ClassicUEffects;
  grain: ClassicUGrain;
  toneCurve: ClassicUToneCurve;
  hsl: ClassicUHSL;
  colorGrading: ClassicUColorGrading;
};

export type ClassicUProcessResult = {
  rendered: boolean;
};

export const CLASSIC_U_SCHEMA_VERSION = '3.2.0';
