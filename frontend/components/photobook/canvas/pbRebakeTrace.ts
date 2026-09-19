import type { Canvas, FabricObject } from './types';

export type PbRebakeTraceFn =
  | 'applyLockToObject'
  | 'rebakeTextAfterInteraction'
  | 'initDimensions'
  | 'setCoords'
  | 'flushCanvasRender'
  | 'renderAll';

export type PbRebakeTraceEntry = {
  fn: PbRebakeTraceFn | string;
  at: string;
  meta?: Record<string, unknown>;
};

const EXPECTED_LOCK_CYCLE: PbRebakeTraceFn[] = [
  'applyLockToObject',
  'rebakeTextAfterInteraction',
  'initDimensions',
  'setCoords',
  'flushCanvasRender',
  'renderAll',
];

declare global {
  // eslint-disable-next-line no-var
  var __PB_REBAKE_TRACE__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __PB_REBAKE_TRACE_LOG__: PbRebakeTraceEntry[] | undefined;
  // eslint-disable-next-line no-var
  var __PB_REPORT_REBAKE_TRACE__: (() => PbRebakeTraceReport) | undefined;
  // eslint-disable-next-line no-var
  var __PB_CLEAR_REBAKE_TRACE__: (() => void) | undefined;
}

export type PbRebakeTraceReport = {
  enabled: boolean;
  entryCount: number;
  executed: PbRebakeTraceFn[];
  notExecuted: PbRebakeTraceFn[];
  renderAllRan: boolean;
  renderAllCallCount: number;
  lockCycles: Array<{
    locked: boolean | null;
    steps: string[];
    dirtyAfterRebake: boolean | null;
    dirtyAfterApplyLock: boolean | null;
  }>;
  timeline: PbRebakeTraceEntry[];
};

export function isRebakeTraceEnabled(): boolean {
  if (typeof globalThis === 'undefined') return false;
  return !!(globalThis.__PB_REBAKE_TRACE__ || globalThis.__PB_LOCK_PROBE__);
}

function ensureLog(): PbRebakeTraceEntry[] {
  if (!globalThis.__PB_REBAKE_TRACE_LOG__) {
    globalThis.__PB_REBAKE_TRACE_LOG__ = [];
  }
  return globalThis.__PB_REBAKE_TRACE_LOG__;
}

export function clearRebakeTrace() {
  if (typeof globalThis === 'undefined') return;
  globalThis.__PB_REBAKE_TRACE_LOG__ = [];
}

export function traceRebake(fn: PbRebakeTraceFn | string, meta?: Record<string, unknown>) {
  if (!isRebakeTraceEnabled()) return;
  const entry: PbRebakeTraceEntry = {
    fn,
    at: new Date().toISOString(),
    meta,
  };
  ensureLog().push(entry);
  console.log(`[pb-rebake-trace] ${fn}`, meta ?? '');
}

export function reportRebakeTrace(): PbRebakeTraceReport {
  const log = globalThis.__PB_REBAKE_TRACE_LOG__ ?? [];
  const executedSet = new Set<PbRebakeTraceFn>();
  let renderAllCallCount = 0;

  for (const e of log) {
    if (e.fn === 'renderAll') {
      executedSet.add('renderAll');
      renderAllCallCount += 1;
    } else if (EXPECTED_LOCK_CYCLE.includes(e.fn as PbRebakeTraceFn)) {
      executedSet.add(e.fn as PbRebakeTraceFn);
    }
  }

  const executed = EXPECTED_LOCK_CYCLE.filter((fn) => executedSet.has(fn));
  const notExecuted = EXPECTED_LOCK_CYCLE.filter((fn) => !executedSet.has(fn));

  const lockCycles: PbRebakeTraceReport['lockCycles'] = [];
  let current: PbRebakeTraceReport['lockCycles'][number] | null = null;

  for (const e of log) {
    if (e.fn === 'applyLockToObject' && e.meta?.phase === 'enter') {
      current = {
        locked: typeof e.meta.locked === 'boolean' ? e.meta.locked : null,
        steps: ['applyLockToObject'],
        dirtyAfterRebake: null,
        dirtyAfterApplyLock: null,
      };
      lockCycles.push(current);
      continue;
    }
    if (!current) continue;

    if (
      e.fn === 'rebakeTextAfterInteraction' ||
      e.fn === 'initDimensions' ||
      e.fn === 'setCoords' ||
      e.fn === 'flushCanvasRender' ||
      e.fn === 'renderAll'
    ) {
      if (!current.steps.includes(e.fn)) current.steps.push(e.fn);
    }

    if (e.fn === 'rebakeTextAfterInteraction' && e.meta?.phase === 'exit') {
      current.dirtyAfterRebake =
        typeof e.meta.dirty === 'boolean' ? e.meta.dirty : null;
    }

    if (e.fn === 'applyLockToObject' && e.meta?.phase === 'exit') {
      current.dirtyAfterApplyLock =
        typeof e.meta.dirty === 'boolean' ? e.meta.dirty : null;
      current = null;
    }
  }

  const report: PbRebakeTraceReport = {
    enabled: isRebakeTraceEnabled(),
    entryCount: log.length,
    executed,
    notExecuted,
    renderAllRan: renderAllCallCount > 0,
    renderAllCallCount,
    lockCycles,
    timeline: [...log],
  };

  console.group('[pb-rebake-trace] report');
  console.log('Executed:', report.executed);
  console.log('NOT executed:', report.notExecuted);
  console.log('renderAll() ran:', report.renderAllRan, `(${report.renderAllCallCount} calls)`);
  console.table(lockCycles);
  console.log('Full timeline:', report.timeline);
  console.groupEnd();

  return report;
}

export function installRebakeTraceGlobals() {
  if (typeof globalThis === 'undefined') return;
  globalThis.__PB_REPORT_REBAKE_TRACE__ = reportRebakeTrace;
  globalThis.__PB_CLEAR_REBAKE_TRACE__ = clearRebakeTrace;
}

installRebakeTraceGlobals();
