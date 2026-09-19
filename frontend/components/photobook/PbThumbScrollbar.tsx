'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import styles from '../ProductDetailsModal.module.css';

type PbThumbScrollbarProps = {
  scrollRef: RefObject<HTMLElement | null>;
  /** When true, content scrolls but no thumb is shown (e.g. shapes rail). */
  hidden?: boolean;
};

/**
 * Overlay thumb-only scrollbar for photobook scroll areas.
 * Hides the native scrollbar and renders a floating thumb that tracks scroll position.
 */
export default function PbThumbScrollbar({ scrollRef, hidden = false }: PbThumbScrollbarProps) {
  const thumbRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ y: 0, scrollTop: 0 });

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    const thumb = thumbRef.current;
    if (!el || !thumb || hidden) {
      if (thumb) thumb.style.display = 'none';
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = el;
    if (clientHeight <= 40 || scrollHeight <= clientHeight + 5) {
      thumb.style.display = 'none';
      return;
    }

    thumb.style.display = 'block';
    const ratio = clientHeight / scrollHeight;
    const thumbHeight = Math.max(28, Math.round(clientHeight * ratio));
    const trackHeight = clientHeight - thumbHeight;
    const scrollRatio = scrollTop / (scrollHeight - clientHeight);
    const thumbTop = trackHeight * scrollRatio;

    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${thumbTop}px)`;
  }, [scrollRef, hidden]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || hidden) return;

    updateThumb();
    el.addEventListener('scroll', updateThumb, { passive: true });
    const ro = new ResizeObserver(updateThumb);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);

    return () => {
      el.removeEventListener('scroll', updateThumb);
      ro.disconnect();
    };
  }, [scrollRef, hidden, updateThumb]);

  useEffect(() => {
    const thumb = thumbRef.current;
    const el = scrollRef.current;
    if (!thumb || !el || hidden) return;

    const onThumbPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = true;
      dragStartRef.current = { y: e.clientY, scrollTop: el.scrollTop };
      thumb.setPointerCapture(e.pointerId);
    };

    const onThumbPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const { scrollHeight, clientHeight } = el;
      const thumbHeight = Math.max(28, Math.round(clientHeight * (clientHeight / scrollHeight)));
      const trackHeight = scrollHeight - clientHeight;
      const thumbTrack = clientHeight - thumbHeight;
      if (trackHeight <= 0 || thumbTrack <= 0) return;
      const deltaY = e.clientY - dragStartRef.current.y;
      const scrollDelta = (deltaY / thumbTrack) * trackHeight;
      el.scrollTop = dragStartRef.current.scrollTop + scrollDelta;
    };

    const onThumbPointerUp = (e: PointerEvent) => {
      draggingRef.current = false;
      try {
        thumb.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    thumb.addEventListener('pointerdown', onThumbPointerDown);
    thumb.addEventListener('pointermove', onThumbPointerMove);
    thumb.addEventListener('pointerup', onThumbPointerUp);
    thumb.addEventListener('pointercancel', onThumbPointerUp);

    return () => {
      thumb.removeEventListener('pointerdown', onThumbPointerDown);
      thumb.removeEventListener('pointermove', onThumbPointerMove);
      thumb.removeEventListener('pointerup', onThumbPointerUp);
      thumb.removeEventListener('pointercancel', onThumbPointerUp);
    };
  }, [scrollRef, hidden]);

  if (hidden) return null;

  return (
    <div
      ref={thumbRef}
      className={styles.pbThumbScrollbarThumb}
      aria-hidden="true"
      data-pb-thumb-scrollbar="true"
    />
  );
}
