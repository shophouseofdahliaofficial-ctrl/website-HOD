'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (pathname.startsWith('/admin')) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
    });

    lenisRef.current = lenis;

    const syncScrollLock = () => {
      const photobookOpen = document.querySelector('[data-photobook-editor]');
      const boothOpen = document.querySelector('[data-booth-open]');
      const printUploadOpen = document.body.hasAttribute('data-print-upload-open');
      const searchOverlayOpen = document.body.hasAttribute('data-search-overlay-open');
      const mobileMenuOpen = document.body.hasAttribute('data-mobile-menu-open');
      const headerOverlayOpen = document.body.hasAttribute('data-header-overlay-open');
      
      if (photobookOpen || boothOpen || printUploadOpen || searchOverlayOpen || mobileMenuOpen || headerOverlayOpen) lenis.stop();
      else lenis.start();
    };

    const mo = new MutationObserver(syncScrollLock);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-photobook-editor', 'data-booth-open', 'data-print-upload-open', 'data-search-overlay-open', 'data-mobile-menu-open', 'data-header-overlay-open'],
    });
    syncScrollLock();

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      mo.disconnect();
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [pathname]);

  useEffect(() => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    }
  }, [pathname]);

  return <>{children}</>;
}
