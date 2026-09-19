'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdaptedParams, FilmRecipe, ImageStats } from '@/lib/photobooth/film/types';
import {
  applyFilmRecipe,
  exportRecipeJson,
  normalizeHistogram,
  parseRecipeJson,
} from '@/lib/photobooth/film';
import { INST_C_RECIPE } from '@/lib/photobooth/film/recipes/inst-c';
import { STUDIO_BATCH_IMAGES } from '@/lib/photobooth/film/studioBatchImages';
import styles from './studio.module.css';

type SliderDef = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  section: string;
  get: (r: FilmRecipe) => number;
  set: (r: FilmRecipe, v: number) => FilmRecipe;
};

function cloneRecipe(r: FilmRecipe): FilmRecipe {
  return JSON.parse(JSON.stringify(r)) as FilmRecipe;
}

function setNested(recipe: FilmRecipe, path: string[], value: number): FilmRecipe {
  const next = cloneRecipe(recipe);
  let obj: Record<string, unknown> = next as unknown as Record<string, unknown>;
  for (let i = 0; i < path.length - 1; i++) {
    if (obj[path[i]] == null || typeof obj[path[i]] !== 'object') {
      obj[path[i]] = {};
    }
    obj = obj[path[i]] as Record<string, unknown>;
  }
  obj[path[path.length - 1]] = value;
  return next;
}

const SLIDERS: SliderDef[] = [
  { key: 'exposure', label: 'Exposure (EV)', min: -0.5, max: 0.5, step: 0.01, section: 'Tone', get: (r) => r.exposure, set: (r, v) => ({ ...r, exposure: v }) },
  { key: 'contrast', label: 'Contrast', min: 0.8, max: 1.2, step: 0.01, section: 'Tone', get: (r) => r.contrast, set: (r, v) => ({ ...r, contrast: v }) },
  { key: 'saturation', label: 'Saturation', min: 0.7, max: 1.1, step: 0.01, section: 'Tone', get: (r) => r.saturation, set: (r, v) => ({ ...r, saturation: v }) },
  { key: 'highlights', label: 'Highlights', min: -40, max: 20, step: 1, section: 'Tone', get: (r) => r.highlights, set: (r, v) => ({ ...r, highlights: v }) },
  { key: 'shadows', label: 'Shadows', min: -10, max: 40, step: 1, section: 'Tone', get: (r) => r.shadows, set: (r, v) => ({ ...r, shadows: v }) },
  { key: 'whites', label: 'Whites', min: -40, max: 10, step: 1, section: 'Tone', get: (r) => r.whites, set: (r, v) => ({ ...r, whites: v }) },
  { key: 'blacks', label: 'Blacks', min: 0, max: 40, step: 1, section: 'Tone', get: (r) => r.blacks, set: (r, v) => ({ ...r, blacks: v }) },
  { key: 'fade', label: 'Fade / Matte', min: 0, max: 0.35, step: 0.01, section: 'Tone', get: (r) => r.fade, set: (r, v) => ({ ...r, fade: v }) },
  { key: 'rolloffKnee', label: 'Highlight Rolloff Knee', min: 0.65, max: 0.82, step: 0.01, section: 'Tone', get: (r) => r.highlightRolloff.knee, set: (r, v) => setNested(r, ['highlightRolloff', 'knee'], v) },
  { key: 'rolloffStrength', label: 'Rolloff Strength', min: 0.5, max: 1, step: 0.01, section: 'Tone', get: (r) => r.highlightRolloff.strength, set: (r, v) => setNested(r, ['highlightRolloff', 'strength'], v) },
  { key: 'temperature', label: 'Temperature', min: -30, max: 30, step: 1, section: 'Color', get: (r) => r.temperature, set: (r, v) => ({ ...r, temperature: v }) },
  { key: 'tint', label: 'Tint (magenta+)', min: -20, max: 20, step: 1, section: 'Color', get: (r) => r.tint, set: (r, v) => ({ ...r, tint: v }) },
  { key: 'greens', label: 'Green → Olive', min: -30, max: 40, step: 1, section: 'Color', get: (r) => r.hueShifts.greens, set: (r, v) => ({ ...r, hueShifts: { ...r.hueShifts, greens: v } }) },
  { key: 'blues', label: 'Blue → Cyan-gray', min: -30, max: 20, step: 1, section: 'Color', get: (r) => r.hueShifts.blues, set: (r, v) => ({ ...r, hueShifts: { ...r.hueShifts, blues: v } }) },
  { key: 'skinPreserve', label: 'Skin Preserve', min: 0, max: 1, step: 0.05, section: 'Color', get: (r) => r.hueShifts.skinPreserve, set: (r, v) => ({ ...r, hueShifts: { ...r.hueShifts, skinPreserve: v } }) },
  { key: 'bloomIntensity', label: 'Bloom Intensity', min: 0, max: 0.5, step: 0.01, section: 'Effects', get: (r) => r.bloom.intensity, set: (r, v) => setNested(r, ['bloom', 'intensity'], v) },
  { key: 'bloomThreshold', label: 'Bloom Threshold', min: 0.5, max: 0.95, step: 0.01, section: 'Effects', get: (r) => r.bloom.threshold, set: (r, v) => setNested(r, ['bloom', 'threshold'], v) },
  { key: 'bloomRadius', label: 'Bloom Radius', min: 4, max: 24, step: 1, section: 'Effects', get: (r) => r.bloom.radius, set: (r, v) => setNested(r, ['bloom', 'radius'], v) },
  { key: 'lensDiffusion', label: 'Lens Diffusion', min: 0, max: 0.15, step: 0.005, section: 'Effects', get: (r) => r.lensDiffusion.intensity, set: (r, v) => setNested(r, ['lensDiffusion', 'intensity'], v) },
  { key: 'lensRadius', label: 'Diffusion Radius', min: 16, max: 48, step: 1, section: 'Effects', get: (r) => r.lensDiffusion.radius, set: (r, v) => setNested(r, ['lensDiffusion', 'radius'], v) },
  { key: 'halIntensity', label: 'Halation Intensity', min: 0, max: 0.4, step: 0.01, section: 'Effects', get: (r) => r.halation.intensity, set: (r, v) => setNested(r, ['halation', 'intensity'], v) },
  { key: 'halThreshold', label: 'Halation Threshold', min: 0.6, max: 0.98, step: 0.01, section: 'Effects', get: (r) => r.halation.threshold, set: (r, v) => setNested(r, ['halation', 'threshold'], v) },
  { key: 'halRedBleed', label: 'Red Bleed', min: 0, max: 1, step: 0.05, section: 'Effects', get: (r) => r.halation.redBleed, set: (r, v) => setNested(r, ['halation', 'redBleed'], v) },
  { key: 'grainAmount', label: 'Grain', min: 0, max: 30, step: 1, section: 'Effects', get: (r) => r.grain.amount, set: (r, v) => setNested(r, ['grain', 'amount'], v) },
  { key: 'grainSize', label: 'Grain Clump Size', min: 1.5, max: 6, step: 0.1, section: 'Effects', get: (r) => r.grain.size, set: (r, v) => setNested(r, ['grain', 'size'], v) },
  { key: 'grainMidtone', label: 'Grain Shadows/Mids', min: 0.5, max: 2.2, step: 0.05, section: 'Effects', get: (r) => r.grain.midtoneBoost, set: (r, v) => setNested(r, ['grain', 'midtoneBoost'], v) },
  { key: 'vignetteStrength', label: 'Vignette', min: 0, max: 0.35, step: 0.01, section: 'Effects', get: (r) => r.vignette.strength, set: (r, v) => setNested(r, ['vignette', 'strength'], v) },
  { key: 'lensSoftness', label: 'Lens Softness', min: 0, max: 1, step: 0.02, section: 'Analog', get: (r) => r.analog?.lensSoftness ?? 0, set: (r, v) => setNested(r, ['analog', 'lensSoftness'], v) },
  { key: 'microContrast', label: 'Micro-detail Reduction', min: 0, max: 1, step: 0.02, section: 'Analog', get: (r) => r.analog?.microContrast ?? 0, set: (r, v) => setNested(r, ['analog', 'microContrast'], v) },
  { key: 'pastelCompression', label: 'Pastel Ink Compression', min: 0, max: 1, step: 0.02, section: 'Analog', get: (r) => r.analog?.pastelCompression ?? 0, set: (r, v) => setNested(r, ['analog', 'pastelCompression'], v) },
  { key: 'atmosphericVeil', label: 'Atmospheric Veil', min: 0, max: 1, step: 0.02, section: 'Analog', get: (r) => r.analog?.atmosphericVeil ?? 0, set: (r, v) => setNested(r, ['analog', 'atmosphericVeil'], v) },
  { key: 'tonalCompression', label: 'Tonal Compression (DR)', min: 0, max: 1, step: 0.02, section: 'Analog', get: (r) => r.analog?.tonalCompression ?? 0, set: (r, v) => setNested(r, ['analog', 'tonalCompression'], v) },
  { key: 'colorDrift', label: 'Color Drift', min: 0, max: 1, step: 0.02, section: 'Analog', get: (r) => r.analog?.colorDrift ?? 0, set: (r, v) => setNested(r, ['analog', 'colorDrift'], v) },
  { key: 'opticalSoftness', label: 'Optical Softness', min: 0, max: 1, step: 0.02, section: 'Analog', get: (r) => r.analog?.opticalSoftness ?? 0, set: (r, v) => setNested(r, ['analog', 'opticalSoftness'], v) },
];

function HistogramChart({ histogram, label }: { histogram: Uint32Array | null; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !histogram) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const norm = normalizeHistogram(histogram);
    ctx.fillStyle = 'rgba(180, 165, 145, 0.85)';
    const barW = w / 256;
    for (let i = 0; i < 256; i++) {
      const barH = norm[i] * (h - 4);
      ctx.fillRect(i * barW, h - barH, Math.max(barW, 1), barH);
    }
  }, [histogram]);

  return (
    <div className={styles.histogramBlock}>
      <span className={styles.histogramLabel}>{label}</span>
      <canvas ref={canvasRef} width={256} height={64} className={styles.histogramCanvas} />
    </div>
  );
}

function StatsPanel({ stats, adapted }: { stats: ImageStats | null; adapted: AdaptedParams | null }) {
  if (!stats) return <p className={styles.statsEmpty}>Process an image to see statistics.</p>;
  return (
    <dl className={styles.statsGrid}>
      <div><dt>Brightness</dt><dd>{stats.brightness.toFixed(1)}</dd></div>
      <div><dt>Contrast σ</dt><dd>{stats.contrast.toFixed(1)}</dd></div>
      <div><dt>Saturation</dt><dd>{(stats.saturation * 100).toFixed(0)}%</dd></div>
      <div><dt>Dynamic range</dt><dd>{stats.dynamicRange.toFixed(0)}</dd></div>
      <div><dt>P5 / P50 / P95</dt><dd>{stats.p5.toFixed(0)} / {stats.p50.toFixed(0)} / {stats.p95.toFixed(0)}</dd></div>
      {adapted && (
        <>
          <div><dt>Adapted EV</dt><dd>{adapted.exposure.toFixed(2)}</dd></div>
          <div><dt>Adapted contrast</dt><dd>{adapted.contrast.toFixed(2)}</dd></div>
          <div><dt>Adapted sat</dt><dd>{adapted.saturation.toFixed(2)}</dd></div>
        </>
      )}
    </dl>
  );
}

function CompareSlider({
  originalUrl,
  processedUrl,
  position,
  onPositionChange,
  zoom100,
  imageSize,
}: {
  originalUrl: string;
  processedUrl: string;
  position: number;
  onPositionChange: (v: number) => void;
  zoom100: boolean;
  imageSize: { w: number; h: number } | null;
}) {
  const imgStyle = zoom100 && imageSize
    ? { width: imageSize.w, height: imageSize.h, maxWidth: 'none' as const }
    : undefined;

  return (
    <div className={styles.abCompare}>
      <div className={`${styles.abSliderWrap} ${zoom100 ? styles.abZoom100 : ''}`}>
        <img src={originalUrl} alt="Original" className={styles.abImg} style={imgStyle} draggable={false} />
        <div className={styles.abProcessedClip} style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
          <img src={processedUrl} alt="Inst C" className={styles.abImg} style={imgStyle} draggable={false} />
        </div>
        <div className={styles.abDivider} style={{ left: `${position}%` }} />
        <input
          type="range"
          min={2}
          max={98}
          value={position}
          className={styles.abSliderInput}
          onChange={(e) => onPositionChange(parseFloat(e.target.value))}
          aria-label="A/B compare position"
        />
      </div>
      <div className={styles.abLabels}>
        <span>Original</span>
        <span>Inst C</span>
      </div>
    </div>
  );
}

export default function FilterStudio() {
  const [recipe, setRecipe] = useState<FilmRecipe>(() => cloneRecipe(INST_C_RECIPE));
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [origStats, setOrigStats] = useState<ImageStats | null>(null);
  const [procStats, setProcStats] = useState<ImageStats | null>(null);
  const [adapted, setAdapted] = useState<AdaptedParams | null>(null);
  const [processing, setProcessing] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<string[]>([]);
  const [view, setView] = useState<'editor' | 'batch'>('editor');
  const [compareMode, setCompareMode] = useState<'split' | 'slider'>('slider');
  const [comparePosition, setComparePosition] = useState(50);
  const [zoom100, setZoom100] = useState(false);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const processTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runProcess = useCallback(async (url: string, currentRecipe: FilmRecipe, atNativeSize: boolean) => {
    setProcessing(true);
    try {
      const img = await loadImage(url);
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (atNativeSize) {
        const cap = 2400;
        if (Math.max(w, h) > cap) {
          const s = cap / Math.max(w, h);
          w = Math.round(w * s);
          h = Math.round(h * s);
        }
      } else {
        const maxDim = 900;
        if (Math.max(w, h) > maxDim) {
          const s = maxDim / Math.max(w, h);
          w = Math.round(w * s);
          h = Math.round(h * s);
        }
      }

      setImageSize({ w, h });

      const origCanvas = document.createElement('canvas');
      origCanvas.width = w;
      origCanvas.height = h;
      const oCtx = origCanvas.getContext('2d');
      if (!oCtx) return;
      oCtx.drawImage(img, 0, 0, w, h);
      setOriginalUrl(origCanvas.toDataURL('image/jpeg', 0.92));

      const { analyzeImageData } = await import('@/lib/photobooth/film/analyzeImage');
      const origData = oCtx.getImageData(0, 0, w, h);
      setOrigStats(analyzeImageData(origData.data, w, h));

      const procCanvas = document.createElement('canvas');
      procCanvas.width = w;
      procCanvas.height = h;
      const pCtx = procCanvas.getContext('2d');
      if (!pCtx) return;
      pCtx.drawImage(img, 0, 0, w, h);
      const result = applyFilmRecipe(procCanvas, currentRecipe, { seed: 42 });
      setProcessedUrl(procCanvas.toDataURL('image/jpeg', 0.92));
      if (result) {
        setProcStats(result.stats);
        setAdapted(result.adapted);
      }
    } finally {
      setProcessing(false);
    }
  }, []);

  const scheduleProcess = useCallback((url: string, currentRecipe: FilmRecipe, atNativeSize: boolean) => {
    if (processTimer.current) clearTimeout(processTimer.current);
    processTimer.current = setTimeout(() => runProcess(url, currentRecipe, atNativeSize), 120);
  }, [runProcess]);

  useEffect(() => {
    if (sourceUrl) scheduleProcess(sourceUrl, recipe, zoom100);
  }, [recipe, sourceUrl, zoom100, scheduleProcess]);

  useEffect(() => {
    if (!sourceUrl) {
      const defaultImg = STUDIO_BATCH_IMAGES[0];
      setSourceUrl(defaultImg);
    }
  }, [sourceUrl]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
  };

  const updateSlider = (def: SliderDef, value: number) => {
    setRecipe((prev) => def.set(prev, value));
  };

  const resetToInstC = () => setRecipe(cloneRecipe(INST_C_RECIPE));

  const exportRecipe = () => {
    const blob = new Blob([exportRecipeJson(recipe)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${recipe.id || 'filter'}-recipe.json`;
    a.click();
  };

  const importRecipe = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setRecipe(parseRecipeJson(reader.result as string));
      } catch {
        alert('Invalid recipe JSON');
      }
    };
    reader.readAsText(file);
  };

  const runBatch = async () => {
    setBatchRunning(true);
    setBatchProgress(0);
    setBatchResults([]);
    const results: string[] = [];
    const total = STUDIO_BATCH_IMAGES.length;

    for (let i = 0; i < total; i++) {
      try {
        const img = await loadImage(STUDIO_BATCH_IMAGES[i]);
        const size = 280;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        const s = size / Math.max(img.naturalWidth, img.naturalHeight);
        const dw = img.naturalWidth * s;
        const dh = img.naturalHeight * s;
        ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
        applyFilmRecipe(canvas, recipe, { seed: i + 1 });
        results.push(canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        /* skip failed loads */
      }
      setBatchProgress(Math.round(((i + 1) / total) * 100));
      if (i % 4 === 0) {
        setBatchResults([...results]);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    setBatchResults(results);
    setBatchRunning(false);
    setView('batch');
  };

  const sections = [...new Set(SLIDERS.map((s) => s.section))];

  return (
    <div className={styles.studio}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Reto Filter Studio</h1>
          <p className={styles.subtitle}>{recipe.name} · {recipe.description}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btn} onClick={() => setView('editor')}>Editor</button>
          <button type="button" className={styles.btn} onClick={() => setView('batch')}>Batch ({STUDIO_BATCH_IMAGES.length})</button>
          <button type="button" className={styles.btnPrimary} onClick={resetToInstC}>Reset Inst C</button>
          <button type="button" className={styles.btn} onClick={exportRecipe}>Export JSON</button>
          <label className={styles.btn}>
            Import JSON
            <input type="file" accept=".json" hidden onChange={importRecipe} />
          </label>
          <label className={styles.btnPrimary}>
            Upload Photo
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleUpload} />
          </label>
        </div>
      </header>

      {view === 'editor' ? (
        <div className={styles.layout}>
          <aside className={styles.controls}>
            {sections.map((section) => (
              <div key={section} className={styles.controlSection}>
                <h3 className={styles.sectionTitle}>{section}</h3>
                {SLIDERS.filter((s) => s.section === section).map((def) => (
                  <label key={def.key} className={styles.sliderRow}>
                    <span className={styles.sliderLabel}>
                      {def.label}
                      <span className={styles.sliderValue}>{def.get(recipe).toFixed(2)}</span>
                    </span>
                    <input
                      type="range"
                      min={def.min}
                      max={def.max}
                      step={def.step}
                      value={def.get(recipe)}
                      onChange={(e) => updateSlider(def, parseFloat(e.target.value))}
                    />
                  </label>
                ))}
              </div>
            ))}
          </aside>

          <main className={styles.previewArea}>
            <div className={styles.compareToolbar}>
              <div className={styles.compareModeGroup}>
                <button
                  type="button"
                  className={compareMode === 'slider' ? styles.btnActive : styles.btn}
                  onClick={() => setCompareMode('slider')}
                >
                  A/B Slider
                </button>
                <button
                  type="button"
                  className={compareMode === 'split' ? styles.btnActive : styles.btn}
                  onClick={() => setCompareMode('split')}
                >
                  Side by Side
                </button>
              </div>
              <label className={styles.zoomToggle}>
                <input
                  type="checkbox"
                  checked={zoom100}
                  onChange={(e) => setZoom100(e.target.checked)}
                />
                100% zoom {imageSize ? `(${imageSize.w}×${imageSize.h})` : ''}
              </label>
              {zoom100 && (
                <span className={styles.zoomHint}>Scroll to inspect grain at actual pixel size</span>
              )}
            </div>

            {compareMode === 'slider' && originalUrl && processedUrl ? (
              <CompareSlider
                originalUrl={originalUrl}
                processedUrl={processedUrl}
                position={comparePosition}
                onPositionChange={setComparePosition}
                zoom100={zoom100}
                imageSize={imageSize}
              />
            ) : (
              <div className={`${styles.compareRow} ${zoom100 ? styles.compareRowZoom : ''}`}>
                <figure className={styles.previewPane}>
                  <figcaption>Original {processing && '…'}</figcaption>
                  <div className={zoom100 ? styles.zoomScroll : undefined}>
                    {originalUrl ? (
                      <img
                        src={originalUrl}
                        alt="Original"
                        className={zoom100 ? styles.previewImgNative : styles.previewImg}
                        style={zoom100 && imageSize ? { width: imageSize.w, height: imageSize.h } : undefined}
                      />
                    ) : (
                      <div className={styles.previewPlaceholder}>Loading…</div>
                    )}
                  </div>
                </figure>
                <figure className={styles.previewPane}>
                  <figcaption>Inst C — Edited</figcaption>
                  <div className={zoom100 ? styles.zoomScroll : undefined}>
                    {processedUrl ? (
                      <img
                        src={processedUrl}
                        alt="Processed"
                        className={zoom100 ? styles.previewImgNative : styles.previewImg}
                        style={zoom100 && imageSize ? { width: imageSize.w, height: imageSize.h } : undefined}
                      />
                    ) : (
                      <div className={styles.previewPlaceholder}>Processing…</div>
                    )}
                  </div>
                </figure>
              </div>
            )}

            <div className={styles.analyticsRow}>
              <HistogramChart histogram={origStats?.histogram ?? null} label="Original histogram" />
              <HistogramChart histogram={procStats?.histogram ?? null} label="Graded histogram" />
              <div className={styles.statsPanel}>
                <h3>Image statistics</h3>
                <StatsPanel stats={procStats} adapted={adapted} />
              </div>
            </div>

            <div className={styles.batchBar}>
              <button type="button" className={styles.btnPrimary} disabled={batchRunning} onClick={runBatch}>
                {batchRunning ? `Batch testing… ${batchProgress}%` : `Batch test ${STUDIO_BATCH_IMAGES.length} images`}
              </button>
            </div>
          </main>
        </div>
      ) : (
        <div className={styles.batchView}>
          <p className={styles.batchMeta}>
            {batchResults.length} / {STUDIO_BATCH_IMAGES.length} images · recipe: {recipe.name} v{recipe.version}
          </p>
          <div className={styles.batchGrid}>
            {batchResults.map((url, i) => (
              <img key={i} src={url} alt={`Batch ${i + 1}`} className={styles.batchThumb} />
            ))}
          </div>
          {!batchRunning && batchResults.length === 0 && (
            <button type="button" className={styles.btnPrimary} onClick={runBatch}>
              Run batch test
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
