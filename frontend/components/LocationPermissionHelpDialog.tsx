'use client';

import { createPortal } from 'react-dom';
import styles from './LocationPermissionHelpDialog.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Must trigger geolocation synchronously inside the click handler (no await first). */
  onTryAgain: () => void;
  /** Some browsers only pick up new site permissions after a full reload. */
  onReloadPage?: () => void;
};

export default function LocationPermissionHelpDialog({
  open,
  onClose,
  onTryAgain,
  onReloadPage,
}: Props) {
  if (typeof document === 'undefined' || !open) return null;

  return createPortal(
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="milko-loc-perm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="milko-loc-perm-title" className={styles.title}>
          Turn on location access
        </h3>
        <p className={styles.body}>
          Location was blocked. After you set this site to <strong>Allow</strong> or <strong>Ask</strong> in settings, tap{' '}
          <strong>Try again</strong>—that runs location in the same tap so the browser can show the permission prompt
          again. If nothing happens, use <strong>Reload page</strong> once (some browsers cache the old choice until
          refresh).
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Chrome / Edge (desktop):</strong> lock or site icon in the address bar → Site settings → Location →
            Allow.
          </li>
          <li>
            <strong>Chrome (Android):</strong> lock icon → Permissions → Location → Allow.
          </li>
          <li>
            <strong>Safari (iPhone):</strong> Settings → Privacy &amp; Security → Location Services (or per-site Safari
            settings).
          </li>
        </ul>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTryAgain();
            }}
          >
            Try again
          </button>
          {onReloadPage ? (
            <button type="button" className={styles.btnSecondary} onClick={onReloadPage}>
              Reload page
            </button>
          ) : null}
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
