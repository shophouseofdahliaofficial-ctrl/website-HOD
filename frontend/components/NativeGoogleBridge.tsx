'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { authApi } from '@/lib/api';
import { tokenStorage } from '@/lib/utils/storage';

const RETURN_TO_KEY = 'milko_return_after_auth';

declare global {
  interface Window {
    /** Called from Android WebView after native Google sign-in: `(email, idToken)`. Email is optional for logging; `token` is the Google ID token. */
    onNativeGoogleLoginSuccess?: (email: string, token: string) => Promise<void>;
    onNativeGoogleLoginError?: (message?: string) => void;
  }
}

export default function NativeGoogleBridge() {
  useEffect(() => {
    window.onNativeGoogleLoginSuccess = async (email: string, token: string) => {
      try {
        if (token) {
          console.log('[NATIVE_GOOGLE_BRIDGE] Login signal from app for:', email || '(no email)');
        }
        if (!token) throw new Error('Missing Google idToken (second argument)');

        const redirectPath = '/';
        localStorage.setItem(RETURN_TO_KEY, redirectPath);

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token,
        });

        if (error) throw error;
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error('No Supabase session after Google token sign-in');

        try {
          const exchangeResult = await authApi.exchangeToken(accessToken);
          tokenStorage.set(exchangeResult.token);
        } catch {
          tokenStorage.set(accessToken);
        }

        window.location.href = redirectPath; // home (same as Android template)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Native Google login could not be completed.';
        console.error('[NATIVE_GOOGLE_BRIDGE]', message);
        if (typeof window.onNativeGoogleLoginError === 'function') {
          window.onNativeGoogleLoginError(message);
        }
      }
    };

    return () => {
      delete window.onNativeGoogleLoginSuccess;
    };
  }, []);

  return null;
}
