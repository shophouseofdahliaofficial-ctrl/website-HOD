'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  // Enforce manual scroll restoration and scroll to top on every route transition & fresh load
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const resetToTop = () => {
      // If there is an intentional target hash in URL, let browser/handler navigate to it
      if (window.location.hash) {
        const hashEl = document.querySelector(window.location.hash);
        if (hashEl) return;
      }

      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;

      if ((window as any).lenis) {
        try {
          (window as any).lenis.scrollTo(0, { immediate: true, force: true });
        } catch {
          // ignore
        }
      }
    };

    // Immediate scroll reset
    resetToTop();

    // Next frame pass
    const rId = requestAnimationFrame(resetToTop);

    // After microtask / hydration settling
    const t1 = setTimeout(resetToTop, 30);
    const t2 = setTimeout(resetToTop, 120);

    const handlePageShow = () => {
      resetToTop();
    };

    window.addEventListener('pageshow', handlePageShow);

    return () => {
      cancelAnimationFrame(rId);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [pathname]);

  useEffect(() => {
    // Disable virtual smooth scroll hijacking completely in the Admin Panel
    if (isAdmin) {
      if ((window as any).lenis) {
        (window as any).lenis.destroy();
        delete (window as any).lenis;
      }
      return;
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
      prevent: (node: any) => {
        if (!node) return false;
        // Never hijack scrolling on textarea, input, contentEditable, or data-lenis-prevent elements
        const isFormField =
          node.tagName === 'TEXTAREA' ||
          node.tagName === 'INPUT' ||
          node.tagName === 'SELECT' ||
          node.isContentEditable ||
          Boolean(node.getAttribute?.('contenteditable')) ||
          Boolean(node.closest?.('textarea, input, [contenteditable="true"], [data-lenis-prevent], [data-lenis-prevent="true"]'));

        return isFormField;
      },
    });

    (window as any).lenis = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      delete (window as any).lenis;
    };
  }, [isAdmin]);

  return <>{children}</>;
}

