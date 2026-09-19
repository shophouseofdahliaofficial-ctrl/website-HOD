export const DEFAULT_FLIPBOOK_HARDCOVER_COLOR = '#5f6b3d';

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function normalizeFlipbookHardcoverColor(color?: string | null) {
  if (!color || !HEX_COLOR_PATTERN.test(color.trim())) {
    return DEFAULT_FLIPBOOK_HARDCOVER_COLOR;
  }
  return color.trim().toLowerCase();
}

export function flipbookHardcoverBackground(color: string) {
  const normalized = normalizeFlipbookHardcoverColor(color);
  return `linear-gradient(165deg, color-mix(in srgb, ${normalized} 86%, white) 0%, ${normalized} 52%, color-mix(in srgb, ${normalized} 78%, black) 100%)`;
}

export const FLIPBOOK_HARDCOVER_PRESETS = [
  { label: 'Olive', value: '#5f6b3d' },
  { label: 'Forest', value: '#2f4a32' },
  { label: 'Navy', value: '#1e3354' },
  { label: 'Burgundy', value: '#6b2f3d' },
  { label: 'Charcoal', value: '#3a3a3a' },
  { label: 'Tan', value: '#8b7355' },
] as const;
