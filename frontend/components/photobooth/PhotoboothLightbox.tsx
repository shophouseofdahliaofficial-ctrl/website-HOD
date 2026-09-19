'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import type { PhotoboothPhoto } from '@/lib/photobooth/constants';
import styles from './photobooth.module.css';

type PhotoboothLightboxProps = {
  photo: PhotoboothPhoto | null;
  onClose: () => void;
};

export default function PhotoboothLightbox({ photo, onClose }: PhotoboothLightboxProps) {
  useEffect(() => {
    if (!photo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [photo, onClose]);

  if (!photo) return null;

  return (
    <div className={styles.lightboxOverlay} role="dialog" aria-modal="true" aria-label={photo.alt}>
      <button type="button" className={styles.lightboxBackdrop} onClick={onClose} aria-label="Close" />
      <div className={styles.lightboxPanel}>
        <button type="button" className={styles.lightboxClose} onClick={onClose} aria-label="Close">
          <svg
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className={styles.lightboxPolaroid}>
          <div className={styles.lightboxImageWrap}>
            <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 768px) 90vw, 520px" className={styles.lightboxImage} />
          </div>
          <p className={styles.lightboxCaption}>{photo.alt}</p>
        </div>
      </div>
    </div>
  );
}
