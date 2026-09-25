'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

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
