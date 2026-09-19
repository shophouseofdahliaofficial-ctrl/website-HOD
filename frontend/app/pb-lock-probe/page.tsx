'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PbCanvasPage from '@/components/photobook/canvas/PbCanvasPage';
import type { PbCanvasPageApi } from '@/components/photobook/canvas/api';
import type { PbLockProbeRunResult } from '@/components/photobook/canvas/pbLockProbeRunner';
import { runLockRebakeProbe } from '@/components/photobook/canvas/pbLockProbeRunner';
import type { Canvas } from '@/components/photobook/canvas/types';

declare global {
  // eslint-disable-next-line no-var
  var __PB_PROBE_RESULTS__: PbLockProbeRunResult | undefined;
  // eslint-disable-next-line no-var
  var __PB_RUN_LOCK_PROBE__: (() => Promise<PbLockProbeRunResult>) | undefined;
  // eslint-disable-next-line no-var
  var __PB_PROBE_CONSOLE__: string[] | undefined;
}

export default function PbLockProbePage() {
  const apiRef = useRef<PbCanvasPageApi | null>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const ranRef = useRef(false);
  const [resultJson, setResultJson] = useState<string>('Waiting for canvas…');

  const runProbe = useCallback(async () => {
    const api = apiRef.current;
    const canvas = canvasRef.current;
    if (!api || !canvas) return { error: 'not ready' } as PbLockProbeRunResult;
    const out = await runLockRebakeProbe(api, () => canvasRef.current);
    globalThis.__PB_PROBE_RESULTS__ = out;
    setResultJson(JSON.stringify(out, null, 2));
    console.log('__PB_PROBE_RESULTS__', out);
    return out;
  }, []);

  useEffect(() => {
    globalThis.__PB_RUN_LOCK_PROBE__ = runProbe;
    globalThis.__PB_PROBE_CONSOLE__ = globalThis.__PB_PROBE_CONSOLE__ || [];
    const prev = console.log;
    console.log = (...args: unknown[]) => {
      globalThis.__PB_PROBE_CONSOLE__?.push(args.map(String).join(' '));
      prev(...args);
    };
  }, [runProbe]);

  const tryAutoRun = useCallback(() => {
    if (ranRef.current || !apiRef.current || !canvasRef.current) return;
    ranRef.current = true;
    void runProbe();
  }, [runProbe]);

  return (
    <div style={{ padding: 16, fontFamily: 'monospace' }}>
      <h1>Pb lock rebake probe</h1>
      <p>Auto-runs on load. Re-run: <code>globalThis.__PB_RUN_LOCK_PROBE__()</code></p>
      <div style={{ width: 420, height: 420, border: '1px solid #ccc' }}>
        <PbCanvasPage
          pageId="probe"
          isActivePage
          isPreview={false}
          isLocked={false}
          toolsActive
          toolMode="select"
          drawPreset="pencil"
          linePreset="straight"
          canvasShape="rect"
          displayScale={1}
          onDocumentChange={() => {}}
          onRegisterApi={(id, api) => {
            if (id === 'probe') {
              apiRef.current = api;
              tryAutoRun();
            }
          }}
          onFabricCanvasReady={(canvas) => {
            canvasRef.current = canvas;
            tryAutoRun();
          }}
          onObjectSelected={() => {}}
        />
      </div>
      <pre style={{ marginTop: 16, whiteSpace: 'pre-wrap', fontSize: 11 }}>{resultJson}</pre>
    </div>
  );
}
