import type { PbTextPresetKind } from './constants';
import type { PbCanvasTextStyle } from './textStyle';

export type PbTextPreset = {
  defaultText: string;
  style: PbCanvasTextStyle;
};

const base: Omit<PbCanvasTextStyle, 'fontSize'> = {
  fill: '#1f2937',
  fontFamily: 'Inter, sans-serif',
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  textAlign: 'center',
  opacity: 1,
  textTransform: 'none',
  letterSpacing: 0,
  lineHeight: 1.16,
};

export function getTextPreset(kind: PbTextPresetKind): PbTextPreset {
  if (kind === 'heading') {
    return {
      defaultText: 'Heading',
      style: { ...base, fontSize: 50, bold: true },
    };
  }
  if (kind === 'caption') {
    return {
      defaultText: 'Caption',
      style: { ...base, fontSize: 28, bold: true },
    };
  }
  return {
    defaultText: 'Start typing',
    style: { ...base, fontSize: 18 },
  };
}
