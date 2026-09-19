'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthResponse, User } from '@/types';
import { userStorage, tokenStorage, adminCookie } from '@/lib/utils/storage';
import { getCartStorage } from '@/lib/utils/cart';
import { clearSubscriptionCart, clearScopedPincode } from '@/lib/utils/userScopedStorage';
import { authApi } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import { normalizeUserProfile } from '@/lib/utils/userProfile';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  signup: (name: string, email: string, password: string) => Promise<AuthResponse>;
  loginWithGoogle: (returnTo?: string) => Promise<void>;
  loginWithFacebook: (returnTo?: string) => Promise<void>;
  loginWithDiscord: (returnTo?: string) => Promise<void>;
  loginWithMicrosoft: (returnTo?: string) => Promise<void>;
  loginWithSpotify: (returnTo?: string) => Promise<void>;
  loginWithTwitter: (returnTo?: string) => Promise<void>;
  loginWithTelegram: (telegramData: any) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from storage (and from token-only, e.g. after Google OAuth)
  useEffect(() => {
    const initAuth = async () => {
      const storedUser = userStorage.get();
      const token = tokenStorage.get();

      if (token) {
        // Verify token with server and load user (works for email/password and Google OAuth).
        // For Google, we only have token in storage; storedUser is empty until we fetch.
        try {
          const currentUser = await authApi.getCurrentUser();
          const normalized = normalizeUserProfile(currentUser);
          if (normalized) {
            setUser(normalized);
            userStorage.set(normalized);
            console.log('[AUTH] User verified, role:', normalized.role);
          }
        } catch (error: any) {
          if (error?.response?.status === 401 || error?.status === 401) {
            console.warn('[AUTH] Token invalid, clearing auth data');
            setUser(null);
            userStorage.remove();
            tokenStorage.remove();
          } else if (storedUser) {
            console.warn('[AUTH] Failed to verify token, using stored user:', error);
            const fallback = normalizeUserProfile(storedUser);
            setUser(fallback || storedUser);
          }
        }
      } else if (storedUser) {
        userStorage.remove();
        setUser(null);
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  // Sync admin cookie for coming-soon middleware: set when logged-in admin, clear otherwise
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isAdmin = user?.role?.toLowerCase() === 'admin';
    if (isAdmin) {
      adminCookie.set();
    } else {
      adminCookie.remove();
    }
  }, [user]);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    const initial = normalizeUserProfile(response.user) || response.user;
    setUser(initial);
    
    // Always refresh user data from database to get correct role
    // This ensures we have the latest role even if login response had stale data
    let finalUser = initial;
    try {
      const currentUser = await authApi.getCurrentUser();
      const normalized = normalizeUserProfile(currentUser);
      if (normalized) {
        setUser(normalized);
        userStorage.set(normalized);
        finalUser = normalized;
        console.log('[AUTH] User data refreshed from database, role:', normalized.role);
      }
    } catch (error) {
      console.warn('[AUTH] Failed to refresh user data, using login response:', error);
      // Continue with login response user data
    }
    
    return { ...response, user: finalUser }; // Return updated user
  };

  const signup = async (name: string, email: string, password: string) => {
    const response = await authApi.signup(name, email, password);
    const normalized = normalizeUserProfile(response.user);
    setUser(normalized || response.user);
    return response; // Return response for redirect logic
  };

  const loginWithGoogle = async (returnTo?: string) => {
    if (typeof window === 'undefined') return;
    let path = '';
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      path = returnTo;
    } else {
      const pathname = window.location.pathname;
      const search = window.location.search;
      if (pathname && pathname !== '/auth/login' && pathname !== '/auth/signup') {
        path = `${pathname}${search}`;
      }
    }
    if (path) {
      localStorage.setItem('milko_return_after_auth', path);
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  };

  const loginWithFacebook = async (returnTo?: string) => {
    if (typeof window === 'undefined') return;
    let path = '';
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      path = returnTo;
    } else {
      const pathname = window.location.pathname;
      const search = window.location.search;
      if (pathname && pathname !== '/auth/login' && pathname !== '/auth/signup') {
        path = `${pathname}${search}`;
      }
    }
    if (path) {
      localStorage.setItem('milko_return_after_auth', path);
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({ provider: 'facebook', options: { redirectTo } });
  };

  const loginWithDiscord = async (returnTo?: string) => {
    if (typeof window === 'undefined') return;
    let path = '';
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      path = returnTo;
    } else {
      const pathname = window.location.pathname;
      const search = window.location.search;
      if (pathname && pathname !== '/auth/login' && pathname !== '/auth/signup') {
        path = `${pathname}${search}`;
      }
    }
    if (path) {
      localStorage.setItem('milko_return_after_auth', path);
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo } });
  };

  const loginWithMicrosoft = async (returnTo?: string) => {
    if (typeof window === 'undefined') return;
    let path = '';
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      path = returnTo;
    } else {
      const pathname = window.location.pathname;
      const search = window.location.search;
      if (pathname && pathname !== '/auth/login' && pathname !== '/auth/signup') {
        path = `${pathname}${search}`;
      }
    }
    if (path) {
      localStorage.setItem('milko_return_after_auth', path);
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({ provider: 'azure', options: { redirectTo } });
  };

  const loginWithSpotify = async (returnTo?: string) => {
    if (typeof window === 'undefined') return;
    let path = '';
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      path = returnTo;
    } else {
      const pathname = window.location.pathname;
      const search = window.location.search;
      if (pathname && pathname !== '/auth/login' && pathname !== '/auth/signup') {
        path = `${pathname}${search}`;
      }
    }
    if (path) {
      localStorage.setItem('milko_return_after_auth', path);
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({ provider: 'spotify', options: { redirectTo } });
  };

  const loginWithTwitter = async (returnTo?: string) => {
    if (typeof window === 'undefined') return;
    let path = '';
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      path = returnTo;
    } else {
      const pathname = window.location.pathname;
      const search = window.location.search;
      if (pathname && pathname !== '/auth/login' && pathname !== '/auth/signup') {
        path = `${pathname}${search}`;
      }
    }
    if (path) {
      localStorage.setItem('milko_return_after_auth', path);
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({ provider: 'x', options: { redirectTo } });
  };

  const loginWithTelegram = async (telegramData: any): Promise<AuthResponse> => {
    const response = await authApi.loginWithTelegram(telegramData);
    const normalized = normalizeUserProfile(response.user);
    setUser(normalized || response.user);
    return response;
  };

  const logout = async () => {
    await authApi.logout();
    if (typeof window !== 'undefined') {
      getCartStorage(null).clear();
      clearSubscriptionCart(null);
      clearScopedPincode(null);
      window.dispatchEvent(new CustomEvent('milko:pincode-updated'));
    }
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const currentUser = await authApi.getCurrentUser();
      const normalized = normalizeUserProfile(currentUser);
      if (normalized) {
        setUser(normalized);
        userStorage.set(normalized);
      }
    } catch (error) {
      // If refresh fails, user might be logged out
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role?.toLowerCase() === 'admin', // Case-insensitive comparison
    login,
    signup,
    loginWithGoogle,
    loginWithFacebook,
    loginWithDiscord,
    loginWithMicrosoft,
    loginWithSpotify,
    loginWithTwitter,
    loginWithTelegram,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

