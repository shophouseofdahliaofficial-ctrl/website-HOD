'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PbFrameCrop } from './canvas/frameMeta';
import styles from '../ProductDetailsModal.module.css';

export type PbFrameCropModalProps = {
  open: boolean;
  sourceUrl: string;
  frameWidth: number;
  frameHeight: number;
  naturalWidth: number;
  naturalHeight: number;
  initialCrop: PbFrameCrop;
  onApply: (crop: PbFrameCrop) => void;
  onCancel: () => void;
};

const PREVIEW_MAX = 420;

function computeCoverBaseScale(imgW: number, imgH: number, frameW: number, frameH: number) {
  return Math.max(frameW / imgW, frameH / imgH);
}

export default function PbFrameCropModal({
  open,
  sourceUrl,
  frameWidth,
  frameHeight,
  naturalWidth,
  naturalHeight,
  initialCrop,
  onApply,
  onCancel,
}: PbFrameCropModalProps) {
  const [crop, setCrop] = useState<PbFrameCrop>(initialCrop);
  const [imageLoaded, setImageLoaded] = useState(false);
  const savedCropRef = useRef<PbFrameCrop>(initialCrop);
  const dragRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);

  useEffect(() => {
    if (open) {
      const c = { ...initialCrop };
      savedCropRef.current = c;
      setCrop(c);
      dragRef.current = null;
    }
  }, [open, initialCrop]);

  useEffect(() => {
    if (!open || !sourceUrl) {
      setImageLoaded(false);
      return;
    }
    setImageLoaded(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const markLoaded = () => setImageLoaded(true);
    img.onload = markLoaded;
    img.onerror = markLoaded;
    img.src = sourceUrl;
    if (img.complete && img.naturalWidth > 0) {
      markLoaded();
    }
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [open, sourceUrl]);

  const aspect = frameWidth / frameHeight;
  const previewW = aspect >= 1 ? PREVIEW_MAX : PREVIEW_MAX * aspect;
  const previewH = aspect >= 1 ? PREVIEW_MAX / aspect : PREVIEW_MAX;
  const scaleFactor = previewW / frameWidth;

  const baseScale = computeCoverBaseScale(naturalWidth, naturalHeight, frameWidth, frameHeight);
  const displayScale = baseScale * crop.scale * scaleFactor;
  const imgDisplayW = naturalWidth * displayScale;
  const imgDisplayH = naturalHeight * displayScale;
  const offsetXDisplay = crop.offsetX * scaleFactor;
  const offsetYDisplay = crop.offsetY * scaleFactor;

  const clampOffsets = useCallback(
    (next: PbFrameCrop): PbFrameCrop => {
      const s = baseScale * next.scale;
      const sw = naturalWidth * s;
      const sh = naturalHeight * s;
      const maxOffX = Math.max(0, (sw - frameWidth) / 2);
      const maxOffY = Math.max(0, (sh - frameHeight) / 2);
      return {
        scale: next.scale,
        offsetX: Math.max(-maxOffX, Math.min(maxOffX, next.offsetX)),
        offsetY: Math.max(-maxOffY, Math.min(maxOffY, next.offsetY)),
      };
    },
    [baseScale, frameWidth, frameHeight, naturalWidth, naturalHeight],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: crop.offsetX,
      startOffsetY: crop.offsetY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / scaleFactor;
    const dy = (e.clientY - drag.startY) / scaleFactor;
    const nextOffsetX = drag.startOffsetX + dx;
    const nextOffsetY = drag.startOffsetY + dy;
    setCrop((prev: PbFrameCrop) =>
      clampOffsets({
        ...prev,
        offsetX: nextOffsetX,
        offsetY: nextOffsetY,
      }),
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer may already be released */
    }
  };

  const handleReset = () => {
    setCrop({ scale: 1, offsetX: 0, offsetY: 0 });
  };

  const handleCancel = () => {
    onCancel();
  };

  const handleApply = () => {
    onApply(crop);
  };

  if (!open) return null;

  return (
    <div
      className={styles.pbFrameCropOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pb-frame-crop-title"
      onClick={handleCancel}
    >
      <div className={styles.pbFrameCropDialog} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.pbFrameCropCloseBtn}
          onClick={handleCancel}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
        <h3 id="pb-frame-crop-title" className={styles.pbFrameCropTitle}>
          Edit photo
        </h3>
        <p className={styles.pbFrameCropDesc}>Drag to reposition the image inside the frame.</p>

        <div
          className={styles.pbFrameCropPreview}
          style={{ width: previewW, height: previewH, pointerEvents: imageLoaded ? undefined : 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <img
            src={sourceUrl}
            alt=""
            draggable={false}
            className={styles.pbFrameCropGhost}
            style={{
              width: imgDisplayW,
              height: imgDisplayH,
              left: previewW / 2 + offsetXDisplay - imgDisplayW / 2,
              top: previewH / 2 + offsetYDisplay - imgDisplayH / 2,
              opacity: imageLoaded ? 0.35 : 0,
            }}
          />
          <div
            className={`${styles.pbFrameCropClip} ${!imageLoaded ? styles.pbFrameCropClipLoading : ''}`}
            style={{ width: previewW, height: previewH }}
          >
            {!imageLoaded ? <div className={styles.pbFrameCropClipShimmer} aria-hidden="true" /> : null}
            <img
              src={sourceUrl}
              alt=""
              draggable={false}
              className={styles.pbFrameCropClipImage}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
              style={{
                width: imgDisplayW,
                height: imgDisplayH,
                left: previewW / 2 + offsetXDisplay - imgDisplayW / 2,
                top: previewH / 2 + offsetYDisplay - imgDisplayH / 2,
                opacity: imageLoaded ? 1 : 0,
              }}
            />
          </div>
        </div>

        <div className={styles.pbFrameCropActions}>
          <label className={styles.pbFrameCropZoomControl}>
            <span className={styles.pbFrameCropZoomSymbol} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
                <path d="M11 8v6M8 11h6" />
              </svg>
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={crop.scale}
              onChange={(e) =>
                setCrop((prev: PbFrameCrop) => clampOffsets({ ...prev, scale: parseFloat(e.target.value) }))
              }
              className={styles.pbFrameCropZoomSlider}
              aria-label="Zoom"
            />
            <span className={styles.pbFrameCropZoomValue}>{Math.round(crop.scale * 100)}%</span>
          </label>

          <div className={styles.pbFrameCropActionsBtns}>
            <button type="button" className={styles.pbFrameCropBtnSecondary} onClick={handleReset}>
              Reset
            </button>
            <button type="button" className={styles.pbFrameCropBtnPrimary} onClick={handleApply}>
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
