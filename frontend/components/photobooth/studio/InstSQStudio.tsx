'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InstSQRecipe } from '@/lib/photobooth/film/instSq/types';
import type { ImageStats } from '@/lib/photobooth/film/types';
import {
  applyInstSQFilter,
  exportInstSQRecipeJson,
  INST_SQ_RECIPE,
  parseInstSQRecipeJson,
} from '@/lib/photobooth/film/instSq';
import { analyzeCanvas, normalizeHistogram } from '@/lib/photobooth/film';
import { STUDIO_BATCH_IMAGES } from '@/lib/photobooth/film/studioBatchImages';
import styles from './studio.module.css';

type SliderDef = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  section: string;
  get: (r: InstSQRecipe) => number;
  set: (r: InstSQRecipe, v: number) => InstSQRecipe;
};

function cloneRecipe(r: InstSQRecipe): InstSQRecipe {
  return JSON.parse(JSON.stringify(r)) as InstSQRecipe;
}

const SLIDERS: SliderDef[] = [
  { key: 'temperature', label: 'Temperature', min: -30, max: 10, step: 1, section: 'Grade', get: (r) => r.grade.temperature, set: (r, v) => ({ ...r, grade: { ...r.grade, temperature: v } }) },
  { key: 'tint', label: 'Tint', min: -20, max: 10, step: 1, section: 'Grade', get: (r) => r.grade.tint, set: (r, v) => ({ ...r, grade: { ...r.grade, tint: v } }) },
  { key: 'contrast', label: 'Contrast', min: 0.55, max: 1, step: 0.01, section: 'Grade', get: (r) => r.grade.contrast, set: (r, v) => ({ ...r, grade: { ...r.grade, contrast: v } }) },
  { key: 'saturation', label: 'Saturation', min: 0.4, max: 1, step: 0.01, section: 'Grade', get: (r) => r.grade.saturation, set: (r, v) => ({ ...r, grade: { ...r.grade, saturation: v } }) },
  { key: 'fade', label: 'Fade / Matte', min: 0, max: 0.35, step: 0.01, section: 'Grade', get: (r) => r.grade.fade, set: (r, v) => ({ ...r, grade: { ...r.grade, fade: v } }) },
  { key: 'greenTeal', label: 'Green → Teal', min: 0, max: 1, step: 0.02, section: 'Color', get: (r) => r.colorMapping.greenTealShift, set: (r, v) => ({ ...r, colorMapping: { ...r.colorMapping, greenTealShift: v } }) },
  { key: 'blueCyan', label: 'Blue → Dusty Cyan', min: 0, max: 1, step: 0.02, section: 'Color', get: (r) => r.colorMapping.blueCyanShift, set: (r, v) => ({ ...r, colorMapping: { ...r.colorMapping, blueCyanShift: v } }) },
  { key: 'pinkRose', label: 'Pink → Dusty Rose', min: 0, max: 1, step: 0.02, section: 'Color', get: (r) => r.colorMapping.pinkRoseShift, set: (r, v) => ({ ...r, colorMapping: { ...r.colorMapping, pinkRoseShift: v } }) },
  { key: 'hlCompress', label: 'Highlight Compression', min: 0, max: 1, step: 0.02, section: 'Tonal', get: (r) => r.tonal.highlightCompression, set: (r, v) => ({ ...r, tonal: { ...r.tonal, highlightCompression: v } }) },
  { key: 'shadowLift', label: 'Shadow Lift', min: 0, max: 0.3, step: 0.01, section: 'Tonal', get: (r) => r.tonal.shadowLift, set: (r, v) => ({ ...r, tonal: { ...r.tonal, shadowLift: v } }) },
  { key: 'shadowBlue', label: 'Shadow Blue-Gray', min: 0, max: 1, step: 0.02, section: 'Tonal', get: (r) => r.tonal.shadowBlueAmount, set: (r, v) => ({ ...r, tonal: { ...r.tonal, shadowBlueAmount: v } }) },
  { key: 'microContrast', label: 'Micro-contrast ↓', min: 0, max: 1, step: 0.02, section: 'Plastic Lens', get: (r) => r.plasticLens.microContrastReduction, set: (r, v) => ({ ...r, plasticLens: { ...r.plasticLens, microContrastReduction: v } }) },
  { key: 'optical', label: 'Optical Softness', min: 0, max: 1, step: 0.02, section: 'Plastic Lens', get: (r) => r.plasticLens.opticalSoftness, set: (r, v) => ({ ...r, plasticLens: { ...r.plasticLens, opticalSoftness: v } }) },
  { key: 'edgeSoft', label: 'Edge Softness', min: 0, max: 1, step: 0.02, section: 'Plastic Lens', get: (r) => r.plasticLens.edgeSoftness, set: (r, v) => ({ ...r, plasticLens: { ...r.plasticLens, edgeSoftness: v } }) },
  { key: 'dofStrength', label: 'Focus Falloff', min: 0, max: 1, step: 0.02, section: 'Optical DOF', get: (r) => r.opticalFalloff.strength, set: (r, v) => ({ ...r, opticalFalloff: { ...r.opticalFalloff, strength: v } }) },
  { key: 'focusY', label: 'Focus Plane Y', min: 0.2, max: 0.75, step: 0.01, section: 'Optical DOF', get: (r) => r.opticalFalloff.focusCenterY, set: (r, v) => ({ ...r, opticalFalloff: { ...r.opticalFalloff, focusCenterY: v } }) },
  { key: 'focusBand', label: 'Focus Band', min: 0.15, max: 0.65, step: 0.01, section: 'Optical DOF', get: (r) => r.opticalFalloff.focusBandHeight, set: (r, v) => ({ ...r, opticalFalloff: { ...r.opticalFalloff, focusBandHeight: v } }) },
  { key: 'fgBlur', label: 'Foreground Blur', min: 0, max: 40, step: 1, section: 'Optical DOF', get: (r) => r.opticalFalloff.foregroundBlur, set: (r, v) => ({ ...r, opticalFalloff: { ...r.opticalFalloff, foregroundBlur: v } }) },
  { key: 'bgBlur', label: 'Background Blur', min: 0, max: 40, step: 1, section: 'Optical DOF', get: (r) => r.opticalFalloff.backgroundBlur, set: (r, v) => ({ ...r, opticalFalloff: { ...r.opticalFalloff, backgroundBlur: v } }) },
  { key: 'fgReach', label: 'Foreground Reach', min: 0.1, max: 0.55, step: 0.01, section: 'Optical DOF', get: (r) => r.opticalFalloff.foregroundReach, set: (r, v) => ({ ...r, opticalFalloff: { ...r.opticalFalloff, foregroundReach: v } }) },
  { key: 'bgReach', label: 'Background Reach', min: 0.1, max: 0.55, step: 0.01, section: 'Optical DOF', get: (r) => r.opticalFalloff.backgroundReach, set: (r, v) => ({ ...r, opticalFalloff: { ...r.opticalFalloff, backgroundReach: v } }) },
  { key: 'fieldCurv', label: 'Field Curvature', min: 0, max: 20, step: 1, section: 'Optical DOF', get: (r) => r.opticalFalloff.fieldCurvature, set: (r, v) => ({ ...r, opticalFalloff: { ...r.opticalFalloff, fieldCurvature: v } }) },
  { key: 'cyanAtmo', label: 'Cyan Atmosphere', min: 0, max: 1, step: 0.02, section: 'Atmosphere', get: (r) => r.atmosphere.cyanStrength, set: (r, v) => ({ ...r, atmosphere: { ...r.atmosphere, cyanStrength: v } }) },
  { key: 'shadowBlueAtmo', label: 'Shadow Blue Boost', min: 0, max: 1, step: 0.02, section: 'Atmosphere', get: (r) => r.atmosphere.shadowBlueBoost, set: (r, v) => ({ ...r, atmosphere: { ...r.atmosphere, shadowBlueBoost: v } }) },
  { key: 'emulsion', label: 'Emulsion Texture', min: 0, max: 0.2, step: 0.005, section: 'Texture', get: (r) => r.textures.emulsionOpacity, set: (r, v) => ({ ...r, textures: { ...r.textures, emulsionOpacity: v } }) },
  { key: 'grain', label: 'Film Grain', min: 0, max: 40, step: 1, section: 'Texture', get: (r) => r.textures.grainAmount, set: (r, v) => ({ ...r, textures: { ...r.textures, grainAmount: v } }) },
  { key: 'grainSize', label: 'Grain Size', min: 2, max: 7, step: 0.1, section: 'Texture', get: (r) => r.textures.grainSize, set: (r, v) => ({ ...r, textures: { ...r.textures, grainSize: v } }) },
  { key: 'dust', label: 'Dust', min: 0, max: 0.12, step: 0.005, section: 'Texture', get: (r) => r.textures.dustOpacity, set: (r, v) => ({ ...r, textures: { ...r.textures, dustOpacity: v } }) },
  { key: 'scratch', label: 'Scratches', min: 0, max: 0.1, step: 0.005, section: 'Texture', get: (r) => r.textures.scratchOpacity, set: (r, v) => ({ ...r, textures: { ...r.textures, scratchOpacity: v } }) },
  { key: 'veil', label: 'Cold Veil', min: 0, max: 0.12, step: 0.005, section: 'Atmosphere', get: (r) => r.veil.opacity, set: (r, v) => ({ ...r, veil: { ...r.veil, opacity: v } }) },
  { key: 'bloom', label: 'Highlight Bloom', min: 0, max: 0.35, step: 0.01, section: 'Atmosphere', get: (r) => r.bloom.intensity, set: (r, v) => ({ ...r, bloom: { ...r.bloom, intensity: v } }) },
  { key: 'halation', label: 'Halation', min: 0, max: 0.2, step: 0.01, section: 'Atmosphere', get: (r) => r.halation.intensity, set: (r, v) => ({ ...r, halation: { ...r.halation, intensity: v } }) },
  { key: 'vignette', label: 'Vignette', min: 0, max: 0.3, step: 0.01, section: 'Atmosphere', get: (r) => r.vignette.strength, set: (r, v) => ({ ...r, vignette: { ...r.vignette, strength: v } }) },
  { key: 'motionAmt', label: 'Motion Blur', min: 0, max: 1, step: 0.02, section: 'Motion', get: (r) => r.motionBlur.amount, set: (r, v) => ({ ...r, motionBlur: { ...r.motionBlur, amount: v } }) },
  { key: 'motionDist', label: 'Motion Distance', min: 0, max: 28, step: 1, section: 'Motion', get: (r) => r.motionBlur.distance, set: (r, v) => ({ ...r, motionBlur: { ...r.motionBlur, distance: v } }) },
  { key: 'motionCenter', label: 'Sharp Center', min: 0.15, max: 0.55, step: 0.01, section: 'Motion', get: (r) => r.motionBlur.centerRadius, set: (r, v) => ({ ...r, motionBlur: { ...r.motionBlur, centerRadius: v } }) },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (src.startsWith('http')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function Histogram({ histogram, label }: { histogram: Uint32Array | null; label: string }) {
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
    ctx.fillStyle = 'rgba(140, 165, 185, 0.85)';
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

export default function InstSQStudio() {
  const [recipe, setRecipe] = useState<InstSQRecipe>(() => cloneRecipe(INST_SQ_RECIPE));
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [origStats, setOrigStats] = useState<ImageStats | null>(null);
  const [procStats, setProcStats] = useState<ImageStats | null>(null);
  const [comparePosition, setComparePosition] = useState(50);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runProcess = useCallback(async (url: string, current: InstSQRecipe) => {
    setProcessing(true);
    try {
      const img = await loadImage(url);
      const maxDim = 900;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (Math.max(w, h) > maxDim) {
        const s = maxDim / Math.max(w, h);
        w = Math.round(w * s);
        h = Math.round(h * s);
      }
      const origCanvas = document.createElement('canvas');
      origCanvas.width = w;
      origCanvas.height = h;
      const oCtx = origCanvas.getContext('2d');
      if (!oCtx) return;
      oCtx.drawImage(img, 0, 0, w, h);
      setOrigStats(analyzeCanvas(origCanvas));

      const procCanvas = document.createElement('canvas');
      procCanvas.width = w;
      procCanvas.height = h;
      const pCtx = procCanvas.getContext('2d');
      if (!pCtx) return;
      pCtx.drawImage(img, 0, 0, w, h);
      const result = applyInstSQFilter(procCanvas, current);
      setProcStats(analyzeCanvas(procCanvas));
      if (result) void result;
      setProcessedUrl(procCanvas.toDataURL('image/jpeg', 0.92));
    } finally {
      setProcessing(false);
    }
  }, []);

  useEffect(() => {
    if (!sourceUrl) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runProcess(sourceUrl, recipe), 180);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sourceUrl, recipe, runProcess]);

  const sections = [...new Set(SLIDERS.map((s) => s.section))];

  return (
    <div className={styles.studioRoot}>
      <header className={styles.studioHeader}>
        <div>
          <h1 className={styles.studioTitle}>Inst SQ Filter Studio</h1>
          <p className={styles.studioSub}>Cold square instant film — independent from Inst C</p>
        </div>
        <div className={styles.studioActions}>
          <button type="button" className={styles.studioBtn} onClick={() => setRecipe(cloneRecipe(INST_SQ_RECIPE))}>
            Reset recipe
          </button>
          <button
            type="button"
            className={styles.studioBtn}
            onClick={() => {
              const blob = new Blob([exportInstSQRecipeJson(recipe)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'inst-sq-recipe.json';
              a.click();
            }}
          >
            Export JSON
          </button>
        </div>
      </header>

      <div className={styles.studioLayout}>
        <aside className={styles.controlsPanel}>
          <button type="button" className={styles.uploadBtn} onClick={() => fileRef.current?.click()}>
            Upload test image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const url = URL.createObjectURL(f);
              setSourceUrl(url);
              setOriginalUrl(url);
            }}
          />
          <div className={styles.batchThumbs}>
            {STUDIO_BATCH_IMAGES.map((src) => (
              <button
                key={src}
                type="button"
                className={styles.batchThumb}
                onClick={() => {
                  setSourceUrl(src);
                  setOriginalUrl(src);
                }}
              >
                <img src={src} alt="" />
              </button>
            ))}
          </div>
          {sections.map((section) => (
            <div key={section} className={styles.controlSection}>
              <h3>{section}</h3>
              {SLIDERS.filter((s) => s.section === section).map((sl) => (
                <label key={sl.key} className={styles.sliderRow}>
                  <span>{sl.label}</span>
                  <input
                    type="range"
                    min={sl.min}
                    max={sl.max}
                    step={sl.step}
                    value={sl.get(recipe)}
                    onChange={(e) => setRecipe(sl.set(recipe, parseFloat(e.target.value)))}
                  />
                  <span className={styles.sliderVal}>{sl.get(recipe).toFixed(2)}</span>
                </label>
              ))}
            </div>
          ))}
          <textarea
            className={styles.jsonArea}
            rows={6}
            defaultValue={exportInstSQRecipeJson(INST_SQ_RECIPE)}
            onBlur={(e) => {
              try {
                setRecipe(parseInstSQRecipeJson(e.target.value));
              } catch {
                /* ignore invalid json */
              }
            }}
          />
        </aside>

        <main className={styles.previewPanel}>
          {processing && <p className={styles.processing}>Processing…</p>}
          {originalUrl && processedUrl ? (
            <div className={styles.abCompare}>
              <div className={styles.abSliderWrap}>
                <img src={originalUrl} alt="Original" className={styles.abImg} draggable={false} />
                <div className={styles.abProcessedClip} style={{ clipPath: `inset(0 0 0 ${comparePosition}%)` }}>
                  <img src={processedUrl} alt="Inst SQ" className={styles.abImg} draggable={false} />
                </div>
                <div className={styles.abDivider} style={{ left: `${comparePosition}%` }} />
                <input
                  type="range"
                  min={2}
                  max={98}
                  value={comparePosition}
                  className={styles.abSliderInput}
                  onChange={(e) => setComparePosition(parseFloat(e.target.value))}
                />
              </div>
              <div className={styles.abLabels}>
                <span>Original</span>
                <span>Inst SQ</span>
              </div>
            </div>
          ) : (
            <p className={styles.statsEmpty}>Upload or pick a sample image to preview Inst SQ.</p>
          )}
          <div className={styles.histogramRow}>
            <Histogram histogram={origStats?.histogram ?? null} label="Input" />
            <Histogram histogram={procStats?.histogram ?? null} label="Inst SQ" />
          </div>
        </main>
      </div>
    </div>
  );
}
