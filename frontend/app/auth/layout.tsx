import React from 'react';
import AuthGalleryColumn from '@/components/auth/AuthGalleryColumn';
import styles from './auth.module.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.authSplitContainer}>
      {/* Left Column: Pure White Auth Content */}
      <div className={styles.leftAuthColumn}>
        {children}
      </div>

      {/* Right Column: Aesthetic Square Gallery & Editorial Caption */}
      <div className={styles.rightGalleryColumn}>
        <AuthGalleryColumn />
      </div>
    </div>
  );
}
