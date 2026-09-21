'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getPostLoginRedirect } from '@/lib/utils/domain';
import Link from 'next/link';
import Logo from '@/components/Logo';
import styles from '../auth.module.css';

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.335z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup, loginWithGoogle, isAuthenticated, user } = useAuth();
  const redirectParam = searchParams?.get('redirect') || '';
  const safeRedirect = redirectParam.startsWith('/') ? redirectParam : '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      const redirectPath = safeRedirect || getPostLoginRedirect(user.role);
      if (redirectPath.startsWith('http')) {
        window.location.href = redirectPath;
      } else {
        router.push(redirectPath);
      }
    }
  }, [isAuthenticated, user, router, safeRedirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in your email and password');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      const response = await signup(email, password, name.trim() || '');
      const userRole = response?.user?.role?.toLowerCase() || 'customer';
      const redirectPath = safeRedirect || getPostLoginRedirect(userRole as any);

      if (redirectPath.startsWith('http')) {
        window.location.href = redirectPath;
      } else {
        router.push(redirectPath);
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Top Left Back Navigation */}
      <button
        type="button"
        onClick={() => {
          if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
          } else {
            router.push('/');
          }
        }}
        className={styles.backButton}
        aria-label="Go back"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back
      </button>

      {/* Main Centered Auth Form */}
      <div className={styles.authCenterContent}>
        {/* Real Brand Logo */}
        <div className={styles.topIconWrapper}>
          <Logo imageClassName={styles.authLogoImage} />
        </div>

        {/* Title & Toggle Subtitle */}
        <h1 className={styles.authTitle}>Create account</h1>
        <p className={styles.authSubtitle}>
          Enter your details or{' '}
          <Link
            href={safeRedirect ? `/auth/login?redirect=${encodeURIComponent(safeRedirect)}` : '/auth/login'}
            className={styles.inlineLink}
          >
            log in
          </Link>
        </p>

        {/* Error Alert */}
        {error && <div className={styles.errorMessage}>{error}</div>}

        {/* Auth Input Form */}
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.inputGroup}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name (optional)"
              className={styles.cleanInput}
              autoComplete="name"
              disabled={loading}
            />
          </div>

          <div className={styles.inputGroup}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className={styles.cleanInput}
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className={styles.inputGroup}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min. 6 characters)"
              required
              className={styles.cleanInput}
              autoComplete="new-password"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={styles.passwordToggle}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className={styles.primaryButton}
          >
            {loading ? 'Creating account...' : 'Next'}
          </button>
        </form>

        {/* Google & Quick Auth Section */}
        <div className={styles.divider}>
          <span>or continue with</span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (safeRedirect) localStorage.setItem('milko_return_after_auth', safeRedirect);
            loginWithGoogle();
          }}
          className={styles.socialPillButton}
        >
          <GoogleIcon />
          <span>Google</span>
        </button>

        {/* Terms footer */}
        <p className={styles.termsText}>
          By continuing, you agree to our{' '}
          <Link href="/terms">Terms of service</Link> and{' '}
          <Link href="/privacy">Privacy policy</Link>.
        </p>
      </div>
    </>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.authCenterContent}>
          <div className={styles.topIconWrapper}>
            <Logo imageClassName={styles.authLogoImage} />
          </div>
          <p style={{ color: '#6b7280' }}>Loading...</p>
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
