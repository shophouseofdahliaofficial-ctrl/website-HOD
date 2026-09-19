'use client';

import { useEffect, useRef, useState } from 'react';
import {
  buildInstSQCComparisonRecipes,
  instSQCBaselineRecipe,
} from '@/lib/photobooth/film/instSqc/buildComparisonRecipes';
import { drawInstSQCTestPattern } from '@/lib/photobooth/film/instSqc/testPattern';
import { renderInstSQCToCanvas } from '@/lib/photobooth/film/instSqc/webglRenderer';
import type { InstSQCRecipe } from '@/lib/photobooth/film/instSqc/types';

const W = 640;
const H = 480;

function renderRecipe(
  target: HTMLCanvasElement,
  source: HTMLCanvasElement,
  recipe: InstSQCRecipe,
): boolean {
  return renderInstSQCToCanvas(target, source, W, H, recipe, 0.042, false, 'capture');
}

export default function InstSQCComparePage() {
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const source = document.createElement('canvas');
    source.width = W;
    source.height = H;
    drawInstSQCTestPattern(source);
    sourceRef.current = source;
    setReady(true);
  }, []);

  const downloadCanvas = (canvas: HTMLCanvasElement, name: string) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  };

  const renderAll = () => {
    const source = sourceRef.current;
    if (!source) return [];

    const baseline = instSQCBaselineRecipe();
    const items: { id: string; label: string; canvas: HTMLCanvasElement }[] = [];

    const raw = document.createElement('canvas');
    raw.width = W;
    raw.height = H;
    const rawCtx = raw.getContext('2d');
    if (rawCtx) {
      rawCtx.drawImage(source, 0, 0);
      items.push({ id: 'source', label: 'Source (unfiltered)', canvas: raw });
    }

    const baselineCanvas = document.createElement('canvas');
    baselineCanvas.width = W;
    baselineCanvas.height = H;
    if (!renderRecipe(baselineCanvas, source, baseline)) {
      setError('WebGL render failed — check console for shader errors.');
      return items;
    }
    items.push({
      id: 'baseline-v32',
      label: 'v3.2 baseline (HDR + micro + cream + grain)',
      canvas: baselineCanvas,
    });

    for (const { step, recipe } of buildInstSQCComparisonRecipes()) {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      if (!renderRecipe(c, source, recipe)) {
        setError(`Render failed at step ${step.id}`);
        break;
      }
      items.push({ id: step.id, label: step.label, canvas: c });
    }

    return items;
  };

  const [outputs, setOutputs] = useState<
    { id: string; label: string; canvas: HTMLCanvasElement }[]
  >([]);

  useEffect(() => {
    if (!ready) return;
    setOutputs(renderAll());
  }, [ready]);

  const downloadAll = () => {
    for (const o of outputs) {
      downloadCanvas(o.canvas, `inst-sqc-${o.id}.png`);
    }
  };

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', background: '#111', color: '#eee', minHeight: '100vh' }}>
      <h1 style={{ margin: '0 0 8px' }}>Inst SQC v3.2 — Staged Comparison</h1>
      <p style={{ margin: '0 0 16px', opacity: 0.75, maxWidth: 720 }}>
        Color transforms disabled in baseline: chromatic aberration, pastel dye mapper, shadow
        pollution, development variation. Reintroduce one stage at a time below.
      </p>
      {error && <p style={{ color: '#f66' }}>{error}</p>}
      <button
        type="button"
        onClick={downloadAll}
        style={{ marginBottom: 24, padding: '8px 16px', cursor: 'pointer' }}
      >
        Download all PNGs
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 20,
        }}
      >
        {outputs.map((o) => (
          <figure key={o.id} data-step-id={o.id} style={{ margin: 0 }}>
            <canvas
              ref={(el) => {
                if (!el || el.width === W) return;
                el.width = W;
                el.height = H;
                const ctx = el.getContext('2d');
                ctx?.drawImage(o.canvas, 0, 0);
              }}
              style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #333' }}
            />
            <figcaption style={{ marginTop: 8, fontSize: 14 }}>{o.label}</figcaption>
            <button
              type="button"
              onClick={() => downloadCanvas(o.canvas, `inst-sqc-${o.id}.png`)}
              style={{ marginTop: 6, fontSize: 12, cursor: 'pointer' }}
            >
              Download
            </button>
          </figure>
        ))}
      </div>
    </main>
  );
}
