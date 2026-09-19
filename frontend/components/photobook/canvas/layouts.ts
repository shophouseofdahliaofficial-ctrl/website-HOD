import { PB_PAGE_SIZE_PX } from './constants';

export const PAGE_SIZE = PB_PAGE_SIZE_PX;
export const DEFAULT_GAP = 12;
/** Inset from page edges; matches inter-frame gap for consistent gutters. */
export const OUTER_PADDING = DEFAULT_GAP;

export type PbLayoutFrameDef = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PbLayoutDefinition = {
  id: string;
  name: string;
  kind: 'template' | 'blank';
  gap: number;
  frames: PbLayoutFrameDef[];
};

export type PbLayoutId =
  | 'grid-4'
  | 'grid-6'
  | 'left-full-right-2'
  | 'left-2-right-full'
  | 'stacked-horizontal'
  | 'text-top'
  | 'text-bottom'
  | 'two-vertical'
  | 'three-vertical'
  | 'four-vertical'
  | 'four-horizontal'
  | 'three-horizontal'
  | 'center-inset'
  | 'double-center-inset'
  | 'single'
  | 'blank';

/** Share of the shorter page edge used for the centered inset frame (square). */
export const CENTER_INSET_FRAME_RATIO = 0.45;

/** Share of page height reserved for the heading band in text-top / text-bottom layouts. */
export const LAYOUT_HEADLINE_BAND_RATIO = 0.22;

function buildGridFrames(
  cols: number,
  rows: number,
  pageW: number,
  pageH: number,
  gap: number,
): PbLayoutFrameDef[] {
  const totalGapX = gap * Math.max(0, cols - 1);
  const totalGapY = gap * Math.max(0, rows - 1);
  const cellW = (pageW - OUTER_PADDING * 2 - totalGapX) / cols;
  const cellH = (pageH - OUTER_PADDING * 2 - totalGapY) / rows;
  const frames: PbLayoutFrameDef[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      frames.push({
        id: `f-${r}-${c}`,
        x: OUTER_PADDING + c * (cellW + gap),
        y: OUTER_PADDING + r * (cellH + gap),
        width: cellW,
        height: cellH,
      });
    }
  }
  return frames;
}

function buildLeftFullRightTwo(pageW: number, pageH: number, gap: number): PbLayoutFrameDef[] {
  const colW = (pageW - OUTER_PADDING * 2 - gap) / 2;
  const rowH = (pageH - OUTER_PADDING * 2 - gap) / 2;
  return [
    {
      id: 'f-left',
      x: OUTER_PADDING,
      y: OUTER_PADDING,
      width: colW,
      height: pageH - OUTER_PADDING * 2,
    },
    {
      id: 'f-right-top',
      x: OUTER_PADDING + colW + gap,
      y: OUTER_PADDING,
      width: colW,
      height: rowH,
    },
    {
      id: 'f-right-bottom',
      x: OUTER_PADDING + colW + gap,
      y: OUTER_PADDING + rowH + gap,
      width: colW,
      height: rowH,
    },
  ];
}

function buildLeftTwoRightFull(pageW: number, pageH: number, gap: number): PbLayoutFrameDef[] {
  const colW = (pageW - OUTER_PADDING * 2 - gap) / 2;
  const rowH = (pageH - OUTER_PADDING * 2 - gap) / 2;
  return [
    {
      id: 'f-left-top',
      x: OUTER_PADDING,
      y: OUTER_PADDING,
      width: colW,
      height: rowH,
    },
    {
      id: 'f-left-bottom',
      x: OUTER_PADDING,
      y: OUTER_PADDING + rowH + gap,
      width: colW,
      height: rowH,
    },
    {
      id: 'f-right',
      x: OUTER_PADDING + colW + gap,
      y: OUTER_PADDING,
      width: colW,
      height: pageH - OUTER_PADDING * 2,
    },
  ];
}

function buildTextTopImage(pageW: number, pageH: number): PbLayoutFrameDef[] {
  const contentW = pageW - OUTER_PADDING * 2;
  const contentH = pageH - OUTER_PADDING * 2;
  const headlineH = Math.round(contentH * LAYOUT_HEADLINE_BAND_RATIO);
  const headlineGap = DEFAULT_GAP;
  const imageH = contentH - headlineH - headlineGap;
  return [
    {
      id: 'f-image',
      x: OUTER_PADDING,
      y: OUTER_PADDING + headlineH + headlineGap,
      width: contentW,
      height: imageH,
    },
  ];
}

function buildImageTextBottom(pageW: number, pageH: number): PbLayoutFrameDef[] {
  const contentW = pageW - OUTER_PADDING * 2;
  const contentH = pageH - OUTER_PADDING * 2;
  const headlineH = Math.round(contentH * LAYOUT_HEADLINE_BAND_RATIO);
  const headlineGap = DEFAULT_GAP;
  const imageH = contentH - headlineH - headlineGap;
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

function buildStackedHorizontal(pageW: number, pageH: number, gap: number): PbLayoutFrameDef[] {
  const rowH = (pageH - OUTER_PADDING * 2 - gap) / 2;
  return [
    {
      id: 'f-top',
      x: OUTER_PADDING,
      y: OUTER_PADDING,
      width: pageW - OUTER_PADDING * 2,
      height: rowH,
    },
    {
      id: 'f-bottom',
      x: OUTER_PADDING,
      y: OUTER_PADDING + rowH + gap,
      width: pageW - OUTER_PADDING * 2,
      height: rowH,
    },
  ];
}

function buildTwoVertical(pageW: number, pageH: number, gap: number): PbLayoutFrameDef[] {
  const colW = (pageW - OUTER_PADDING * 2 - gap) / 2;
  return [
    {
      id: 'f-left',
      x: OUTER_PADDING,
      y: OUTER_PADDING,
      width: colW,
      height: pageH - OUTER_PADDING * 2,
    },
    {
      id: 'f-right',
      x: OUTER_PADDING + colW + gap,
      y: OUTER_PADDING,
      width: colW,
      height: pageH - OUTER_PADDING * 2,
    },
  ];
}

function buildSingleFull(pageW: number, pageH: number): PbLayoutFrameDef[] {
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

function buildDoubleCenterInset(
  pageW: number,
  pageH: number,
  gap = DEFAULT_GAP,
): PbLayoutFrameDef[] {
  const contentW = pageW - OUTER_PADDING * 2;
  const contentH = pageH - OUTER_PADDING * 2;
  const frameSize = Math.round(Math.min(contentW, contentH) * CENTER_INSET_FRAME_RATIO);
  const x = OUTER_PADDING + (contentW - frameSize) / 2;
  const totalStackH = frameSize * 2 + gap;
  const startY = OUTER_PADDING + (contentH - totalStackH) / 2;
  return [
    {
      id: 'f-center-top',
      x,
      y: startY,
      width: frameSize,
      height: frameSize,
    },
    {
      id: 'f-center-bottom',
      x,
      y: startY + frameSize + gap,
      width: frameSize,
      height: frameSize,
    },
  ];
}

export function computeLayoutFrames(
  layoutId: PbLayoutId,
  pageW = PAGE_SIZE,
  pageH = PAGE_SIZE,
  gap = DEFAULT_GAP,
): PbLayoutFrameDef[] {
  switch (layoutId) {
    case 'grid-4':
      return buildGridFrames(2, 2, pageW, pageH, gap);
    case 'grid-6':
      return buildGridFrames(3, 2, pageW, pageH, gap);
    case 'left-full-right-2':
      return buildLeftFullRightTwo(pageW, pageH, gap);
    case 'left-2-right-full':
      return buildLeftTwoRightFull(pageW, pageH, gap);
    case 'stacked-horizontal':
      return buildStackedHorizontal(pageW, pageH, gap);
    case 'text-top':
      return buildTextTopImage(pageW, pageH);
    case 'text-bottom':
      return buildImageTextBottom(pageW, pageH);
    case 'two-vertical':
      return buildTwoVertical(pageW, pageH, gap);
    case 'three-vertical':
      return buildGridFrames(3, 1, pageW, pageH, gap);
    case 'four-vertical':
      return buildGridFrames(4, 1, pageW, pageH, gap);
    case 'four-horizontal':
      return buildGridFrames(1, 4, pageW, pageH, gap);
    case 'three-horizontal':
      return buildGridFrames(1, 3, pageW, pageH, gap);
    case 'center-inset':
      return buildCenterInset(pageW, pageH);
    case 'double-center-inset':
      return buildDoubleCenterInset(pageW, pageH, gap);
    case 'single':
      return buildSingleFull(pageW, pageH);
    case 'blank':
      return [];
    default:
      return buildSingleFull(pageW, pageH);
  }
}

export function resolveLayoutInnerGap(frameGapEnabled?: boolean): number {
  return frameGapEnabled === false ? 0 : DEFAULT_GAP;
}

export function layoutHasMultipleFrames(
  layoutId: PbLayoutId,
  pageW = PAGE_SIZE,
  pageH = PAGE_SIZE,
): boolean {
  return computeLayoutFrames(layoutId, pageW, pageH, DEFAULT_GAP).length > 1;
}

export function getPbLayoutDefinition(
  layoutId: PbLayoutId,
  pageW = PAGE_SIZE,
  pageH = PAGE_SIZE,
  innerGap = DEFAULT_GAP,
): PbLayoutDefinition {
  const frames = computeLayoutFrames(layoutId, pageW, pageH, innerGap);
  const names: Record<PbLayoutId, string> = {
    'grid-4': '2×2 Grid',
    'grid-6': '3×2 Grid',
    'left-full-right-2': 'Large + 2 Stacked',
    'left-2-right-full': '2 Stacked + Large',
    'stacked-horizontal': '2 Stacked Horizontal',
    'text-top': 'Heading + Image',
    'text-bottom': 'Image + Heading',
    'two-vertical': '2 Vertical',
    'three-vertical': '3 Vertical',
    'four-vertical': '4 Vertical',
    'four-horizontal': '4 Horizontal',
    'three-horizontal': '3 Stacked Horizontal',
    'center-inset': 'Center Inset',
    'double-center-inset': 'Double Center Inset',
    single: 'Full page image',
    blank: 'Blank / Custom',
  };
  return {
    id: layoutId,
    name: names[layoutId] ?? layoutId,
    kind: layoutId === 'blank' ? 'blank' : 'template',
    gap: innerGap,
    frames,
  };
}

/** Layout ids shown in the editor layout picker (15 layouts). */
export const PB_EDITOR_LAYOUT_IDS: PbLayoutId[] = [
  'blank',
  'grid-4',
  'grid-6',
  'left-full-right-2',
  'left-2-right-full',
  'stacked-horizontal',
  'text-top',
  'text-bottom',
  'two-vertical',
  'three-vertical',
  'four-vertical',
  'four-horizontal',
  'three-horizontal',
  'center-inset',
  'double-center-inset',
  'single',
];

/** Map legacy PbLayout values from page metadata to editor layout ids. */
export function normalizeLayoutId(layout?: string | null): PbLayoutId {
  switch (layout) {
    case 'grid-4':
    case 'grid-6':
    case 'left-full-right-2':
    case 'left-2-right-full':
    case 'stacked-horizontal':
    case 'text-top':
    case 'text-bottom':
    case 'two-vertical':
    case 'three-vertical':
    case 'four-vertical':
    case 'four-horizontal':
    case 'three-horizontal':
    case 'center-inset':
    case 'double-center-inset':
    case 'single':
    case 'blank':
      return layout;
    case 'double':
      return 'two-vertical';
    case 'right-full-left-2':
      return 'left-2-right-full';
    default:
      return 'single';
  }
}
