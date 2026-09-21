'use client';

import React from 'react';
import Link from 'next/link';
import styles from './AuthGalleryColumn.module.css';

export interface AuthGalleryColumnProps {
  productNumber?: string;
  shopHref?: string;
}

export default function AuthGalleryColumn({
  productNumber = 'Product No. X215',
  shopHref = '/products',
}: AuthGalleryColumnProps) {
  return (
    <div className={styles.galleryContainer}>
      {/* Featured Final Artwork / Image */}
      <div className={styles.imageWrapper}>
        <img
          src="/final.png"
          alt="House Of Dahlia"
          className={styles.editorialImage}
          loading="eager"
        />
      </div>

      {/* Editorial Caption */}
      <div className={styles.captionBlock}>
        <p className={styles.productNumberText}>{productNumber}</p>
        <Link href={shopHref} className={styles.shopNowLink}>
          Shop now
        </Link>
      </div>
    </div>
  );
}
