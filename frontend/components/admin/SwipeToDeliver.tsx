'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './SwipeToDeliver.module.css';

/** Treat as full swipe when within this many px of the end. */
const SWIPE_END_TOLERANCE_PX = 4;

type Props = {
  disabled: boolean;
  label: string;
  onConfirm: () => void | Promise<void>;
};

export default function SwipeToDeliver({ disabled, label, onConfirm }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const dragXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const [successLocked, setSuccessLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const maxDrag = useCallback(() => {
    const el = trackRef.current;
    if (!el) return 0;
    const knob = 48;
    return Math.max(0, el.clientWidth - knob - 12);
  }, []);

  useEffect(() => {
    dragXRef.current = dragX;
  }, [dragX]);

  useEffect(() => {
    if (disabled) {
      setDragX(0);
      dragXRef.current = 0;
      isDraggingRef.current = false;
      setSuccessLocked(false);
      setBusy(false);
    }
  }, [disabled]);

  const progress = (() => {
    const max = maxDrag();
    return max > 0 ? Math.min(1, dragX / max) : 0;
  })();

  const proximityReady = !disabled && !busy && !successLocked;

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || busy || successLocked) return;
    e.preventDefault();
    (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    startXRef.current = e.clientX - dragXRef.current;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingRef.current || disabled || busy || successLocked) return;
    const max = maxDrag();
    const x = Math.max(0, Math.min(max, e.clientX - startXRef.current));
    dragXRef.current = x;
    setDragX(x);
  };

  const finishDrag = async (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingRef.current || disabled || busy || successLocked) return;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const max = maxDrag();
    const lastX = dragXRef.current;
    const atEnd = max > 0 && lastX >= max - SWIPE_END_TOLERANCE_PX;
    if (atEnd) {
      setDragX(max);
      dragXRef.current = max;
      setSuccessLocked(true);
      setBusy(true);
      try {
        await Promise.resolve(onConfirm());
      } catch {
        /* parent shows error; reset swipe */
      } finally {
        setSuccessLocked(false);
        setBusy(false);
        dragXRef.current = 0;
        setDragX(0);
      }
    } else {
      dragXRef.current = 0;
      setDragX(0);
    }
  };

  return (
    <div className={styles.swipeStack}>
      {successLocked ? (
        <div className={styles.doneBanner} role="status">
          Done
        </div>
      ) : null}
      <div
        ref={trackRef}
        className={`${styles.track} ${disabled ? styles.trackDisabled : ''} ${proximityReady ? styles.trackProximityReady : ''} ${successLocked ? styles.trackSuccessLocked : ''}`}
        style={{ '--swipe-progress': String(progress) } as React.CSSProperties}
      >
        <div className={styles.trackBg}>
          <span className={styles.trackLabel}>{successLocked ? '' : label}</span>
        </div>
        <div
          className={styles.fill}
          style={{ width: successLocked ? '100%' : `${dragX + 52}px` }}
        />
        <button
          type="button"
          className={`${styles.knob} ${successLocked ? styles.knobSuccess : ''}`}
          disabled={disabled || busy}
          style={{ transform: `translateX(${dragX}px)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={() => {
            isDraggingRef.current = false;
            if (!busy && !successLocked) {
              dragXRef.current = 0;
              setDragX(0);
            }
          }}
          aria-label={label}
        >
          <svg
            className={`${styles.knobIcon} ${styles.knobChevrons}`}
            viewBox="-46.09 -46.09 604.27 604.27"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              className={styles.knobIconPath}
              fill="currentColor"
              stroke="currentColor"
              strokeWidth={68}
              strokeLinejoin="round"
              strokeLinecap="round"
              d="M263.641,248.4L18.308,3.067c-4.16-4.053-10.987-3.947-15.04,0.32c-3.947,4.16-3.947,10.667,0,14.827l237.76,237.76 L3.268,493.733c-4.267,4.053-4.373,10.88-0.213,15.04c4.16,4.16,10.88,4.373,15.04,0.213c0.107-0.107,0.213-0.213,0.213-0.213 L263.641,263.44C267.801,259.28,267.801,252.56,263.641,248.4z"
            />
            <path
              className={styles.knobIconPath}
              fill="currentColor"
              stroke="currentColor"
              strokeWidth={68}
              strokeLinejoin="round"
              strokeLinecap="round"
              d="M508.974,248.4L263.641,3.067c-4.267-4.053-10.987-3.947-15.04,0.213c-3.947,4.16-3.947,10.667,0,14.827l237.76,237.76 l-237.76,237.867c-4.267,4.053-4.373,10.88-0.213,15.04c4.16,4.16,10.88,4.373,15.04,0.213c0.107-0.107,0.213-0.213,0.213-0.213 L508.974,263.44C513.135,259.28,513.135,252.56,508.974,248.4z"
            />
          </svg>
          <svg
            className={`${styles.knobIcon} ${styles.knobTick}`}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              d="M20 6L9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
