import type { FabricObject } from './types';
import { refreshTextObjectGeometry } from './textLayout';

export type PbCanvasTextAlign = 'left' | 'center' | 'right' | 'justify';
export type PbCanvasTextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export type PbCanvasTextStyle = {
  fill: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  textAlign: PbCanvasTextAlign;
  opacity: number;
  textTransform: PbCanvasTextTransform;
  letterSpacing: number;
  lineHeight: number;
};

/** @deprecated Use PbCanvasTextStyle — kept for sidebar compatibility. */
export type PbFabricTextStyle = PbCanvasTextStyle;
export type PbFabricTextAlign = PbCanvasTextAlign;
export type PbFabricTextTransform = PbCanvasTextTransform;

export function isTextObject(obj: FabricObject): boolean {
  const type = (obj.type ?? '').toLowerCase();
  return type === 'i-text' || type === 'itext' || type === 'text' || type === 'textbox';
}

type FabricTextLike = FabricObject & {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  underline?: boolean;
  linethrough?: boolean;
  lineThrough?: boolean;
  textAlign?: PbCanvasTextAlign;
  textTransform?: string;
  charSpacing?: number;
};

export function getTextStyle(obj: FabricObject): PbCanvasTextStyle | null {
  if (!isTextObject(obj)) return null;

  const text = obj as FabricTextLike;
  const fill = text.fill;
  const fontSize = typeof text.fontSize === 'number' ? text.fontSize : 24;
  const fontFamily =
    typeof text.fontFamily === 'string' && text.fontFamily.trim()
      ? text.fontFamily
      : 'Inter, sans-serif';
  const fontWeight = text.fontWeight;
  const bold =
    fontWeight === 'bold' || fontWeight === 700 || fontWeight === '700' || Number(fontWeight) >= 600;
  const fontStyle = text.fontStyle;
  const italic = fontStyle === 'italic' || fontStyle === 'oblique';
  const underline = !!text.underline;
  const strikethrough = !!(text.linethrough || text.lineThrough);
  const textAlign = text.textAlign ?? 'left';
  const opacity = typeof obj.opacity === 'number' ? obj.opacity : 1;
  const rawTransform = typeof text.textTransform === 'string' ? text.textTransform : 'none';
  const textTransform: PbCanvasTextTransform =
    rawTransform === 'uppercase' || rawTransform === 'lowercase' || rawTransform === 'capitalize'
      ? rawTransform
      : 'none';

  const letterSpacing = typeof text.charSpacing === 'number' ? text.charSpacing : 0;
  const lineHeight = typeof (text as any).lineHeight === 'number' ? (text as any).lineHeight : 1.16;

  return {
    fill: typeof fill === 'string' && fill !== 'transparent' ? fill : '#1f2937',
    fontSize,
    fontFamily,
    bold,
    italic,
    underline,
    strikethrough,
    textAlign,
    opacity,
    textTransform,
    letterSpacing,
    lineHeight,
  };
}

export function applyTextStylePatch(obj: FabricObject, patch: Partial<PbCanvasTextStyle>) {
  if (!isTextObject(obj)) return;
  const next: Record<string, unknown> = {};
  if (patch.fill !== undefined) next.fill = patch.fill;
  if (patch.fontSize !== undefined) next.fontSize = patch.fontSize;
  if (patch.fontFamily !== undefined) next.fontFamily = patch.fontFamily;
  if (patch.bold !== undefined) next.fontWeight = patch.bold ? 'bold' : 'normal';
  if (patch.italic !== undefined) next.fontStyle = patch.italic ? 'italic' : 'normal';
  if (patch.underline !== undefined) next.underline = patch.underline;
  if (patch.strikethrough !== undefined) next.linethrough = patch.strikethrough;
  if (patch.textAlign !== undefined) next.textAlign = patch.textAlign;
  if (patch.opacity !== undefined) next.opacity = patch.opacity;
  if (patch.textTransform !== undefined) next.textTransform = patch.textTransform;
  if (patch.letterSpacing !== undefined) next.charSpacing = patch.letterSpacing;
  if (patch.lineHeight !== undefined) next.lineHeight = patch.lineHeight;
  if ((patch as any).text !== undefined) next.text = (patch as any).text;
  obj.set(next);
  refreshTextObjectGeometry(obj);
}
