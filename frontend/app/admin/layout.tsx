'use client';

import { useState, useEffect } from 'react';
import { useRequireAdmin } from '@/hooks/useRequireAuth';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import AdminPasswordGate from '@/components/admin/AdminPasswordGate';
import AdminSidebar from '@/components/AdminSidebar';
import AdminTopBar from '@/components/AdminTopBar';
import AdminMobileHeader from '@/components/admin/AdminMobileHeader';
import AdminMobileNav from '@/components/admin/AdminMobileNav';
import layoutStyles from './layout.module.css';

/**
 * Admin Layout
 * Wraps all admin routes with admin navigation and protection
 * Includes additional password gate for extra security
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, isAuthenticated, loading, user, logout } = useAuth();
  const router = useRouter();
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(true);
  
  useRequireAdmin(); // Redirects if not admin

  // Check if admin panel password is verified
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const verified = sessionStorage.getItem('adminPanelVerified') === 'true';
      setIsPasswordVerified(verified);
      setCheckingPassword(false);
    }
  }, []);

  // Hide body overflow when password gate is shown
  useEffect(() => {
    if (!isPasswordVerified && typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isPasswordVerified]);

  const handleLogout = async () => {
    // Clear password verification on logout
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('adminPanelVerified');
    }
    await logout();
    router.push('/auth/login');
  };

  // CRITICAL SECURITY: Always check authentication and admin role
  // Don't render anything if not admin - prevents any content flash
  if (loading || checkingPassword) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        background: '#f5f5f5'
      }}>
        <LoadingSpinnerWithText text="Loading..." />
      </div>
    );
  }

  // SECURITY: Double-check - if not authenticated or not admin, don't render
  // useRequireAdmin will handle redirect, but we also block rendering here
  if (!isAuthenticated) {
    return null; // Will redirect to login via useRequireAdmin
  }

  // SECURITY: Critical check - verify admin role from user object
  // Don't trust isAdmin alone - check user.role directly
  const userRole = user?.role?.toLowerCase();
  const isActuallyAdmin = userRole === 'admin';
  
  if (!isActuallyAdmin) {
    // Log security attempt for monitoring
    console.warn('[SECURITY] Non-admin user attempted to access admin panel:', {
      userId: user?.id,
      email: user?.email,
      role: user?.role,
      timestamp: new Date().toISOString()
    });
    return null; // Will redirect to home via useRequireAdmin
  }

  // SECURITY: Additional password gate - require admin panel password
  // This provides an extra layer of security even if someone has admin role
  if (!isPasswordVerified) {
    return <AdminPasswordGate />;
  }

  return (
    <div className={layoutStyles.adminLayout}>
      <AdminSidebar />
      <div className={layoutStyles.contentWrapper}>
        <AdminTopBar />
        <div className={layoutStyles.mobileHeader}>
          <AdminMobileHeader />
        </div>
        <main className={layoutStyles.mainContent}>
          {children}
        </main>
      </div>
      <AdminMobileNav />
    </div>
  );
}

