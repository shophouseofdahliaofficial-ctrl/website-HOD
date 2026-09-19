'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import EditorAuthIcon from '@/components/editor/EditorAuthIcon';
import styles from '@/components/editor/EditorLoginModal.module.css';

type Props = {
  open: boolean;
  onSuccess: () => void | Promise<void>;
  returnPath: string;
  subtitle?: string;
};

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
      <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.335z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 127.14 96.36" fill="#5865F2" xmlns="http://www.w3.org/2000/svg">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c1-.72,1.93-1.48,2.83-2.28a74.58,74.58,0,0,0,72.24,0c.9,0.8,1.83,1.56,2.83,2.28a68.43,68.43,0,0,1-10.5,5A77.7,77.7,0,0,0,95.14,85.51,105.73,105.73,0,0,0,126.14,77.53C130,54.65,123.36,31.58,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z"/>
    </svg>
  );
}





function XIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#1a1a1a" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function PhotobookLoginModal({
  open,
  onSuccess,
  returnPath,
  subtitle = 'Sign in to save your design and continue editing anytime.',
}: Props) {
  const { login, loginWithGoogle, loginWithFacebook, loginWithDiscord, loginWithMicrosoft, loginWithSpotify, loginWithTwitter } = useAuth();
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowLoginForm(false);
      setEmail('');
      setPassword('');
      setError('');
      setLoading(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open]);

  if (!open) return null;

  const signupHref = `/auth/signup?redirect=${encodeURIComponent(returnPath)}`;

  const handleGoogleLogin = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('milko_return_after_auth', returnPath);
    }
    void loginWithGoogle(returnPath);
  };

  const handleFacebookLogin = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('milko_return_after_auth', returnPath);
    }
    void loginWithFacebook(returnPath);
  };

  const handleDiscordLogin = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('milko_return_after_auth', returnPath);
    }
    void loginWithDiscord(returnPath);
  };

  const handleMicrosoftLogin = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('milko_return_after_auth', returnPath);
    }
    void loginWithMicrosoft(returnPath);
  };

  const handleSpotifyLogin = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('milko_return_after_auth', returnPath);
    }
    void loginWithSpotify(returnPath);
  };

  const handleTwitterLogin = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('milko_return_after_auth', returnPath);
    }
    void loginWithTwitter(returnPath);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      await onSuccess();
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const modal = (
    <div className={`${styles.overlay} ${styles.overlayActive}`} role="presentation" data-lenis-prevent>
      <div
        className={`${styles.sheet} ${styles.sheetActive}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photobook-login-title"
      >
        {showLoginForm ? (
          <button
            type="button"
            onClick={() => {
              setShowLoginForm(false);
              setError('');
            }}
            className={styles.backBtn}
            aria-label="Back"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Back</span>
          </button>
        ) : null}

        <div className={styles.content}>
          <div className={styles.iconWrap}>
            <EditorAuthIcon className={styles.authIcon} />
          </div>

          <h2 id="photobook-login-title" className={styles.title}>
            Sign in to save
          </h2>
          <p className={styles.subtitle}>{subtitle}</p>

          {showLoginForm ? (
            <form onSubmit={handleLogin} className={styles.form}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className={styles.input}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={styles.input}
              />
              {error ? <p className={styles.error}>{error}</p> : null}
              <button type="submit" className={styles.primaryBtn} disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In & Continue'}
              </button>
            </form>
          ) : (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => setShowLoginForm(true)}
                disabled={loading}
              >
                Sign In & Continue
              </button>

              <button
                type="button"
                className={`${styles.primaryBtn} ${styles.googleBtn}`}
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                <span className={styles.googleLabel}>
                  <GoogleIcon /> Continue with Google
                </span>
              </button>

              {/* Social Auth Buttons Row */}
              <div className={styles.socialButtonsRow}>
                {/* Facebook */}
                <button
                  type="button"
                  className={`${styles.primaryBtn} ${styles.facebookBtn} ${styles.socialButton} ${styles.mutedSocialButton}`}
                  onClick={(e) => e.preventDefault()}
                  title="Coming soon"
                >
                  <span className={styles.iconWrapper}>
                    <FacebookIcon />
                  </span>
                  <span className={styles.comingSoonText}>Coming soon</span>
                </button>

                {/* Discord */}
                <button
                  type="button"
                  className={`${styles.primaryBtn} ${styles.facebookBtn} ${styles.socialButton}`}
                  onClick={handleDiscordLogin}
                  disabled={loading}
                  title="Continue with Discord"
                >
                  <span className={styles.facebookLabel}>
                    <DiscordIcon />
                  </span>
                </button>



                {/* X (Twitter) */}
                <button
                  type="button"
                  className={`${styles.primaryBtn} ${styles.facebookBtn} ${styles.socialButton}`}
                  onClick={handleTwitterLogin}
                  disabled={loading}
                  title="Continue with X"
                >
                  <span className={styles.facebookLabel}>
                    <XIcon />
                  </span>
                </button>
              </div>
            </div>
          )}

          <p className={styles.signup}>
            New here?{' '}
            <Link
              href={signupHref}
              className={styles.signupLink}
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('milko_return_after_auth', returnPath);
                }
              }}
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
