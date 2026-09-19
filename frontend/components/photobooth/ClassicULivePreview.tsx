'use client';

import { useCallback, useEffect, useRef } from 'react';
import styles from '@/app/photobooth/page.module.css';
import { subscribeClassicUPreview } from '@/lib/photobooth/film/classicU/ClassicUPreview';
import { primeVideoForCanvasCapture } from '@/lib/photobooth/film/platform';

type SourceRef = React.RefObject<HTMLVideoElement | HTMLImageElement | null>;

type ClassicULivePreviewProps = {
  sourceRef: SourceRef;
  mirror?: boolean;
  className?: string;
  active?: boolean;
};

/** Classic U WebGL live preview — isolated GPU engine. */
export function ClassicULivePreview({
  sourceRef,
  mirror = false,
  className,
  active = true,
}: ClassicULivePreviewProps) {
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
          unsubscribe = subscribeClassicUPreview(canvas, src, mirror);
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

      unsubscribe = subscribeClassicUPreview(canvas, src, mirror);
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
