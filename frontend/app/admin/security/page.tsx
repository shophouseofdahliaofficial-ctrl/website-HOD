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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
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

    if (!currentPassword) {
      setError('Please enter your current admin password.');
      return;
    }

    if (!newPassword || newPassword.length < 3) {
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
        currentPassword,
        newPassword,
      });

      if (res && res.success) {
        setSuccess('Admin panel password updated successfully! You can now use this password next time.');
        showToast('Admin password changed successfully', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        fetchMetadata();
      } else {
        setError('Failed to update password. Please check your current password.');
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
          Change the gate password required to access the House of Dahlia admin dashboard. Changes take effect immediately without having to edit Render environment variables.
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
              <strong>Password Source:</strong> {metadata.isCustom ? 'Custom Database Password' : 'Environment Default (2316)'}
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
            <label className={styles.label}>Current Admin Password</label>
            <div className={styles.passwordWrapper}>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current admin password"
                className={styles.input}
                disabled={loading}
                required
              />
              <button
                type="button"
                className={styles.eyeButton}
                onClick={() => setShowCurrent(!showCurrent)}
                aria-label={showCurrent ? 'Hide' : 'Show'}
              >
                {showCurrent ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

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
                required
              />
              <button
                type="button"
                className={styles.eyeButton}
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? 'Hide' : 'Show'}
              >
                {showNew ? 'Hide' : 'Show'}
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

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Updating Password...' : 'Save New Admin Password'}
          </button>
        </form>

        <div className={styles.noteBox}>
          <div className={styles.noteTitle}>🔒 Security Tip</div>
          Updating your admin password here saves it directly to the database. Next time anyone logs into the admin dashboard, they will be required to enter this new password.
        </div>
      </div>
    </div>
  );
}
