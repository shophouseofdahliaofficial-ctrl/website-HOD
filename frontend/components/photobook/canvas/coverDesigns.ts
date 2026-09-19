import {
  CENTER_INSET_FRAME_RATIO,
  DEFAULT_GAP,
  LAYOUT_HEADLINE_BAND_RATIO,
  OUTER_PADDING,
  PAGE_SIZE,
  type PbLayoutDefinition,
  type PbLayoutFrameDef,
} from './layouts';

export type PbCoverDesignId =
  | 'cover-full-bleed'
  | 'cover-full-page'
  | 'cover-center-inset'
  | 'cover-title-top'
  | 'cover-title-bottom';

function buildFullBleed(pageW: number, pageH: number): PbLayoutFrameDef[] {
  return [
    {
      id: 'f-full-bleed',
      x: 0,
      y: 0,
      width: pageW,
      height: pageH,
    },
  ];
}

function buildFullPage(pageW: number, pageH: number): PbLayoutFrameDef[] {
  return [
    {
      id: 'f-full',
      x: OUTER_PADDING,
      y: OUTER_PADDING,
      width: pageW - OUTER_PADDING * 2,
      height: pageH - OUTER_PADDING * 2,
    },
  ];
}

function buildCenterInset(pageW: number, pageH: number): PbLayoutFrameDef[] {
  const contentW = pageW - OUTER_PADDING * 2;
  const contentH = pageH - OUTER_PADDING * 2;
  const frameSize = Math.round(Math.min(contentW, contentH) * CENTER_INSET_FRAME_RATIO);
  const x = OUTER_PADDING + (contentW - frameSize) / 2;
  const y = OUTER_PADDING + (contentH - frameSize) / 2;
  return [
    {
      id: 'f-center',
      x,
      y,
      width: frameSize,
      height: frameSize,
    },
  ];
}

function buildCoverTitleTop(pageW: number, pageH: number, gap: number): PbLayoutFrameDef[] {
  const contentW = pageW - OUTER_PADDING * 2;
  const contentH = pageH - OUTER_PADDING * 2;
  const headlineH = Math.round(contentH * LAYOUT_HEADLINE_BAND_RATIO);
  const imageH = contentH - headlineH - gap;
  return [
    {
      id: 'f-image',
      x: OUTER_PADDING,
      y: OUTER_PADDING + headlineH + gap,
      width: contentW,
      height: imageH,
    },
  ];
}

function buildCoverTitleBottom(pageW: number, pageH: number, gap: number): PbLayoutFrameDef[] {
  const contentW = pageW - OUTER_PADDING * 2;
  const contentH = pageH - OUTER_PADDING * 2;
  const headlineH = Math.round(contentH * LAYOUT_HEADLINE_BAND_RATIO);
  const imageH = contentH - headlineH - gap;
  return [
    {
      id: 'f-image',
      x: OUTER_PADDING,
      y: OUTER_PADDING,
      width: contentW,
      height: imageH,
    },
  ];
}

export function computeCoverDesignFrames(
  designId: PbCoverDesignId,
  pageW = PAGE_SIZE,
  pageH = PAGE_SIZE,
  gap = DEFAULT_GAP,
): PbLayoutFrameDef[] {
  switch (designId) {
    case 'cover-full-bleed':
      return buildFullBleed(pageW, pageH);
    case 'cover-full-page':
      return buildFullPage(pageW, pageH);
    case 'cover-center-inset':
      return buildCenterInset(pageW, pageH);
    case 'cover-title-top':
      return buildCoverTitleTop(pageW, pageH, gap);
    case 'cover-title-bottom':
      return buildCoverTitleBottom(pageW, pageH, gap);
    default:
      return buildFullPage(pageW, pageH);
  }
}

export function getPbCoverDesignDefinition(
  designId: PbCoverDesignId,
  pageW = PAGE_SIZE,
  pageH = PAGE_SIZE,
): PbLayoutDefinition {
  const gap = DEFAULT_GAP;
  const frames = computeCoverDesignFrames(designId, pageW, pageH, gap);
  const names: Record<PbCoverDesignId, string> = {
    'cover-full-bleed': 'Full canvas image',
    'cover-full-page': 'Full page image',
    'cover-center-inset': 'Center inset',
    'cover-title-top': 'Title + image',
    'cover-title-bottom': 'Image + title',
  };
  return {
    id: designId,
    name: names[designId] ?? designId,
    kind: 'template',
    gap,
    frames,
  };
}

export const PB_COVER_DESIGN_IDS: PbCoverDesignId[] = [
  'cover-full-bleed',
  'cover-full-page',
  'cover-center-inset',
  'cover-title-top',
  'cover-title-bottom',
];

export function normalizeCoverDesignId(design?: string | null): PbCoverDesignId {
  switch (design) {
    case 'cover-full-bleed':
    case 'cover-full-page':
    case 'cover-center-inset':
    case 'cover-title-top':
    case 'cover-title-bottom':
      return design;
    default:
      return 'cover-full-page';
  }
}

export function coverDesignUsesHeadline(designId: PbCoverDesignId): boolean {
  return designId === 'cover-title-top' || designId === 'cover-title-bottom';
}

export function coverDesignHeadlineLayoutId(
  designId: PbCoverDesignId,
): 'text-top' | 'text-bottom' | null {
  if (designId === 'cover-title-top') return 'text-top';
  if (designId === 'cover-title-bottom') return 'text-bottom';
  return null;
}
