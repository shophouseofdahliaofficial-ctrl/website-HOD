/**
 * DOM overlay / clipping investigation for ProductDetailsModal photobook canvas.
 *
 * In DevTools (with editor open, bug visible):
 *   globalThis.__PB_DOM_DIAG__?.()
 *   globalThis.__PB_ISOLATE_CANVAS__?.('lower-only')
 *   globalThis.__PB_RESTORE_CANVAS_LAYERS__?.()
 */

export type PbDomRectSnapshot = {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

export type PbDomLayerSnapshot = {
  label: string;
  selector: string;
  found: boolean;
  tag: string;
  className: string;
  id: string;
  rect: PbDomRectSnapshot | null;
  position: string;
  overflow: string;
  overflowX: string;
  overflowY: string;
  clipPath: string;
  mask: string;
  webkitMask: string;
  pointerEvents: string;
  zIndex: string;
  opacity: string;
  visibility: string;
  display: string;
  transform: string;
  isolation: string;
  mixBlendMode: string;
};

export type PbDomElementInventoryItem = {
  depth: number;
  tag: string;
  className: string;
  id: string;
  position: string;
  zIndex: string;
  overflow: string;
  clipPath: string;
  pointerEvents: string;
  rect: PbDomRectSnapshot;
};

export type PbDomDiagnosticsReport = {
  zoomHostLabel: string;
  zoomHostClass: string;
  childCount: number;
  absoluteElements: PbDomElementInventoryItem[];
  clippedOrMaskedElements: PbDomElementInventoryItem[];
  keyLayers: PbDomLayerSnapshot[];
  fabricTextareas: Array<{
    rect: PbDomRectSnapshot;
    value: string;
    display: string;
    parent: string;
  }>;
  canvasElements: Array<{
    role: string;
    className: string;
    rect: PbDomRectSnapshot;
    attrW: number;
    attrH: number;
    display: string;
    opacity: string;
  }>;
};

type IsolationState = {
  entries: Array<{ el: HTMLElement; prev: string }>;
};

const isolationByHost = new WeakMap<HTMLElement, IsolationState>();

function rectSnapshot(el: Element | null | undefined): PbDomRectSnapshot | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: Math.round(r.x * 10) / 10,
    y: Math.round(r.y * 10) / 10,
    width: Math.round(r.width * 10) / 10,
    height: Math.round(r.height * 10) / 10,
    right: Math.round(r.right * 10) / 10,
    bottom: Math.round(r.bottom * 10) / 10,
  };
}

function layerSnapshot(el: Element | null, label: string, selector: string): PbDomLayerSnapshot {
  if (!el || !(el instanceof HTMLElement)) {
    return {
      label,
      selector,
      found: false,
      tag: '',
      className: '',
      id: '',
      rect: null,
      position: '',
      overflow: '',
      overflowX: '',
      overflowY: '',
      clipPath: '',
      mask: '',
      webkitMask: '',
      pointerEvents: '',
      zIndex: '',
      opacity: '',
      visibility: '',
      display: '',
      transform: '',
      isolation: '',
      mixBlendMode: '',
    };
  }
  const cs = getComputedStyle(el);
  return {
    label,
    selector,
    found: true,
    tag: el.tagName,
    className: el.className,
    id: el.id,
    rect: rectSnapshot(el),
    position: cs.position,
    overflow: cs.overflow,
    overflowX: cs.overflowX,
    overflowY: cs.overflowY,
    clipPath: cs.clipPath,
    mask: cs.mask,
    webkitMask: cs.webkitMask || (cs as CSSStyleDeclaration & { webkitMask?: string }).webkitMask || '',
    pointerEvents: cs.pointerEvents,
    zIndex: cs.zIndex,
    opacity: cs.opacity,
    visibility: cs.visibility,
    display: cs.display,
    transform: cs.transform,
    isolation: cs.isolation,
    mixBlendMode: cs.mixBlendMode,
  };
}

function shortClass(el: Element): string {
  const c = el.className;
  if (typeof c !== 'string' || !c) return el.tagName.toLowerCase();
  return c.split(/\s+/).slice(0, 3).join('.');
}

function inventoryElement(el: HTMLElement, depth: number): PbDomElementInventoryItem {
  const cs = getComputedStyle(el);
  return {
    depth,
    tag: el.tagName,
    className: el.className,
    id: el.id,
    position: cs.position,
    zIndex: cs.zIndex,
    overflow: cs.overflow,
    clipPath: cs.clipPath !== 'none' ? cs.clipPath : '',
    pointerEvents: cs.pointerEvents,
    rect: rectSnapshot(el)!,
  };
}

function walkTree(root: HTMLElement, depth = 0, out: PbDomElementInventoryItem[] = []) {
  out.push(inventoryElement(root, depth));
  for (const child of Array.from(root.children)) {
    if (child instanceof HTMLElement) walkTree(child, depth + 1, out);
  }
  return out;
}

export function resolveActivePbCanvasZoomHost(): HTMLElement | null {
  const hosts = Array.from(
    document.querySelectorAll<HTMLElement>('[aria-label^="Canvas area for"]'),
  );
  if (!hosts.length) return null;
  const activeBlock = document.querySelector<HTMLElement>('[class*="pbCanvasPageBlockActive"]');
  if (activeBlock) {
    const inBlock = activeBlock.querySelector<HTMLElement>('[aria-label^="Canvas area for"]');
    if (inBlock) return inBlock;
  }
  return hosts[0];
}

export function scanPbCanvasZoomHost(zoomHost?: HTMLElement | null): PbDomDiagnosticsReport {
  const host = zoomHost ?? resolveActivePbCanvasZoomHost();
  if (!host) {
    throw new Error('No pbCanvasPageZoomHost found (aria-label^="Canvas area for")');
  }

  const all = walkTree(host);
  const absoluteElements = all.filter((e) => e.position === 'absolute' || e.position === 'fixed');
  const clippedOrMaskedElements = all.filter(
    (e) =>
      (e.overflow && e.overflow !== 'visible') ||
      (e.clipPath && e.clipPath !== 'none'),
  );

  const q = (sel: string) => host.querySelector(sel);

  const keyLayers: PbDomLayerSnapshot[] = [
    layerSnapshot(host, 'pbCanvasPageZoomHost', '[aria-label^="Canvas area for"]'),
    layerSnapshot(q('[class*="pbCanvasZoomSurface"]'), 'pbCanvasZoomSurface', '.pbCanvasZoomSurface'),
    layerSnapshot(q('[class*="pbFabricCanvasHost"]'), 'pbFabricCanvasHost', '.pbFabricCanvasHost'),
    layerSnapshot(q('.canvas-container'), 'canvas-container', '.canvas-container'),
    layerSnapshot(q('.lower-canvas'), 'lower-canvas', '.lower-canvas'),
    layerSnapshot(q('.upper-canvas'), 'upper-canvas', '.upper-canvas'),
    layerSnapshot(q('[class*="pbFabricObjectToolbar"]'), 'lock/toolbar overlay', '.pbFabricObjectToolbar'),
    layerSnapshot(q('[class*="pbFabricRotateHint"]'), 'rotate hint', '.pbFabricRotateHint'),
    layerSnapshot(q('[class*="photobookBleedLine"]'), 'bleed line', '.photobookBleedLine'),
    layerSnapshot(q('[class*="photobookCanvasPage"]'), 'photobookCanvasPage shell', '.photobookCanvasPage'),
    layerSnapshot(q('[class*="pbCanvasInnerContainer"]'), 'pbCanvasInnerContainer', '.pbCanvasInnerContainer'),
  ];

  const fabricTextareas = Array.from(
    document.querySelectorAll<HTMLTextAreaElement>('textarea[data-fabric="textarea"]'),
  ).map((ta) => ({
    rect: rectSnapshot(ta)!,
    value: ta.value.slice(0, 40),
    display: getComputedStyle(ta).display,
    parent: shortClass(ta.parentElement ?? ta),
  }));

  const canvasElements = Array.from(host.querySelectorAll('canvas')).map((c, i) => {
    const role = c.classList.contains('upper-canvas')
      ? 'upper-canvas'
      : c.classList.contains('lower-canvas')
        ? 'lower-canvas'
        : `canvas-${i}`;
    const cs = getComputedStyle(c);
    return {
      role,
      className: c.className,
      rect: rectSnapshot(c)!,
      attrW: c.width,
      attrH: c.height,
      display: cs.display,
      opacity: cs.opacity,
    };
  });

  return {
    zoomHostLabel: host.getAttribute('aria-label') ?? '',
    zoomHostClass: host.className,
    childCount: host.querySelectorAll('*').length,
    absoluteElements,
    clippedOrMaskedElements,
    keyLayers,
    fabricTextareas,
    canvasElements,
  };
}

function pushHide(el: HTMLElement | null, state: IsolationState, reason: string) {
  if (!el) return;
  state.entries.push({
    el,
    prev: el.getAttribute('data-pb-isolate-prev') ?? '',
  });
  el.setAttribute('data-pb-isolate-prev', el.style.cssText);
  el.setAttribute('data-pb-isolate-reason', reason);
  el.style.setProperty('visibility', 'hidden', 'important');
  el.style.setProperty('pointer-events', 'none', 'important');
}

export type PbCanvasIsolationMode =
  | 'lower-only'
  | 'hide-upper'
  | 'hide-toolbar'
  | 'hide-all-overlays'
  | 'hide-host-overflow-clip';

/**
 * Temporarily hide DOM layers to find clipping source.
 * - `lower-only`: hide upper-canvas, toolbar, rotate hint, fabric textareas
 * - `hide-upper`: upper-canvas only
 * - `hide-toolbar`: floating toolbar + rotate hint
 * - `hide-all-overlays`: all non-lower canvas layers inside zoom host
 * - `hide-host-overflow-clip`: set zoom host overflow visible (tests overflow:hidden clip)
 */
export function isolatePbCanvasLayers(
  mode: PbCanvasIsolationMode = 'lower-only',
  zoomHost?: HTMLElement | null,
): { mode: PbCanvasIsolationMode; hidden: string[] } {
  const host = zoomHost ?? resolveActivePbCanvasZoomHost();
  if (!host) throw new Error('No zoom host found');

  restorePbCanvasLayers(host);

  const state: IsolationState = { entries: [] };
  const hidden: string[] = [];

  const upper = host.querySelector<HTMLElement>('.upper-canvas');
  const toolbar = host.querySelector<HTMLElement>('[class*="pbFabricObjectToolbar"]');
  const rotate = host.querySelector<HTMLElement>('[class*="pbFabricRotateHint"]');
  const bleed = host.querySelector<HTMLElement>('[class*="photobookBleedLine"]');
  const pageShell = host.querySelector<HTMLElement>('[class*="photobookCanvasPage"]');
  const inner = host.querySelector<HTMLElement>('[class*="pbCanvasInnerContainer"]');

  const hideUpper = () => {
    pushHide(upper, state, 'upper-canvas');
    hidden.push('upper-canvas');
  };
  const hideToolbar = () => {
    pushHide(toolbar, state, 'toolbar');
    pushHide(rotate, state, 'rotate-hint');
    hidden.push('pbFabricObjectToolbar', 'pbFabricRotateHint');
  };
  const hideTextareas = () => {
    document.querySelectorAll<HTMLTextAreaElement>('textarea[data-fabric="textarea"]').forEach((ta) => {
      pushHide(ta, state, 'fabric-textarea');
      hidden.push(`textarea:${ta.value.slice(0, 12)}`);
    });
  };
  const hideShell = () => {
    pushHide(bleed, state, 'bleed');
    pushHide(pageShell, state, 'page-shell');
    pushHide(inner, state, 'inner-container');
    hidden.push('photobookBleedLine', 'photobookCanvasPage', 'pbCanvasInnerContainer');
  };

  if (mode === 'lower-only' || mode === 'hide-all-overlays') {
    hideUpper();
    hideToolbar();
    hideTextareas();
    if (mode === 'hide-all-overlays') hideShell();
  } else if (mode === 'hide-upper') {
    if (upper) {
      upper.setAttribute('data-pb-isolate-prev', upper.style.cssText);
      upper.style.setProperty('display', 'none', 'important');
      hidden.push('upper-canvas (display:none)');
    }
  } else if (mode === 'hide-toolbar') {
    hideToolbar();
  } else if (mode === 'hide-host-overflow-clip') {
    state.entries.push({
      el: host,
      prev: host.getAttribute('data-pb-isolate-prev') ?? '',
    });
    host.setAttribute('data-pb-isolate-prev', host.style.cssText);
    host.style.setProperty('overflow', 'visible', 'important');
    hidden.push('pbCanvasPageZoomHost overflow→visible');
  }

  isolationByHost.set(host, state);
  console.log(`[pb-dom] isolated (${mode}):`, hidden);
  return { mode, hidden };
}

export function restorePbCanvasLayers(zoomHost?: HTMLElement | null) {
  const host = zoomHost ?? resolveActivePbCanvasZoomHost();
  if (!host) return;
  const state = isolationByHost.get(host);
  if (!state) {
    host.querySelectorAll<HTMLElement>('[data-pb-isolate-prev]').forEach((el) => {
      const prev = el.getAttribute('data-pb-isolate-prev') ?? '';
      el.style.cssText = prev;
      el.removeAttribute('data-pb-isolate-prev');
      el.removeAttribute('data-pb-isolate-reason');
    });
    document.querySelectorAll<HTMLElement>('textarea[data-fabric="textarea"][data-pb-isolate-prev]').forEach((el) => {
      const prev = el.getAttribute('data-pb-isolate-prev') ?? '';
      el.style.cssText = prev;
      el.removeAttribute('data-pb-isolate-prev');
      el.removeAttribute('data-pb-isolate-reason');
    });
    return;
  }
  for (const { el, prev } of state.entries) {
    el.style.cssText = prev;
    el.removeAttribute('data-pb-isolate-prev');
    el.removeAttribute('data-pb-isolate-reason');
  }
  isolationByHost.delete(host);
  console.log('[pb-dom] restored layers');
}

export function logPbCanvasDomDiagnostics(zoomHost?: HTMLElement | null) {
  const report = scanPbCanvasZoomHost(zoomHost);

  console.group(`[pb-dom] ${report.zoomHostLabel}`);
  console.log('Host class:', report.zoomHostClass);
  console.log(`Descendants: ${report.childCount}`);

  console.group('Key layer rects + styles');
  console.table(
    report.keyLayers.map((l) => ({
      layer: l.label,
      found: l.found,
      w: l.rect?.width,
      h: l.rect?.height,
      x: l.rect?.x,
      y: l.rect?.y,
      position: l.position,
      overflow: l.overflow,
      clipPath: l.clipPath || '-',
      mask: l.mask || '-',
      zIndex: l.zIndex,
      pointerEvents: l.pointerEvents,
      opacity: l.opacity,
      display: l.display,
    })),
  );
  console.groupEnd();

  console.group('All <canvas> in zoom host');
  console.table(report.canvasElements);
  console.groupEnd();

  console.group(`Absolutely positioned (${report.absoluteElements.length})`);
  console.table(
    report.absoluteElements.map((e) => ({
      depth: e.depth,
      el: `${e.tag}.${e.className.split(' ')[0] || ''}`,
      w: e.rect.width,
      h: e.rect.height,
      x: e.rect.x,
      y: e.rect.y,
      zIndex: e.zIndex,
      overflow: e.overflow,
      pointerEvents: e.pointerEvents,
    })),
  );
  console.groupEnd();

  console.group(`overflow≠visible or clip-path (${report.clippedOrMaskedElements.length})`);
  console.table(
    report.clippedOrMaskedElements.map((e) => ({
      depth: e.depth,
      el: `${e.tag}.${e.className.split(' ')[0] || ''}`,
      overflow: e.overflow,
      clipPath: e.clipPath || '-',
      w: e.rect.width,
      h: e.rect.height,
      x: e.rect.x,
      y: e.rect.y,
    })),
  );
  console.groupEnd();

  if (report.fabricTextareas.length) {
    console.group('Fabric hidden textareas (document-wide)');
    console.table(report.fabricTextareas);
    console.groupEnd();
  }

  console.groupEnd();
  return report;
}

declare global {
  // eslint-disable-next-line no-var
  var __PB_DOM_DIAG__: typeof logPbCanvasDomDiagnostics | undefined;
  // eslint-disable-next-line no-var
  var __PB_ISOLATE_CANVAS__: typeof isolatePbCanvasLayers | undefined;
  // eslint-disable-next-line no-var
  var __PB_RESTORE_CANVAS_LAYERS__: typeof restorePbCanvasLayers | undefined;
  // eslint-disable-next-line no-var
  var __PB_SCAN_CANVAS_DOM__: typeof scanPbCanvasZoomHost | undefined;
}

export function installPbCanvasDomDiagnosticsGlobals() {
  if (typeof globalThis === 'undefined') return;
  globalThis.__PB_DOM_DIAG__ = logPbCanvasDomDiagnostics;
  globalThis.__PB_ISOLATE_CANVAS__ = isolatePbCanvasLayers;
  globalThis.__PB_RESTORE_CANVAS_LAYERS__ = restorePbCanvasLayers;
  globalThis.__PB_SCAN_CANVAS_DOM__ = scanPbCanvasZoomHost;
}

export { logPbCanvasLayerAlignment } from './pbCanvasLayerAlignment';

installPbCanvasDomDiagnosticsGlobals();
