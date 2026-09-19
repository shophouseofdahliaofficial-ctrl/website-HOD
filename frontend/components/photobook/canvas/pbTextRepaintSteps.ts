/**
 * Manual repaint tests while lock clip bug is visible (active canvas text = index 1).
 * Not a probe — run one step, check visually, then the next.
 */
import { resolveActivePbFabricCanvas } from './pbFabricCanvasRegistry';
import { isTextObject } from './textStyle';

function textObject(canvas = resolveActivePbFabricCanvas()) {
  if (!canvas) throw new Error('No active Fabric canvas');
  const obj = canvas.getObjects()[1];
  if (!obj || !isTextObject(obj)) throw new Error('getObjects()[1] is not i-text');
  return { canvas, text: obj };
}

export function pbRepaintStep1() {
  const { canvas } = textObject();
  canvas.renderAll();
  console.log('[pb-repaint-step] 1: canvas.renderAll()');
}

export function pbRepaintStep2() {
  const { canvas, text } = textObject();
  text.setCoords();
  canvas.renderAll();
  console.log('[pb-repaint-step] 2: text.setCoords() + renderAll()');
}

export function pbRepaintStep3() {
  const { canvas, text } = textObject();
  text.dirty = true;
  canvas.renderAll();
  console.log('[pb-repaint-step] 3: text.dirty=true + renderAll()');
}

export function pbRepaintStep4() {
  const { canvas, text } = textObject();
  const t = text as { initDimensions?: () => void };
  t.initDimensions?.();
  canvas.renderAll();
  console.log('[pb-repaint-step] 4: initDimensions() + renderAll()');
}

declare global {
  // eslint-disable-next-line no-var
  var __PB_REPAINT_STEP_1__: typeof pbRepaintStep1 | undefined;
  // eslint-disable-next-line no-var
  var __PB_REPAINT_STEP_2__: typeof pbRepaintStep2 | undefined;
  // eslint-disable-next-line no-var
  var __PB_REPAINT_STEP_3__: typeof pbRepaintStep3 | undefined;
  // eslint-disable-next-line no-var
  var __PB_REPAINT_STEP_4__: typeof pbRepaintStep4 | undefined;
}

if (typeof globalThis !== 'undefined') {
  globalThis.__PB_REPAINT_STEP_1__ = pbRepaintStep1;
  globalThis.__PB_REPAINT_STEP_2__ = pbRepaintStep2;
  globalThis.__PB_REPAINT_STEP_3__ = pbRepaintStep3;
  globalThis.__PB_REPAINT_STEP_4__ = pbRepaintStep4;
}
