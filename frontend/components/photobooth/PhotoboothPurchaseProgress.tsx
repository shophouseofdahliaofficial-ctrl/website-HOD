'use client';

import type { PurchaseProgress } from '@/lib/photobooth/purchaseFlow';
import styles from '@/app/photobooth/page.module.css';

type Props = {
  open: boolean;
  progress: PurchaseProgress | null;
  error?: string | null;
  onClose?: () => void;
};

export default function PhotoboothPurchaseProgress({ open, progress, error, onClose }: Props) {
  if (!open) return null;

  return (
    <div className={`${styles.downloadPopupOverlay} ${styles.downloadPopupOverlayActive}`}>
      <div className={styles.downloadPopupContainer}>
        {onClose && !progress && (
          <button onClick={onClose} className={styles.popupCloseButton} aria-label="Close" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        <h3 className={styles.downloadPopupTitle}>
          {error ? 'Something went wrong' : 'Preparing your print order'}
        </h3>
        <p className={styles.downloadPopupDesc}>
          {error || (progress ? 'uploading your keepshakes' : 'Please wait…')}
        </p>
        {!error && (
          <>
            <div className={styles.progressBarWrapper}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${progress?.percent ?? 0}%` }}
              />
            </div>
            <span className={styles.progressText}>{Math.round(progress?.percent ?? 0)}% Completed</span>
          </>
        )}
        {error && onClose && (
          <button type="button" className={styles.retryButton} onClick={onClose} style={{ marginTop: '1rem' }}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}
