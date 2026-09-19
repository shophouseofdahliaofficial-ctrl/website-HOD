/** Fabric selection margin in design px (matches FABRIC_SELECT_PAD). */
export const PB_STACK_FABRIC_PAD_PX = 56;

/** Approximate toolbar row above each canvas (px at zoom 1). */
export const PB_PAGE_TOOLBAR_PX = 42;

/** Vertical gap between page blocks in rem (matches .pbCanvasStack gap). */
export const PB_PAGE_STACK_GAP_REM = 2.25;

/** Minimum zoom % allowed in the editor (user zoom + initial fit). */
export const PB_ZOOM_MIN_PERCENT = 10;

export type PbFitZoomInput = {
  workspaceHeight: number;
  workspaceWidth: number;
  pageWidthPx: number;
  pageHeightPx: number;
  /** @deprecated Ignored — initial fit always targets one full page. */
  pageCount?: number;
  /** Extra vertical chrome inside workspace (padding top + bottom). */
  workspacePaddingY?: number;
  /** Extra horizontal chrome inside workspace (padding left + right). */
  workspacePaddingX?: number;
};

/** Block padding scales as padPx * zoom^2 (CSS multiplies pre-scaled pad by --pb-stack-zoom). */
const PB_BLOCK_PAD_QUAD_COEF = PB_STACK_FABRIC_PAD_PX * 2;

/** Stack top + bottom padding in px at zoom 1 (0.25rem + 1rem). */
const PB_STACK_VERTICAL_PAD_PX = (0.25 + 1) * 16;

/** Toolbar row + margin below it at zoom 1. */
const PB_PAGE_TOOLBAR_AND_GAP_PX = PB_PAGE_TOOLBAR_PX + 0.35 * 16;

function solveFitZoomFactor(quadraticCoef: number, linearCoef: number, availablePx: number): number {
  if (availablePx <= 0 || linearCoef <= 0) return 0;
  const discriminant = linearCoef * linearCoef + 4 * quadraticCoef * availablePx;
  if (discriminant <= 0) return 0;
  return (-linearCoef + Math.sqrt(discriminant)) / (2 * quadraticCoef);
}

/**
 * Zoom % so exactly one full page block fits in the workspace (width and height).
 * Never returns above 100 (initial view should not be zoomed in).
 */
export function computePbInitialFitZoomPercent({
  workspaceHeight,
  workspaceWidth,
  pageWidthPx,
  pageHeightPx,
  workspacePaddingY = 52,
  workspacePaddingX = 48,
}: PbFitZoomInput): number {
  const availH = Math.max(160, workspaceHeight - workspacePaddingY);
  const availW = Math.max(160, workspaceWidth - workspacePaddingX);

  const heightLinear = PB_STACK_VERTICAL_PAD_PX + PB_PAGE_TOOLBAR_AND_GAP_PX + pageHeightPx;
  const widthLinear = pageWidthPx;

  const zoomByH = solveFitZoomFactor(PB_BLOCK_PAD_QUAD_COEF, heightLinear, availH);
  const zoomByW = solveFitZoomFactor(PB_BLOCK_PAD_QUAD_COEF, widthLinear, availW);

  const fit = Math.min(zoomByH, zoomByW, 1);
  if (fit <= 0) return PB_ZOOM_MIN_PERCENT;
  return Math.round(fit * 1000) / 10;
}

export type PbRefineFitZoomInput = {
  zoomPercent: number;
  blockHeight: number;
  blockWidth: number;
  workspaceHeight: number;
  workspaceWidth: number;
  workspacePaddingY?: number;
  workspacePaddingX?: number;
  /** Safety margin so the page does not clip at workspace edges. */
  margin?: number;
};

/** Tighten analytic fit using measured page-block size after first layout pass. */
export function refinePbFitZoomFromBlockMeasure({
  zoomPercent,
  blockHeight,
  blockWidth,
  workspaceHeight,
  workspaceWidth,
  workspacePaddingY = 52,
  workspacePaddingX = 48,
  margin = 0.97,
}: PbRefineFitZoomInput): number {
  if (blockHeight <= 0 || blockWidth <= 0 || zoomPercent <= 0) return zoomPercent;

  const availH = Math.max(160, workspaceHeight - workspacePaddingY);
  const availW = Math.max(160, workspaceWidth - workspacePaddingX);

  const refined = Math.min(
    (availW / blockWidth) * zoomPercent,
    (availH / blockHeight) * zoomPercent,
    100,
  ) * margin;

  return Math.round(refined * 10) / 10;
}
