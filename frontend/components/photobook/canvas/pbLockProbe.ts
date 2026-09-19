import type { FabricObject } from './types';
import { getTextRenderProbe } from './textLayout';
import { isTextObject } from './textStyle';

export type PbLockProbePhase =
  | 'unlocked'
  | 'before-lock'
  | 'after-lock'
  | 'before-unlock'
  | 'after-unlock';

type PbLockProbeEntry = {
  phase: PbLockProbePhase;
  at: string;
  values: Record<string, unknown>;
};

declare global {
  // eslint-disable-next-line no-var
  var __PB_LOCK_PROBE_LOG__: PbLockProbeEntry[] | undefined;
  // eslint-disable-next-line no-var
  var __PB_LOCK_PROBE__: boolean | undefined;
}

function pushProbe(phase: PbLockProbePhase, obj: FabricObject) {
  if (!isTextObject(obj)) return;
  const values = getTextRenderProbe(obj);
  if (!values) return;
  const entry: PbLockProbeEntry = {
    phase,
    at: new Date().toISOString(),
    values,
  };
  if (!globalThis.__PB_LOCK_PROBE_LOG__) {
    globalThis.__PB_LOCK_PROBE_LOG__ = [];
  }
  globalThis.__PB_LOCK_PROBE_LOG__.push(entry);
  if (globalThis.__PB_LOCK_PROBE__) {
    console.group(`[pb-lock] ${phase}`);
    console.table(values);
    console.groupEnd();
  }
}

export function recordLockProbe(phase: PbLockProbePhase, obj: FabricObject) {
  pushProbe(phase, obj);
}

export function logLockRenderProbe(
  phase: 'before-lock' | 'after-lock' | 'before-unlock' | 'after-unlock',
  obj: FabricObject,
) {
  recordLockProbe(phase, obj);
}

export function diffProbe(
  a: PbLockProbePhase,
  b: PbLockProbePhase,
): Record<string, { from: unknown; to: unknown }> | null {
  const log = globalThis.__PB_LOCK_PROBE_LOG__;
  if (!log?.length) return null;
  const left = log.find((e) => e.phase === a)?.values;
  const right = log.find((e) => e.phase === b)?.values;
  if (!left || !right) return null;
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(left)) {
    if (left[key] !== right[key]) {
      changed[key] = { from: left[key], to: right[key] };
    }
  }
  return changed;
}
