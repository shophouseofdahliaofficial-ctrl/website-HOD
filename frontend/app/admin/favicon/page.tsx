'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminContentApi, SiteContent } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from '../logo/page.module.css';

export default function AdminFaviconPage() {
  const [favicon, setFavicon] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    void fetchFavicon();
  }, []);

  const fetchFavicon = async () => {
    try {
      setLoading(true);
      const data = await adminContentApi.getByType('favicon');
      setFavicon(data);
    } catch {
      setFavicon(null);
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const f = e.target.files?.[0];
    if (!f) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    if (!f.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, ICO, SVG, WebP, etc.)');
      return;
    }
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!imageFile) {
      setError('Please choose a favicon image first.');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      await adminContentApi.uploadFavicon(formData);
      showToast('Favicon saved successfully', 'success');
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImageFile(null);
      setImagePreview(null);
      await fetchFavicon();
    } catch (err: any) {
      setError(err?.message || 'Failed to save favicon');
      showToast(err?.message || 'Failed to save favicon', 'error');
    } finally {
      setSaving(false);
    }
  };

  const displayUrl = imagePreview || favicon?.metadata?.imageUrl || null;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/admin/more" className={styles.backButton}>← Back</Link>
          <h1 className={adminStyles.adminPageTitle}>Favicon</h1>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/admin/more" className={styles.backButton}>← Back</Link>
        <h1 className={adminStyles.adminPageTitle}>Favicon</h1>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Upload favicon</label>
          <input
            type="file"
            accept="image/*,.ico,.svg"
            onChange={onFileChange}
            className={styles.fileInput}
          />
          <p className={styles.helpText}>
            Recommended: square image, ideally 32×32 or 48×48. Uploading a new image replaces the previous favicon.
          </p>
          {displayUrl && (
            <div className={styles.preview}>
              <img
                src={displayUrl}
                alt="Favicon preview"
                style={{ width: '48px', height: '48px', objectFit: 'contain' }}
              />
            </div>
          )}
        </div>

        <div className={styles.formActions}>
          <button type="submit" className={styles.submitButton} disabled={saving}>
            {saving ? 'Saving…' : 'Save Favicon'}
          </button>
        </div>
      </form>
    </div>
  );
}
