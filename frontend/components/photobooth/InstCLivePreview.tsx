'use client';

import { useCallback, useEffect, useRef } from 'react';
import styles from '@/app/photobooth/page.module.css';
import { subscribeInstCPreview } from '@/lib/photobooth/film/instCPreviewEngine';
import { isInstSQFilter } from '@/lib/photobooth/film/instSq';
import { isInstSQCFilter } from '@/lib/photobooth/film/instSqc';
import { isClassicUFilter } from '@/lib/photobooth/film/classicU';
import { InstSQLivePreview } from '@/components/photobooth/InstSQLivePreview';
import { InstSQCLivePreview } from '@/components/photobooth/InstSQCLivePreview';
import { ClassicULivePreview } from '@/components/photobooth/ClassicULivePreview';
import { primeVideoForCanvasCapture } from '@/lib/photobooth/film/platform';

type SourceRef = React.RefObject<HTMLVideoElement | HTMLImageElement | null>;

type InstCLivePreviewProps = {
  sourceRef: SourceRef;
  mirror?: boolean;
  className?: string;
  active?: boolean;
};

/** Canvas live preview — single shared engine, stable filtered output. */
export function InstCLivePreview({
  sourceRef,
  mirror = false,
  className,
  active = true,
}: InstCLivePreviewProps) {
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
          unsubscribe = subscribeInstCPreview(canvas, src, mirror);
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

      unsubscribe = subscribeInstCPreview(canvas, src, mirror);
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

type LiveCameraFeedProps = {
  filterId: string;
  filterCss: string;
  mirror?: boolean;
  className?: string;
  cameraStream?: MediaStream | null;
  setVideoRef?: (node: HTMLVideoElement | null) => void;
  attachStream?: boolean;
  /** When false, skips canvas filter loop (use for duplicate stack slots). */
  previewActive?: boolean;
};

/** Video feed with Inst C canvas preview or CSS filter for other filters. */
export function LiveCameraFeed({
  filterId,
  filterCss,
  mirror = false,
  className,
  cameraStream,
  setVideoRef,
  attachStream = true,
  previewActive = true,
}: LiveCameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isInstC = filterId === 'retro';
  const isInstSQ = isInstSQFilter(filterId);
  const isInstSQC = isInstSQCFilter(filterId);
  const isClassicU = isClassicUFilter(filterId);
  const isCanvasFilter = isInstC || isInstSQ || isInstSQC || isClassicU;
  const showCanvasPreview = isCanvasFilter && previewActive;
  const showCssFallback = isCanvasFilter && !previewActive;

  const refCallback = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node) {
        primeVideoForCanvasCapture(node);
      }
      setVideoRef?.(node);
    },
    [setVideoRef],
  );

  useEffect(() => {
    if (!attachStream) return;
    const video = videoRef.current;
    if (video && cameraStream && video.srcObject !== cameraStream) {
      video.srcObject = cameraStream;
      primeVideoForCanvasCapture(video);
    }
  }, [cameraStream, attachStream]);

  return (
    <div className={styles.cameraFeedLayer}>
      <video
        ref={refCallback}
        autoPlay
        playsInline
        muted
        className={
          showCanvasPreview
            ? `${className ?? ''} ${styles.cameraVideoSource}`.trim()
            : className
        }
        draggable={false}
        style={{
          filter: showCssFallback ? filterCss : isCanvasFilter ? undefined : filterCss,
          transform: mirror ? 'scaleX(-1)' : undefined,
        }}
      />
      {showCanvasPreview && isInstC && (
        <InstCLivePreview
          sourceRef={videoRef}
          mirror={mirror}
          className={className}
          active={previewActive}
        />
      )}
      {showCanvasPreview && isInstSQ && (
        <InstSQLivePreview
          sourceRef={videoRef}
          mirror={mirror}
          className={className}
          active={previewActive}
        />
      )}
      {showCanvasPreview && isInstSQC && (
        <InstSQCLivePreview
          sourceRef={videoRef}
          mirror={mirror}
          className={className}
          active={previewActive}
        />
      )}
      {showCanvasPreview && isClassicU && (
        <ClassicULivePreview
          sourceRef={videoRef}
          mirror={mirror}
          className={className}
          active={previewActive}
        />
      )}
    </div>
  );
}

type DemoFeedPreviewProps = {
  filterId: string;
  filterCss: string;
  src: string;
  className?: string;
  crossOrigin?: '' | 'anonymous' | 'use-credentials';
  onLoad?: (img: HTMLImageElement) => void;
  imgRef?: React.RefObject<HTMLImageElement | null>;
  previewActive?: boolean;
};

/** Demo/sample image feed with matching Inst C canvas preview. */
export function DemoFeedPreview({
  filterId,
  filterCss,
  src,
  className,
  crossOrigin,
  onLoad,
  imgRef: externalImgRef,
  previewActive = true,
}: DemoFeedPreviewProps) {
  const internalImgRef = useRef<HTMLImageElement | null>(null);
  const imgRef = externalImgRef ?? internalImgRef;
  const isInstC = filterId === 'retro';
  const isInstSQ = isInstSQFilter(filterId);
  const isInstSQC = isInstSQCFilter(filterId);
  const isClassicU = isClassicUFilter(filterId);
  const isCanvasFilter = isInstC || isInstSQ || isInstSQC || isClassicU;
  const showCanvasPreview = isCanvasFilter && previewActive;
  const showCssFallback = isCanvasFilter && !previewActive;

  return (
    <div className={styles.cameraFeedLayer}>
      <img
        ref={imgRef as React.RefObject<HTMLImageElement>}
        src={src}
        alt=""
        className={
          showCanvasPreview
            ? `${className ?? ''} ${styles.cameraVideoSource}`.trim()
            : className
        }
        draggable={false}
        crossOrigin={crossOrigin}
        onLoad={(e) => onLoad?.(e.currentTarget)}
        style={{
          filter: showCssFallback ? filterCss : isCanvasFilter ? undefined : filterCss,
        }}
      />
      {showCanvasPreview && isInstC && (
        <InstCLivePreview sourceRef={imgRef} className={className} active={previewActive} />
      )}
      {showCanvasPreview && isInstSQ && (
        <InstSQLivePreview sourceRef={imgRef} className={className} active={previewActive} />
      )}
      {showCanvasPreview && isInstSQC && (
        <InstSQCLivePreview sourceRef={imgRef} className={className} active={previewActive} />
      )}
      {showCanvasPreview && isClassicU && (
        <ClassicULivePreview sourceRef={imgRef} className={className} active={previewActive} />
      )}
    </div>
  );
}
