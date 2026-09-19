'use client';

import { useEffect, useState } from 'react';
import { contentApi } from '@/lib/api';
import styles from './AppDownloadBanner.module.css';

export default function AppDownloadBanner() {
  const [show, setShow] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');

  useEffect(() => {
    // 1. Check if hidden in localStorage (3-day logic)
    const lastClosed = localStorage.getItem('milko-app-banner-closed');
    if (lastClosed) {
      const closedDate = new Date(parseInt(lastClosed, 10));
      const now = new Date();
      const diffDays = (now.getTime() - closedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < 3) {
        return;
      }
    }

    // 2. Mobile check (same as nav)
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    // 3. Fetch link and favicon separately so one doesn't block the other
    const loadData = async () => {
      try {
        // Fetch download link
        contentApi.getByType('app_download').then(data => {
          setDownloadUrl(data?.metadata?.downloadAppUrl || '');
          if (data?.metadata?.downloadAppUrl) setShow(true);
        }).catch(() => {
          // If download link fails, we might still show if we have a default URL,
          // but usually it's best to stay hidden.
        });

        // Fetch icon (favicon with logo as fallback)
        const getBestIcon = async () => {
          try {
            const fav = await contentApi.getByType('favicon');
            if (fav?.metadata?.imageUrl) return fav.metadata.imageUrl;
          } catch { /* ignore */ }

          try {
            const logo = await contentApi.getByType('logo');
            if (logo?.metadata?.imageUrl) return logo.metadata.imageUrl;
          } catch { /* ignore */ }

          return null;
        };

        const icon = await getBestIcon();
        if (icon) setFaviconUrl(icon);

      } catch (e) {
        // Silently fail
      }
    };

    void loadData();
  }, []);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    localStorage.setItem('milko-app-banner-closed', Date.now().toString());
    setShow(false);
  };

  const handleContainerClick = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!show) return null;

  return (
    <div className={styles.banner} onClick={handleContainerClick}>
      <div className={styles.content}>
        {faviconUrl && (
          <img src={faviconUrl} alt="House Of Dahlia" className={styles.favicon} />
        )}
        <span className={styles.text}>Download app for better experience. Really!</span>
      </div>
      <button
        className={styles.closeBtn}
        onClick={handleClose}
        aria-label="Close app download banner"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  );
}
