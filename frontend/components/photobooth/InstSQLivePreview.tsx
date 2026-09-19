'use client';

import { useCallback, useEffect, useRef } from 'react';
import styles from '@/app/photobooth/page.module.css';
import { subscribeInstSQPreview } from '@/lib/photobooth/film/instSq/InstSQPreview';
import { primeVideoForCanvasCapture } from '@/lib/photobooth/film/platform';

type SourceRef = React.RefObject<HTMLVideoElement | HTMLImageElement | null>;

type InstSQLivePreviewProps = {
  sourceRef: SourceRef;
  mirror?: boolean;
  className?: string;
  active?: boolean;
};

/** Inst SQ canvas live preview — isolated engine, not shared with Inst C. */
export function InstSQLivePreview({
  sourceRef,
  mirror = false,
  className,
  active = true,
}: InstSQLivePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;

    let unsubscribe: (() => void) | undefined;
    let retryId = 0;
    let cancelled = false;
    let videoListener: (() => void) | null = null;

    const trySubscribe = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const src = sourceRef.current;
      if (!canvas || !src) {
        retryId = requestAnimationFrame(trySubscribe);
        return;
      }

      if (src instanceof HTMLVideoElement) {
        primeVideoForCanvasCapture(src);
        const onReady = () => {
          if (cancelled) return;
          unsubscribe?.();
          unsubscribe = subscribeInstSQPreview(canvas, src, mirror);
        };
        if (src.videoWidth > 0 && src.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          onReady();
        } else {
          videoListener = onReady;
          src.addEventListener('loadeddata', onReady, { once: true });
          src.addEventListener('canplay', onReady, { once: true });
        }
        return;
      }

      unsubscribe = subscribeInstSQPreview(canvas, src, mirror);
    };

    trySubscribe();

    return () => {
      cancelled = true;
      cancelAnimationFrame(retryId);
      const src = sourceRef.current;
      if (src instanceof HTMLVideoElement && videoListener) {
        src.removeEventListener('loadeddata', videoListener);
        src.removeEventListener('canplay', videoListener);
      }
      unsubscribe?.();
    };
  }, [sourceRef, mirror, active]);

  return (
    <canvas
      ref={canvasRef}
      className={`${className ?? ''} ${styles.cameraVideoCanvas}`.trim()}
      aria-hidden
    />
  );
}
