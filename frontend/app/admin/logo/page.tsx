'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminContentApi, SiteContent } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';

const WIDTH_MIN = 40;
const WIDTH_MAX = 320;
const WIDTH_DEFAULT = 120;

export default function AdminLogoPage() {
  const [logo, setLogo] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [widthPx, setWidthPx] = useState(WIDTH_DEFAULT);
  const [widthPxMobile, setWidthPxMobile] = useState(WIDTH_DEFAULT);
  const { showToast } = useToast();

  useEffect(() => {
    fetchLogo();
  }, []);

  const fetchLogo = async () => {
    try {
      setLoading(true);
      const data = await adminContentApi.getByType('logo');
      setLogo(data);
      const w = data?.metadata?.widthPx;
      if (typeof w === 'number' && w >= WIDTH_MIN && w <= WIDTH_MAX) {
        setWidthPx(w);
      }
      const wMobile = data?.metadata?.widthPxMobile;
      if (typeof wMobile === 'number' && wMobile >= WIDTH_MIN && wMobile <= WIDTH_MAX) {
        setWidthPxMobile(wMobile);
      } else if (typeof w === 'number' && w >= WIDTH_MIN && w <= WIDTH_MAX) {
        // Default mobile width to desktop width if not set
        setWidthPxMobile(w);
      }
    } catch {
      setLogo(null);
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
      setError('Please select an image file (PNG, JPG, etc.)');
      return;
    }
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const formData = new FormData();
      if (imageFile) formData.append('image', imageFile);
      formData.append('widthPx', String(widthPx));
      formData.append('widthPxMobile', String(widthPxMobile));

      await adminContentApi.uploadLogo(formData);
      showToast('Logo saved successfully', 'success');
      setImageFile(null);
      setImagePreview(null);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      await fetchLogo();
    } catch (err: any) {
      setError(err?.message || 'Failed to save logo');
      showToast(err?.message || 'Failed to save logo', 'error');
    } finally {
      setSaving(false);
    }
  };

  const displayUrl = imagePreview || logo?.metadata?.imageUrl || null;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/admin/content" className={styles.backButton}>← Back</Link>
          <h1 className={adminStyles.adminPageTitle}>Logo</h1>
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
        <Link href="/admin/content" className={styles.backButton}>← Back</Link>
        <h1 className={adminStyles.adminPageTitle}>Logo</h1>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Upload logo (Cloudinary)</label>
          <input
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className={styles.fileInput}
          />
          <p className={styles.helpText}>
            PNG, JPG or WebP. Leave empty to only update the width. If you upload a new image, the previous one will be replaced.
          </p>
          {displayUrl && (
            <div className={styles.preview}>
              <img
                src={displayUrl}
                alt="Logo preview"
                style={{ width: imageFile ? undefined : `${widthPx}px` }}
              />
            </div>
          )}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Logo width (px)</label>
          <div className={styles.widthRow}>
            <input
              type="range"
              min={WIDTH_MIN}
              max={WIDTH_MAX}
              value={widthPx}
              onChange={(e) => setWidthPx(parseInt(e.target.value, 10))}
              className={styles.widthSlider}
            />
            <input
              type="number"
              min={WIDTH_MIN}
              max={WIDTH_MAX}
              value={widthPx}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) setWidthPx(Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, v)));
              }}
              className={styles.widthInput}
            />
          </div>
          <p className={styles.helpText}>
            Between {WIDTH_MIN} and {WIDTH_MAX} pixels. This controls how wide the logo appears on desktop in the header, auth pages and footer.
          </p>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Logo width for mobile (px)</label>
          <div className={styles.widthRow}>
            <input
              type="range"
              min={WIDTH_MIN}
              max={WIDTH_MAX}
              value={widthPxMobile}
              onChange={(e) => setWidthPxMobile(parseInt(e.target.value, 10))}
              className={styles.widthSlider}
            />
            <input
              type="number"
              min={WIDTH_MIN}
              max={WIDTH_MAX}
              value={widthPxMobile}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) setWidthPxMobile(Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, v)));
              }}
              className={styles.widthInput}
            />
          </div>
          <p className={styles.helpText}>
            Between {WIDTH_MIN} and {WIDTH_MAX} pixels. This controls how wide the logo appears on mobile devices (screens smaller than 768px).
          </p>
        </div>

        <div className={styles.formActions}>
          <button type="submit" className={styles.submitButton} disabled={saving}>
            {saving ? 'Saving…' : (imageFile || logo?.metadata?.imageUrl ? 'Save' : 'Save width')}
          </button>
        </div>
      </form>
    </div>
  );
}
