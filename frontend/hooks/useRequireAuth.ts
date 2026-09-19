'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminDomain } from '@/lib/utils/domain';

function loginUrlForPath(pathname: string, search: string): string {
  const path = pathname || '/';
  if (path.startsWith('/auth')) return '/auth/login';
  return `/auth/login?redirect=${encodeURIComponent(path + search)}`;
}

/**
 * Hook to protect routes - redirects to login if not authenticated
 * Uses replace (not push) so the protected URL is not left in history;
 * otherwise "Back" from login returns to the protected page and bounces to login again.
 */
export const useRequireAuth = () => {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated && typeof window !== 'undefined') {
      const search = window.location.search || '';
      const path = pathname || window.location.pathname || '/';
      router.replace(loginUrlForPath(path, search));
    }
  }, [isAuthenticated, loading, router, pathname]);

  return { isAuthenticated, loading };
};

/**
 * Hook to protect admin routes - redirects to home if not admin
 * CRITICAL SECURITY: This is the main protection against unauthorized admin access
 */
export const useRequireAdmin = () => {
  const { isAdmin, isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      // SECURITY: Check authentication first
      if (!isAuthenticated || !user) {
        console.warn('[SECURITY] Unauthenticated access attempt to admin route');
        if (typeof window !== 'undefined') {
          const search = window.location.search || '';
          const path = pathname || window.location.pathname || '/';
          router.replace(loginUrlForPath(path, search));
        }
        return;
      }

      // SECURITY: Double-check role from user object (don't trust isAdmin alone)
      const userRole = user?.role?.toLowerCase();
      const isActuallyAdmin = userRole === 'admin';
      
      if (!isActuallyAdmin || !isAdmin) {
        // Log security attempt for monitoring
        console.warn('[SECURITY] Non-admin user attempted to access admin panel:', {
          userId: user?.id,
          email: user?.email,
          role: user?.role,
          isAdmin: isAdmin,
          isActuallyAdmin: isActuallyAdmin,
          timestamp: new Date().toISOString()
        });
        
        // If not admin, redirect to customer domain
        // BUT: In localhost, just redirect to home
        if (isAdminDomain() && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
          window.location.href = 'https://milko.in';
        } else {
          router.push('/');
        }
      }
    }
  }, [isAdmin, isAuthenticated, loading, router, user, pathname]);

  return { isAdmin, isAuthenticated, loading };
};

