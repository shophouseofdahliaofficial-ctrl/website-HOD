'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { authApi } from '@/lib/api/auth';
import Logo from '@/components/Logo';
import styles from '../auth.module.css';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState<'request' | 'reset'>('request');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        setMode('reset');
      }
    }
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { registered } = await authApi.checkEmail(email);
      if (!registered) {
        throw new Error('This email address is not registered.');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      setSuccess('Password reset link sent! Please check your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setSuccess('Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Top Left Back Navigation */}
      <button
        type="button"
        onClick={() => router.push('/auth/login')}
        className={styles.backButton}
        aria-label="Back to login"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to login
      </button>

      {/* Main Centered Reset Form */}
      <div className={styles.authCenterContent}>
        {/* Real Brand Logo */}
        <div className={styles.topIconWrapper}>
          <Logo imageClassName={styles.authLogoImage} />
        </div>

        <h1 className={styles.authTitle}>
          {mode === 'request' ? 'Reset password' : 'Set new password'}
        </h1>
        <p className={styles.authSubtitle}>
          {mode === 'request'
            ? 'Enter your email to receive a recovery link'
            : 'Choose a new password for your account'}
        </p>

        {error && <div className={styles.errorMessage}>{error}</div>}
        {success && <div className={styles.successMessage}>{success}</div>}

        {mode === 'request' ? (
          <form onSubmit={handleRequestReset} className={styles.form} noValidate>
            <div className={styles.inputGroup}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className={styles.cleanInput}
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={styles.primaryButton}
            >
              {loading ? 'Sending link...' : 'Send reset link'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleUpdatePassword} className={styles.form} noValidate>
            <div className={styles.inputGroup}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (min. 6 characters)"
                required
                className={styles.cleanInput}
                disabled={loading}
              />
            </div>

            <div className={styles.inputGroup}>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                className={styles.cleanInput}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={styles.primaryButton}
            >
              {loading ? 'Updating password...' : 'Update password'}
            </button>
          </form>
        )}

        <Link href="/auth/login" className={styles.forgotPasswordLink} style={{ marginTop: '1.5rem' }}>
          Remember your password? Log in
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
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
      <ResetPasswordForm />
    </Suspense>
  );
}
