'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Footer from './Footer';

/**
 * Conditional Footer Component
 * - Hides footer on auth pages and admin panel
 * - Hides footer completely on mobile devices (all pages) – will be set up differently later
 */
export default function ConditionalFooter() {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  const isAuthRoute = pathname?.startsWith('/auth');
  const isAdminRoute = pathname?.startsWith('/admin');
  const isComingSoon = pathname === '/coming-soon';

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isAuthRoute || isAdminRoute || isComingSoon) {
    return null;
  }

  if (isMobile) {
    return null;
  }

  return <Footer />;
}
