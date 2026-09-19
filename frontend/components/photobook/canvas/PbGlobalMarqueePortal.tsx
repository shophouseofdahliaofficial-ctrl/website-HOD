'use client';

import { createPortal } from 'react-dom';

export type PbGlobalMarqueeVisualState = {
  active: boolean;
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
};

type PbGlobalMarqueePortalProps = {
  visual: PbGlobalMarqueeVisualState | null;
};

/** Pink marquee portaled to document.body (viewport client coords only). */
export default function PbGlobalMarqueePortal({ visual }: PbGlobalMarqueePortalProps) {
  if (!visual?.active || typeof document === 'undefined') return null;

  const left = Math.min(visual.startClientX, visual.currentClientX);
  const top = Math.min(visual.startClientY, visual.currentClientY);
  const width = Math.abs(visual.currentClientX - visual.startClientX);
  const height = Math.abs(visual.currentClientY - visual.startClientY);
  const showBox = width >= 1 || height >= 1;

  return createPortal(
    <>
      <div
        className="pbGlobalMarqueeDebugDot"
        style={{
          position: 'fixed',
          left: visual.currentClientX - 3,
          top: visual.currentClientY - 3,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#ff4fa3',
          pointerEvents: 'none',
          zIndex: 2147483647,
        }}
        aria-hidden="true"
      />
      {showBox ? (
        <div
          className="pbGlobalMarqueeBox"
          style={{
            position: 'fixed',
            left,
            top,
            width,
            height,
            pointerEvents: 'none',
            boxSizing: 'border-box',
            border: '1px solid #ff4fa3',
            background: 'rgba(255, 79, 163, 0.12)',
            zIndex: 2147483646,
          }}
          aria-hidden="true"
        />
      ) : null}
    </>,
    document.body,
  );
}
