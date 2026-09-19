'use client';

import React from 'react';
import styles from './VerifyPromoSection.module.css';

export default function VerifyPromoSection() {
  return (
    <section className={styles.verifyPromoSection} aria-labelledby="authenticity-title">
      <div className={styles.container}>
        {/* Floating Coming Soon Badge */}
        <div className={styles.comingSoonBadge}>
          <span className={styles.badgeDot} />
          Coming soon
        </div>

        {/* Pulsing Verified Check Icon */}
        <div className={styles.iconOuter}>
          <div className={styles.iconInner}>
            <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 id="authenticity-title" className={styles.title}>
          Check if your product is fake or real?
        </h2>

        {/* Description */}
        <p className={styles.description}>
          Verify the authenticity of your House Of Dahlia products. Enter the 6-digit verification code on your packaging to check if your product is genuine instantly.
        </p>
      </div>
    </section>
  );
}
