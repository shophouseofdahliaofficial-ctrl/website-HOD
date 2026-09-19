import type { Canvas } from './types';

export type PbFabricCanvasInstanceRow = {
  pageId: string;
  objectCount: number;
  objectTypes: string;
  objectSummary: string;
  isActivePage: boolean;
  isProbeTarget: boolean;
  domHostLabel: string;
  lowerCanvasInDom: boolean;
};

const registry = new Map<string, Canvas>();

function readActivePageIdFromDom(): string | null {
  if (typeof document === 'undefined') return null;
  const activeBlock = document.querySelector<HTMLElement>('[class*="pbCanvasPageBlockActive"]');
  if (!activeBlock) return null;
  const host = activeBlock.querySelector<HTMLElement>('[data-pb-page-id]');
  return host?.getAttribute('data-pb-page-id') ?? null;
}

function domHostLabelForPage(pageId: string): string {
  if (typeof document === 'undefined') return '';
  const host = document.querySelector<HTMLElement>(`[data-pb-page-id="${pageId}"]`);
  return host?.getAttribute('aria-label') ?? '';
}

function lowerCanvasInDomForCanvas(canvas: Canvas): boolean {
  const el = canvas.lowerCanvasEl;
  return !!el && document.body.contains(el);
}

function summarizeObjects(canvas: Canvas): { count: number; types: string; summary: string } {
  const objects = canvas.getObjects();
  const types = objects.map((o) => String(o.type ?? '?')).join(', ');
  const summary = objects
    .map((o, i) => {
      const t = o as { type?: string; pbKind?: string; name?: string };
      return `${i}:${t.type}${t.pbKind ? `(${t.pbKind})` : ''}`;
    })
    .join(' | ');
  return { count: objects.length, types, summary };
}

export function registerPbFabricCanvas(pageId: string, canvas: Canvas) {
  registry.set(pageId, canvas);
  (canvas as Canvas & { __pbPageId?: string }).__pbPageId = pageId;
  syncProbeGlobals();
}

export function unregisterPbFabricCanvas(pageId: string) {
  registry.delete(pageId);
  syncProbeGlobals();
}

export function getPbFabricCanvas(pageId: string): Canvas | undefined {
  return registry.get(pageId);
}

export function getPbFabricCanvasCount(): number {
  return registry.size;
}

/** Canvas the user is viewing (active page block in DOM). */
export function resolveActivePbFabricCanvas(): Canvas | null {
  const g = globalThis as typeof globalThis & { __PB_PROBE_PAGE_ID__?: string };
  const explicit = g.__PB_PROBE_PAGE_ID__;
  if (explicit && registry.has(explicit)) {
    return registry.get(explicit)!;
  }

  const activePageId = readActivePageIdFromDom();
  if (activePageId && registry.has(activePageId)) {
    return registry.get(activePageId)!;
  }

  return null;
}

/** @deprecated Use resolveActivePbFabricCanvas — kept for console snippets. */
export function resolveFabricCanvas(): Canvas | null {
  return resolveActivePbFabricCanvas() ?? pickFallbackProbeCanvas();
}

function pickFallbackProbeCanvas(): Canvas | null {
  if (registry.size === 0) return null;
  let best: Canvas | null = null;
  let bestCount = -1;
  for (const canvas of registry.values()) {
    const count = canvas.getObjects().length;
    if (count > bestCount) {
      bestCount = count;
      best = canvas;
    }
  }
  return best;
}

export function listAllPbFabricInstances(): PbFabricCanvasInstanceRow[] {
  const activePageId = readActivePageIdFromDom();
  const probeTarget = resolveActivePbFabricCanvas();

  const rows: PbFabricCanvasInstanceRow[] = [];
  for (const [pageId, canvas] of registry.entries()) {
    const { count, types, summary } = summarizeObjects(canvas);
    rows.push({
      pageId,
      objectCount: count,
      objectTypes: types || '(empty)',
      objectSummary: summary || '(none)',
      isActivePage: pageId === activePageId,
      isProbeTarget: canvas === probeTarget,
      domHostLabel: domHostLabelForPage(pageId),
      lowerCanvasInDom: lowerCanvasInDomForCanvas(canvas),
    });
  }

  rows.sort((a, b) => a.pageId.localeCompare(b.pageId));
  return rows;
}

export function logAllPbFabricInstances() {
  const rows = listAllPbFabricInstances();
  const probe = resolveActivePbFabricCanvas();
  const legacy = (globalThis as typeof globalThis & { __PB_FABRIC_CANVAS__?: Canvas | null })
    .__PB_FABRIC_CANVAS__;

  console.group('[pb-fabric-registry] all instances');
  console.log('Registered count:', registry.size);
  console.log('Active page id (DOM):', readActivePageIdFromDom() ?? '(none)');
  console.log('Probe target (__PB_PROBE_PAGE_ID__ or active):', (probe as Canvas & { __pbPageId?: string })?.__pbPageId ?? '(none)');
  console.log('Legacy __PB_FABRIC_CANVAS__ page:', (legacy as Canvas & { __pbPageId?: string } | null)?.__pbPageId ?? '(none)');
  console.log('Legacy matches probe target:', legacy === probe);
  console.table(rows);

  if (registry.size > 1) {
    console.warn(
      'Multiple Fabric canvases exist — probes must use the active page (isActivePage / isProbeTarget), not __PB_FABRIC_CANVAS__ alone.',
    );
  }
  if (probe && probe.getObjects().length <= 1) {
    const rich = rows.find((r) => r.objectCount > 1);
    if (rich) {
      console.warn(
        `Probe target has ${probe.getObjects().length} object(s) but page "${rich.pageId}" has ${rich.objectCount}. Probes were likely attached to the wrong canvas.`,
      );
    }
  }
  console.groupEnd();

  return rows;
}

function syncProbeGlobals() {
  if (typeof globalThis === 'undefined') return;
  const active = resolveActivePbFabricCanvas() ?? pickFallbackProbeCanvas();
  (globalThis as typeof globalThis & { __PB_FABRIC_CANVAS__?: Canvas | null }).__PB_FABRIC_CANVAS__ =
    active;
  (
    globalThis as typeof globalThis & { __PB_FABRIC_INSTANCES__?: typeof listAllPbFabricInstances }
  ).__PB_FABRIC_INSTANCES__ = listAllPbFabricInstances;
  (
    globalThis as typeof globalThis & { __PB_LOG_FABRIC_INSTANCES__?: typeof logAllPbFabricInstances }
  ).__PB_LOG_FABRIC_INSTANCES__ = logAllPbFabricInstances;
}

declare global {
  // eslint-disable-next-line no-var
  var __PB_FABRIC_CANVAS__: Canvas | null | undefined;
  // eslint-disable-next-line no-var
  var __PB_FABRIC_INSTANCES__: typeof listAllPbFabricInstances | undefined;
  // eslint-disable-next-line no-var
  var __PB_LOG_FABRIC_INSTANCES__: typeof logAllPbFabricInstances | undefined;
  // eslint-disable-next-line no-var
  var __PB_PROBE_PAGE_ID__: string | undefined;
}

syncProbeGlobals();
