'use client';

import type { MouseEvent as ReactMouseEvent } from 'react';
import PbCropIcon from '../PbCropIcon';
import styles from '../../ProductDetailsModal.module.css';

type PbTipHandlers = {
  onMouseEnter: (e: ReactMouseEvent) => void;
  onMouseMove?: (e: ReactMouseEvent) => void;
  onMouseLeave: () => void;
};

type PbCanvasObjectToolbarProps = {
  visible: boolean;
  top: number;
  left: number;
  fillColor: string;
  locked: boolean;
  showColor: boolean;
  showCrop: boolean;
  cropActive: boolean;
  pbTip?: (text: string) => PbTipHandlers;
  onFillColorChange: (color: string) => void;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCrop: () => void;
  onApplyCrop: () => void;
};

export default function PbCanvasObjectToolbar({
  visible,
  top,
  left,
  fillColor,
  locked,
  showColor,
  showCrop,
  cropActive,
  pbTip,
  onFillColorChange,
  onToggleLock,
  onDuplicate,
  onDelete,
  onCrop,
  onApplyCrop,
}: PbCanvasObjectToolbarProps) {
  if (!visible) return null;

  const tip = (text: string) => (pbTip ? pbTip(text) : {});

  if (cropActive) {
    return (
      <div
        className={`${styles.pbFabricObjectToolbar} ${styles.pbFabricObjectToolbarCrop}`}
        style={{ top, left }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.pbFabricToolbarCropApply}
          onClick={onApplyCrop}
          title="Apply crop"
          aria-label="Apply crop"
          {...tip('Apply crop')}
        >
          <PbCropIcon size={15} />
          <span>Apply crop</span>
        </button>
      </div>
    );
  }

  if (locked) {
    return (
      <div
        className={styles.pbFabricObjectToolbar}
        style={{ top, left }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.pbFabricToolbarBtn}
          onClick={onToggleLock}
          title="Unlock"
          aria-label="Unlock"
          aria-pressed
          {...tip('Unlock')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 018 0v3" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      className={styles.pbFabricObjectToolbar}
      style={{ top, left }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {showColor ? (
        <label className={styles.pbFabricToolbarColorBtn} title="Change color" {...tip('Change color')}>
          <input
            type="color"
            value={fillColor}
            onChange={(e) => onFillColorChange(e.target.value)}
            aria-label="Object color"
          />
        </label>
      ) : null}
      {showCrop ? (
        <button
          type="button"
          className={styles.pbFabricToolbarBtn}
          onClick={onCrop}
          title="Crop image"
          aria-label="Crop image"
          {...tip('Crop image')}
        >
          <PbCropIcon />
        </button>
      ) : null}
      <button type="button" className={styles.pbFabricToolbarBtn} onClick={onToggleLock} title="Lock" aria-label="Lock" {...tip('Lock')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 118 0v4" />
        </svg>
      </button>
      <button type="button" className={styles.pbFabricToolbarBtn} onClick={onDuplicate} title="Duplicate" aria-label="Duplicate" {...tip('Duplicate')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M4 16V6a2 2 0 012-2h10" />
        </svg>
      </button>
      <button type="button" className={styles.pbFabricToolbarBtn} onClick={onDelete} title="Delete" aria-label="Delete" {...tip('Delete')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      </button>
    </div>
  );
}
