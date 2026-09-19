import type { Canvas, FabricObject } from './types';
import { readPbStackZoomFromCanvas, zoomControlUnits } from './controls';
import { isFrameEmptyHint, isImageFrame, type PbTaggedObject } from './frameMeta';

function getImageFramesOnCanvas(canvas: Canvas): FabricObject[] {
  return canvas.getObjects().filter(isImageFrame);
}

const FRAME_EMPTY_HINT_STROKE = '#808080';
const FRAME_EMPTY_ICON_VIEWBOX = 48;
const FRAME_EMPTY_ICON_SCREEN_PX = 44;
const FRAME_EMPTY_LABEL_SCREEN_PX = 11;
const FRAME_EMPTY_TEXT_GAP_SCREEN_PX = 8;
const FRAME_EMPTY_STROKE_SCREEN_PX = 1.2;

const FRAME_EMPTY_ICON_PATHS = [
  'M29.4995,12.3739c.7719-.0965,1.5437,.4824,1.5437,1.2543h0l2.5085,23.8312c.0965,.7719-.4824,1.5437-1.2543,1.5437l-23.7347,2.5085c-.7719,.0965-1.5437-.4824-1.5437-1.2543h0l-2.5085-23.7347c-.0965-.7719,.4824-1.5437,1.2543-1.5437l23.7347-2.605Z',
  'M12.9045,18.9347c-1.7367,.193-3.0874,1.7367-2.8945,3.5699,.193,1.7367,1.7367,3.0874,3.5699,2.8945,1.7367-.193,3.0874-1.7367,2.8945-3.5699s-1.8332-3.0874-3.5699-2.8945h0Zm8.7799,5.596l-4.6312,5.6925c-.193,.193-.4824,.2894-.6754,.0965h0l-1.0613-.8683c-.193-.193-.5789-.0965-.6754,.0965l-5.0171,6.1749c-.193,.193-.193,.5789,.0965,.6754-.0965,.0965,.0965,.0965,.193,.0965l19.9719-2.1226c.2894,0,.4824-.2894,.4824-.5789,0-.0965-.0965-.193-.0965-.2894l-7.8151-9.0694c-.2894-.0965-.5789-.0965-.7719,.0965h0Z',
  'M16.2814,13.8211l.6754-6.0784c.0965-.7719,.7719-1.3508,1.5437-1.2543l23.7347,2.5085c.7719,.0965,1.3508,.7719,1.2543,1.5437h0l-2.5085,23.7347c0,.6754-.7719,1.2543-1.5437,1.2543l-6.1749-.6754',
  'M32.7799,29.9337l5.3065,.5789c.2894,0,.4824-.193,.5789-.4824,0-.0965,0-.193-.0965-.2894l-5.789-10.5166c-.0965-.193-.4824-.2894-.6754-.193h0l-.3859,.3859',
] as const;

const FRAME_EMPTY_LABEL_LINE_1 = 'Drag and drop';
const FRAME_EMPTY_LABEL_LINE_2 = 'your images';

type FrameWithEmptyHint = FabricObject & {
  width?: number;
  height?: number;
  canvas?: Canvas | null;
  _pbEmptyHintRenderAttached?: boolean;
  pbEmptyHintVisible?: boolean;
};

export function drawFrameEmptyHint(
  ctx: CanvasRenderingContext2D,
  frameWidth: number,
  frameHeight: number,
  domZoom: number,
) {
  const iconSize = Math.min(
    zoomControlUnits(FRAME_EMPTY_ICON_SCREEN_PX, domZoom),
    frameWidth * 0.42,
    frameHeight * 0.34,
  );
  const fontSize = Math.min(
    zoomControlUnits(FRAME_EMPTY_LABEL_SCREEN_PX, domZoom),
    frameHeight * 0.09,
  );
  const textGap = zoomControlUnits(FRAME_EMPTY_TEXT_GAP_SCREEN_PX, domZoom);
  const textLineHeight = fontSize * 1.2;
  const textBlockHeight = textLineHeight * 2;
  const blockHeight = iconSize + textGap + textBlockHeight;
  // Fabric Rect _render uses center-origin local coords (-w/2 … w/2).
  const blockTop = -blockHeight / 2;
  const iconScale = iconSize / FRAME_EMPTY_ICON_VIEWBOX;
  const strokeWidth = zoomControlUnits(FRAME_EMPTY_STROKE_SCREEN_PX, domZoom) / iconScale;

  ctx.save();
  ctx.translate(0, blockTop + iconSize / 2);
  ctx.scale(iconScale, iconScale);
  ctx.translate(-FRAME_EMPTY_ICON_VIEWBOX / 2, -FRAME_EMPTY_ICON_VIEWBOX / 2);
  ctx.strokeStyle = FRAME_EMPTY_HINT_STROKE;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of FRAME_EMPTY_ICON_PATHS) {
    ctx.stroke(new Path2D(d));
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = FRAME_EMPTY_HINT_STROKE;
  ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const textTop = blockTop + iconSize + textGap;
  ctx.fillText(FRAME_EMPTY_LABEL_LINE_1, 0, textTop);
  ctx.fillText(FRAME_EMPTY_LABEL_LINE_2, 0, textTop + textLineHeight);
  ctx.restore();
}

export function attachFrameEmptyHintRender(frame: FabricObject) {
  const tagged = frame as FrameWithEmptyHint;
  if (tagged._pbEmptyHintRenderAttached) return;
  tagged._pbEmptyHintRenderAttached = true;

  const originalRender = frame._render.bind(frame);
  frame._render = function renderFrameWithEmptyHint(this: FrameWithEmptyHint, ctx: CanvasRenderingContext2D) {
    originalRender(ctx);
    if ((this as PbTaggedObject).pbFrameFilled) return;
    if (this.pbEmptyHintVisible === false) return;
    const w = this.width ?? 0;
    const h = this.height ?? 0;
    if (w < 24 || h < 24) return;
    const domZoom = readPbStackZoomFromCanvas(this.canvas);
    drawFrameEmptyHint(ctx, w, h, domZoom);
  };
}

export function removeLegacyFrameEmptyHints(canvas: Canvas) {
  canvas.getObjects().filter(isFrameEmptyHint).forEach((hint) => canvas.remove(hint));
}

export function ensureFrameEmptyHintRender(canvas: Canvas) {
  removeLegacyFrameEmptyHints(canvas);
  getImageFramesOnCanvas(canvas).forEach(attachFrameEmptyHintRender);
}

export function setFrameEmptyHintsVisible(canvas: Canvas, visible: boolean) {
  getImageFramesOnCanvas(canvas).forEach((frame) => {
    if ((frame as PbTaggedObject).pbFrameFilled) return;
    (frame as FrameWithEmptyHint).pbEmptyHintVisible = visible;
    frame.dirty = true;
  });
  canvas.requestRenderAll();
}

export function setFrameEmptyHintVisible(frame: FabricObject, visible: boolean) {
  (frame as FrameWithEmptyHint).pbEmptyHintVisible = visible;
  frame.dirty = true;
}

export function restoreAllEmptyFrameHints(canvas: Canvas) {
  getImageFramesOnCanvas(canvas).forEach((frame) => {
    if ((frame as PbTaggedObject).pbFrameFilled) return;
    setFrameEmptyHintVisible(frame, true);
  });
}
