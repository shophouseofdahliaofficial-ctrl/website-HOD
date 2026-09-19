/**
 * Lock/unlock text repaint: rebake (initDimensions + cache clear + renderAll)
 * should match object:modified after drag — no move required.
 */
import { Canvas, IText } from '../node_modules/fabric/dist/index.node.cjs';

function probe(label, text) {
  const b = text.getBoundingRect();
  console.log(
    JSON.stringify({
      label,
      width: text.width,
      height: text.height,
      textBoundsW: Math.round(b.width * 100) / 100,
      textBoundsH: Math.round(b.height * 100) / 100,
      objectCaching: text.objectCaching,
      cacheCanvasW: text._cacheCanvas?.width ?? null,
      cacheCanvasH: text._cacheCanvas?.height ?? null,
      dirty: text.dirty,
    }),
  );
}

function rebake(text, canvas) {
  text.objectCaching = false;
  text._removeCacheCanvas?.();
  text._clearCache?.();
  text.lineHeight = 1.08;
  text.initDimensions?.();
  text.setCoords();
  text.dirty = true;
  canvas.requestRenderAll();
  canvas.renderAll();
}

const canvas = new Canvas({ width: 380, height: 380 }, { width: 380, height: 380 });
const text = new IText('Heading', {
  left: 190,
  top: 190,
  originX: 'center',
  originY: 'center',
  fontSize: 42,
  fontWeight: 'bold',
  objectCaching: true,
});
canvas.add(text);
text.enterEditing();
canvas.renderAll();
probe('editing', text);

text.exitEditing();
text.lockMovementX = true;
text.lockMovementY = true;
text.hasBorders = false;
text.editable = false;
rebake(text, canvas);
probe('locked-rebaked', text);

text.lockMovementX = false;
text.lockMovementY = false;
text.editable = true;
rebake(text, canvas);
probe('unlocked-rebaked-no-move', text);

canvas.dispose();
