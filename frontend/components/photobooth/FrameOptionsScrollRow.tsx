'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import styles from '@/app/photobooth/page.module.css';

type FrameOptionsScrollRowProps = {
  children: ReactNode;
};

export default function FrameOptionsScrollRow({ children }: FrameOptionsScrollRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;

    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < maxScrollLeft - 4);
  }, []);

  const scrollRow = useCallback((direction: 'left' | 'right') => {
    const el = rowRef.current;
    if (!el) return;

    const amount = Math.max(180, Math.round(el.clientWidth * 0.72));
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    updateScrollState();

    const onScroll = () => updateScrollState();
    el.addEventListener('scroll', onScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => updateScrollState());
    resizeObserver.observe(el);
    Array.from(el.children).forEach((child) => resizeObserver.observe(child));

    window.addEventListener('resize', updateScrollState);

    return () => {
      el.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, children]);

  return (
    <div className={styles.frameOptionsScroller}>
      <button
        type="button"
        className={`${styles.frameOptionsNav} ${styles.frameOptionsNavLeft}`}
        onClick={() => scrollRow('left')}
        disabled={!canScrollLeft}
        aria-label="Scroll frame options left"
      >
        <svg viewBox="0 0 24 24" fill="none" width="40" height="40" aria-hidden="true">
          <path
            d="M14 7L9 12L14 17"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div ref={rowRef} className={styles.frameOptionsRow}>
        {children}
      </div>

      <button
        type="button"
        className={`${styles.frameOptionsNav} ${styles.frameOptionsNavRight}`}
        onClick={() => scrollRow('right')}
        disabled={!canScrollRight}
        aria-label="Scroll frame options right"
      >
        <svg viewBox="0 0 24 24" fill="none" width="40" height="40" aria-hidden="true">
          <path
            d="M10 7L15 12L10 17"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
