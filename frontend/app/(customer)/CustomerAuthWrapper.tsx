'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

export default function CustomerAuthWrapper({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || '';

  // Allow guest access to products listing, product detail pages, and core category/navigation pages
  const isPublicPath =
    pathname === '/products' ||
    pathname.startsWith('/products/') ||
    pathname.startsWith('/product/') ||
    pathname.startsWith('/creator/') ||
    pathname === '/memorybooks' ||
    pathname.startsWith('/memorybooks/') ||
    pathname === '/polaroids' ||
    pathname.startsWith('/polaroids/') ||
    pathname === '/journals' ||
    pathname.startsWith('/journals/');

  useEffect(() => {
    if (!loading && !isAuthenticated && !isPublicPath && typeof window !== 'undefined') {
      const search = window.location.search || '';
      const path = pathname || window.location.pathname || '/';
      router.replace(`/auth/login?redirect=${encodeURIComponent(path + search)}`);
    }
  }, [isAuthenticated, loading, router, pathname, isPublicPath]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          fontFamily: 'var(--font-inter), sans-serif',
          color: '#666',
          fontSize: 'calc(1.05rem - 3px)',
          fontWeight: 500,
          letterSpacing: '-0.5px',
          gap: '10px',
        }}
      >
        <style>{`
          @keyframes loaderSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <svg
          style={{
            animation: 'loaderSpin 0.8s linear infinite',
            width: '22px',
            height: '22px',
            color: '#ff0040',
            marginBottom: '0px',
            flexShrink: 0
          }}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            style={{ opacity: 0.15 }}
          />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span>Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated && !isPublicPath) {
    return null;
  }

  return (
    <div>
      {/* Header is global in root layout */}
      <main>{children}</main>
    </div>
  );
}
