import type { FabricModule, FabricObject } from './types';
import { PB_PAGE_SIZE_PX, PB_CHROME_KINDS } from './constants';
import { isFrameAdjustGhost } from './frameMeta';

export type PbPageDimensions = {
  widthPx: number;
  heightPx: number;
};

export function isChromeObject(obj: FabricObject): boolean {
  const kind = (obj as FabricObject & { pbKind?: string }).pbKind;
  return !!kind && PB_CHROME_KINDS.has(kind);
}

export function createPageBackground(
  fabric: FabricModule,
  fill: string,
  pad: number,
  page: PbPageDimensions = { widthPx: PB_PAGE_SIZE_PX, heightPx: PB_PAGE_SIZE_PX },
): FabricObject {
  return new fabric.Rect({
    left: pad,
    top: pad,
    width: page.widthPx,
    height: page.heightPx,
    fill,
    selectable: false,
    evented: false,
    hasControls: false,
    objectCaching: false,
    originX: 'left',
    originY: 'top',
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    pbKind: 'page-bg',
  });
}

/** Reset transforms that would shrink or offset the painted fill vs design page bounds. */
export function normalizePageBackgroundGeometry(bg: FabricObject) {
  bg.set({
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    skewX: 0,
    skewY: 0,
    flipX: false,
    flipY: false,
    originX: 'left',
    originY: 'top',
    clipPath: undefined,
    objectCaching: false,
  });
  bg.setCoords();
}

export function syncPageChrome(
  canvas: import('./types').Canvas,
  fabric: FabricModule,
  pageBackgroundColor: string,
  pad: number,
  page: PbPageDimensions = { widthPx: PB_PAGE_SIZE_PX, heightPx: PB_PAGE_SIZE_PX },
) {
  let bg = canvas.getObjects().find((o) => (o as FabricObject & { pbKind?: string }).pbKind === 'page-bg');
  if (!bg) {
    bg = createPageBackground(fabric, pageBackgroundColor, pad, page);
    canvas.add(bg);
  } else {
    bg.set({
      left: pad,
      top: pad,
      width: page.widthPx,
      height: page.heightPx,
      fill: pageBackgroundColor,
    });
    normalizePageBackgroundGeometry(bg);
  }

  // During in-frame adjust the ghost must extend past the page clip; keep canvas unclipped.
  const frameAdjustActive = canvas.getObjects().some(isFrameAdjustGhost);
  if (!frameAdjustActive) {
    if (pad > 0) {
      canvas.clipPath = new fabric.Rect({
        left: pad,
        top: pad,
        width: page.widthPx,
        height: page.heightPx,
        originX: 'left',
        originY: 'top',
        absolutePositioned: true,
      });
    } else {
      canvas.clipPath = undefined;
    }
  }

  // Remove legacy chrome overlays from older saves (never user content).
  const legacyChrome = new Set(['bleed-guide', 'center-guide', 'align-guide', 'page-center-guide']);
  canvas.getObjects().forEach((obj) => {
    const kind = (obj as FabricObject & { pbKind?: string }).pbKind;
    if (kind && legacyChrome.has(kind)) {
      canvas.remove(obj);
    }
  });

  sendPageBackgroundToBack(canvas, bg!);
}

/** page-bg must stay behind all user content (Fabric paints higher index on top). */
export function sendPageBackgroundToBack(
  canvas: import('./types').Canvas,
  bg?: FabricObject | null,
) {
  const target =
    bg ??
    canvas.getObjects().find((o) => (o as FabricObject & { pbKind?: string }).pbKind === 'page-bg');
  if (target) canvas.sendObjectToBack(target);
}
