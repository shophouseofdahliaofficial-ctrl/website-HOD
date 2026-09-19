/**
 * Runtime probe via Fabric node build + real app lock/rebake modules.
 * Run: npx tsx scripts/pb-rebake-trace-probe.mts
 */
import { Canvas, IText } from '../node_modules/fabric/dist/index.node.cjs';
import { applyLockToObject } from '../components/photobook/canvas/interaction';
import {
  clearRebakeTrace,
  reportRebakeTrace,
  type PbRebakeTraceReport,
} from '../components/photobook/canvas/pbRebakeTrace';
import {
  configureNewTextObject,
  refreshTextObjectGeometry,
} from '../components/photobook/canvas/textLayout';
import { getTextPreset } from '../components/photobook/canvas/textPresets';
import { PB_PAGE_SIZE_PX } from '../components/photobook/canvas/constants';

globalThis.__PB_REBAKE_TRACE__ = true;
clearRebakeTrace();

type Obj = InstanceType<typeof IText>;

function objectState(obj: Obj, label: string) {
  const bound = obj.getBoundingRect();
  return {
    label,
    left: obj.left,
    top: obj.top,
    width: obj.width,
    height: obj.height,
    scaleX: obj.scaleX,
    scaleY: obj.scaleY,
    objectCaching: obj.objectCaching,
    dirty: obj.dirty,
    isEditing: obj.isEditing ?? false,
    clipPath: !!obj.clipPath,
    cacheCanvasW: obj._cacheCanvas?.width ?? null,
    cacheCanvasH: obj._cacheCanvas?.height ?? null,
    boundW: Math.round(bound.width * 1000) / 1000,
    boundH: Math.round(bound.height * 1000) / 1000,
  };
}

function diffStates(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, { broken: unknown; fixed: unknown }> {
  const out: Record<string, { broken: unknown; fixed: unknown }> = {};
  for (const k of Object.keys(a)) {
    if (k === 'label') continue;
    if (a[k] !== b[k]) out[k] = { broken: a[k], fixed: b[k] };
  }
  return out;
}

const size = PB_PAGE_SIZE_PX;
const canvas = new Canvas({ width: size, height: size }, { width: size, height: size });
const center = { x: size / 2, y: size / 2 };
const preset = getTextPreset('heading');

const text = new IText(preset.defaultText, {
  left: center.x,
  top: center.y,
  originX: 'center',
  originY: 'center',
  objectCaching: false,
  lineHeight: 1.08,
  pbKind: 'text',
  pbTextPreset: 'heading',
  fontFamily: preset.style.fontFamily,
  fontSize: preset.style.fontSize,
  fill: preset.style.fill,
  fontWeight: preset.style.bold ? 'bold' : 'normal',
}) as Obj;

configureNewTextObject(text);
canvas.add(text);
canvas.setActiveObject(text);
text.enterEditing();
text.selectAll();
canvas.renderAll();

applyLockToObject(text, true, canvas);
applyLockToObject(text, false, canvas);

const broken = objectState(text, 'broken-after-unlock-no-move');

const report: PbRebakeTraceReport = reportRebakeTrace();

text.set({ left: (text.left ?? 0) + 1 });
text.setCoords();
refreshTextObjectGeometry(text);
canvas.requestRenderAll();
canvas.renderAll();

const fixed = objectState(text, 'fixed-after-move');
const firstDiff = diffStates(broken, fixed);

const summary = {
  executed: report.executed,
  notExecuted: report.notExecuted,
  lockCycles: report.lockCycles,
  renderAllRan: report.renderAllRan,
  renderAllCallCount: report.renderAllCallCount,
  broken,
  fixed,
  firstDiff,
};

console.log('\n========== PB REBAKE PROBE RESULT ==========\n');
console.log(JSON.stringify(summary, null, 2));

canvas.dispose();
