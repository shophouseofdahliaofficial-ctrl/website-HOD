'use client';

import { useEffect, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { supabase } from '@/lib/supabase/client';
import { tokenStorage } from '@/lib/utils/storage';
import { authApi } from '@/lib/api';

const RETURN_TO_KEY = 'milko_return_after_auth';

const OAUTH_STATE_MSG =
  'Google sign-in could not be completed. This can happen with strict privacy settings or ad blockers. Try a normal (non-incognito) window, Chrome or Firefox, or use email and password.';

/**
 * OAuth callback (e.g. Google). Supabase redirects here after sign-in.
 * We read the session, store the access_token, and redirect. AuthContext
 * will then load the user via /api/auth/me.
 */
export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const [domMounted, setDomMounted] = useState(false);

  useEffect(() => {
    setDomMounted(true);
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const q = typeof window !== 'undefined' ? window.location.search : '';
        if (q && q.indexOf('bad_oauth_state') !== -1) {
          if (mounted) setError(OAUTH_STATE_MSG);
          return;
        }

        let { data: { session }, error: sessionError } = await supabase.auth.getSession();

        // If no session, try code exchange (Supabase may use ?code= instead of #access_token)
        if (!session?.access_token && typeof window !== 'undefined') {
          const code = new URLSearchParams(window.location.search).get('code');
          if (code) {
            const { data, error: exError } = await supabase.auth.exchangeCodeForSession(code);
            if (!exError && data?.session) {
              session = data.session;
              sessionError = null;
            }
          }
        }

        if (!mounted) return;

        if (sessionError) {
          setError('Could not complete sign in. Please try again.');
          return;
        }

        if (!session?.access_token) {
          setError('No session received. Please try again.');
          return;
        }

        // Exchange Supabase token for our JWT token with 700-day expiration
        try {
          const exchangeResult = await authApi.exchangeToken(session.access_token);
          tokenStorage.set(exchangeResult.token);
        } catch (exchangeError) {
          console.error('[AUTH] Token exchange failed, using Supabase token:', exchangeError);
          // Fallback to Supabase token if exchange fails
          tokenStorage.set(session.access_token);
        }

        const returnTo = typeof window !== 'undefined'
          ? localStorage.getItem(RETURN_TO_KEY)
          : null;
        if (typeof window !== 'undefined' && returnTo) {
          localStorage.removeItem(RETURN_TO_KEY);
        }

        const path = (returnTo && returnTo.startsWith('/')) ? returnTo : '/';
        // Wait 2 seconds for the loader animation to play before redirecting
        setTimeout(() => {
          if (mounted) {
            window.location.href = path;
          }
        }, 2000);
      } catch {
        if (mounted) setError('Something went wrong. Please try again.');
      }
    };

    run();
    return () => { mounted = false; };
  }, []);

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <p style={{ color: '#c33', marginBottom: '1rem' }}>{error}</p>
        <a
          href="/auth/login"
          style={{
            color: '#0070f3',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Back to Login
        </a>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        color: '#666',
      }}
    >
      <div style={{ width: '250px', height: '250px', marginBottom: '1rem' }}>
        {domMounted && (
          <DotLottieReact
            src="/animations/loading.lottie"
            loop
            autoplay
          />
        )}
      </div>
      <p style={{ marginTop: '-15px' }}>Completing sign in…</p>
    </div>
  );
}
