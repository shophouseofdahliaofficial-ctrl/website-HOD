'use client';

import { Suspense, useCallback, useEffect, useRef, useState, type AnimationEvent } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import styles from './NavigationProgressBar.module.css';

type Visual = 'hidden' | 'cycle1' | 'cycle2' | 'complete' | 'exit';

/** Must stay in sync with `.trackCycle1 .fill` animation duration in NavigationProgressBar.module.css */
const CYCLE1_DURATION_MS = 550;

function locationKey(pathname: string, search: string) {
  return `${pathname}${search ? `?${search}` : ''}`;
}

function shouldIgnoreAnchorClick(anchor: HTMLAnchorElement, e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0) return true;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return true;
  const href = anchor.getAttribute('href');
  if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
    return true;
  }
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) return true;
  try {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return true;
    const next = url.pathname + url.search;
    const cur = window.location.pathname + window.location.search;
    if (next === cur) return true;
  } catch {
    return true;
  }
  return false;
}

function NavigationProgressBarInner() {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const search = searchParams?.toString() || '';
  const routeKey = locationKey(pathname, search);

  const [visual, setVisual] = useState<Visual>('hidden');
  const [fillNonce, setFillNonce] = useState(0);

  const visualRef = useRef(visual);
  visualRef.current = visual;

  const prevRouteKeyRef = useRef<string | null>(null);
  const lastStartRef = useRef(0);
  const timersRef = useRef<{
    c1?: ReturnType<typeof setTimeout>;
    fin?: ReturnType<typeof setTimeout>;
    max?: ReturnType<typeof setTimeout>;
  }>({});

  const clearTimers = useCallback(() => {
    const t = timersRef.current;
    if (t.c1) clearTimeout(t.c1);
    if (t.fin) clearTimeout(t.fin);
    if (t.max) clearTimeout(t.max);
    timersRef.current = {};
  }, []);

  const goHidden = useCallback(() => {
    clearTimers();
    setVisual('hidden');
  }, [clearTimers]);

  const startNavigation = useCallback(() => {
    const now = Date.now();
    if (now - lastStartRef.current < 70) return;
    lastStartRef.current = now;
    if (visualRef.current === 'exit') return;

    clearTimers();
    setFillNonce((n) => n + 1);
    setVisual('cycle1');

    /* Fallback if animationend does not fire — only after first full sweep should have completed */
    timersRef.current.c1 = setTimeout(() => {
      if (visualRef.current !== 'cycle1') return;
      setFillNonce((n) => n + 1);
      setVisual('cycle2');
    }, CYCLE1_DURATION_MS + 120);

    timersRef.current.max = setTimeout(() => {
      if (visualRef.current === 'hidden' || visualRef.current === 'exit') return;
      goHidden();
    }, 12000);
  }, [clearTimers, goHidden]);

  const finishNavigation = useCallback(() => {
    clearTimers();
    setVisual((v) => {
      if (v === 'hidden' || v === 'exit' || v === 'complete') return v;
      return 'complete';
    });

    timersRef.current.fin = setTimeout(() => {
      setVisual('exit');
      setTimeout(() => {
        setVisual('hidden');
      }, 420);
    }, 220);
  }, [clearTimers]);

  useEffect(() => {
    if (prevRouteKeyRef.current === null) {
      prevRouteKeyRef.current = routeKey;
      return;
    }
    if (prevRouteKeyRef.current === routeKey) return;
    prevRouteKeyRef.current = routeKey;

    const v = visualRef.current;
    if (v === 'cycle1' || v === 'cycle2') {
      finishNavigation();
    }
  }, [routeKey, finishNavigation]);

  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const a = el.closest('a');
      if (!a || !a.href) return;
      if (shouldIgnoreAnchorClick(a, e)) return;
      startNavigation();
    };
    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, [startNavigation]);

  useEffect(() => {
    const maybeStart = (url: string | URL | null | undefined) => {
      if (url == null || url === '') return;
      try {
        const next = new URL(String(url), window.location.href);
        const nowKey = window.location.pathname + window.location.search;
        const nextKey = next.pathname + next.search;
        if (nextKey === nowKey) return;
      } catch {
        return;
      }
      startNavigation();
    };

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    history.pushState = function (state: unknown, unused: string, url?: string | URL | null) {
      maybeStart(url ?? null);
      return origPush(state, unused, url as never);
    };
    history.replaceState = function (state: unknown, unused: string, url?: string | URL | null) {
      maybeStart(url ?? null);
      return origReplace(state, unused, url as never);
    };

    const onPop = () => startNavigation();
    window.addEventListener('popstate', onPop);

    return () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
      window.removeEventListener('popstate', onPop);
    };
  }, [startNavigation]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const onCycle1AnimationEnd = useCallback((e: AnimationEvent<HTMLDivElement>) => {
    if (visualRef.current !== 'cycle1') return;
    if (e.target !== e.currentTarget) return;
    if (timersRef.current.c1) {
      clearTimeout(timersRef.current.c1);
      timersRef.current.c1 = undefined;
    }
    setFillNonce((n) => n + 1);
    setVisual('cycle2');
  }, []);

  const wrapClass = visual === 'hidden' ? styles.wrap : `${styles.wrap} ${styles.wrapVisible}`;

  const trackClass =
    visual === 'hidden'
      ? styles.track
      : `${styles.track} ${
          visual === 'exit'
            ? styles.trackExit
            : visual === 'complete'
              ? styles.trackComplete
              : visual === 'cycle2'
                ? styles.trackCycle2
                : styles.trackCycle1
        }`;

  return (
    <div className={wrapClass} aria-hidden>
      <div className={trackClass}>
        <div
          key={`${visual}-${fillNonce}`}
          className={styles.fill}
          onAnimationEnd={visual === 'cycle1' ? onCycle1AnimationEnd : undefined}
        />
      </div>
    </div>
  );
}

/**
 * Top-of-header progress: first run to 100%, second phase until route settles, then slide up.
 */
export default function NavigationProgressBar() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBarInner />
    </Suspense>
  );
}
