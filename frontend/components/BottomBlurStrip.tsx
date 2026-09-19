'use client';

import { useEffect, useState } from 'react';

export default function BottomBlurStrip() {
  const [isAtBottom, setIsAtBottom] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const windowHeight = window.innerHeight;
      const fullHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.offsetHeight,
        document.body.offsetHeight
      );

      // Hide blur strip if page content fits on screen or when within 90px of page bottom
      const atBottom = fullHeight <= windowHeight + 40 || (scrollY + windowHeight >= fullHeight - 90);
      setIsAtBottom(atBottom);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    // Check periodically for pages with dynamic content updates (e.g. My Account tabs, Order items)
    const interval = setInterval(handleScroll, 300);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className={`global-bottom-blur-strip ${isAtBottom ? 'global-bottom-blur-strip-hidden' : ''}`}
      aria-hidden="true"
    />
  );
}
