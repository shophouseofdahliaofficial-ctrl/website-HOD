import { STORAGE_KEYS, MILKO_ADMIN_COOKIE } from './constants';
import { User } from '@/types';

const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Token Management
 * Using httpOnly cookies would be more secure, but for simplicity
 * we'll use localStorage with proper XSS protection in production
 */
export const tokenStorage = {
  get: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  },
  set: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  },
  remove: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  },
};

/**
 * User Data Management
 */
export const userStorage = {
  get: (): User | null => {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },
  set: (user: User): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },
  remove: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.USER);
  },
};

/**
 * Admin cookie – set when user is logged-in admin so middleware can allow access during coming-soon.
 * Middleware cannot read localStorage; it checks this cookie.
 */
export const adminCookie = {
  set: (): void => {
    if (typeof window === 'undefined') return;
    document.cookie = `${MILKO_ADMIN_COOKIE}=1; path=/; max-age=${ADMIN_COOKIE_MAX_AGE}; samesite=lax`;
  },
  remove: (): void => {
    if (typeof window === 'undefined') return;
    document.cookie = `${MILKO_ADMIN_COOKIE}=; path=/; max-age=0; samesite=lax`;
  },
};

/**
 * Clear all auth data
 */
export const clearAuth = (): void => {
  tokenStorage.remove();
  userStorage.remove();
  adminCookie.remove();
};

