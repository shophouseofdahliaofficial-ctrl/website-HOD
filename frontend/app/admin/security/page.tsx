'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import styles from './page.module.css';

type PasswordMetadata = {
  isCustom: boolean;
  lastUpdated: string | null;
  source: string;
};

export default function AdminSecurityPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [metadata, setMetadata] = useState<PasswordMetadata | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      setFetching(true);
      const res = await apiClient.get<{ success: boolean; data: PasswordMetadata }>('/api/admin/security/password-status');
      if (res && res.data) {
        setMetadata(res.data);
      }
    } catch {
      // Ignore if not loaded
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newPassword || newPassword.trim().length < 3) {
      setError('New password must be at least 3 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.post<{ success: boolean; message: string }>('/api/admin/security/change-password', {
        newPassword: newPassword.trim(),
      });

      if (res && res.success) {
        // Keep current admin session verified with new password
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('adminPanelVerified', 'true');
        }
        setSuccess('Admin panel password updated successfully! You can now use this password anytime.');
        showToast('Admin password changed successfully', 'success');
        setNewPassword('');
        setConfirmPassword('');
        fetchMetadata();
      } else {
        setError('Failed to update password.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to update admin password';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Link href="/admin/more" className={styles.backLink}>
        ← Back to More
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>Admin Panel Password</h1>
        <p className={styles.subtitle}>
          Change the gate password required to access the House of Dahlia admin dashboard. Changes save directly to your database and take effect immediately without having to edit Render.
        </p>
      </div>

      <div className={styles.card}>
        {!fetching && metadata && (
          <div className={styles.statusBanner}>
            <span className={styles.statusIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <div>
              <strong>Password Source:</strong> {metadata.isCustom ? 'Custom Database Password (Active)' : 'Default (2316)'}
              {metadata.lastUpdated && (
                <span style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginTop: '2px' }}>
                  Last modified: {new Date(metadata.lastUpdated).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                </span>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.errorBox}>{error}</div>}
          {success && <div className={styles.successBox}>{success}</div>}

          <div className={styles.inputGroup}>
            <label className={styles.label}>New Admin Password</label>
            <div className={styles.passwordWrapper}>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 3 chars)"
                className={styles.input}
                disabled={loading}
                autoFocus
                required
              />
              <button
                type="button"
                className={styles.eyeButton}
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? 'Hide' : 'Show'}
              >
                {showNew ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Confirm New Password</label>
            <div className={styles.passwordWrapper}>
              <input
                type={showNew ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={styles.input}
                disabled={loading}
                required
              />
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading || !newPassword}>
            {loading ? 'Updating Password...' : 'Save New Admin Password'}
          </button>
        </form>

        <div className={styles.noteBox}>
          <div className={styles.noteTitle}>🔒 Instant Security</div>
          Because you are already logged in as a verified Administrator, saving your new password here immediately updates the security settings in the database. Next time anyone enters the admin portal, this new password will be required.
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e0d8cf' }}>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem('adminPanelVerified');
                  window.location.href = '/admin';
                }
              }}
              style={{
                background: '#fff',
                border: '1.5px solid #530000',
                color: '#530000',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              🔒 Lock Admin Panel Now (Test Password Popup)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
