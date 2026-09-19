'use client';

import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  className?: string;
}

/**
 * Loading Spinner Component
 * Reusable spinner for loading states
 */
export default function LoadingSpinner({ 
  size = 'medium', 
  color = '#0070f3',
  className = '' 
}: LoadingSpinnerProps) {
  return (
    <div className={`${styles.spinnerContainer} ${styles[size]} ${className}`}>
      <svg
        className={styles.spinner}
        viewBox="0 0 50 50"
        style={{ color }}
      >
        <circle
          className={styles.path}
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/**
 * Loading Spinner with Text
 */
export function LoadingSpinnerWithText({ 
  text = 'Loading...', 
  size = 'medium',
  className = '' 
}: { 
  text?: string; 
  size?: 'small' | 'medium' | 'large';
  className?: string;
}) {
  return (
    <div className={`${styles.loadingWithText} ${className}`}>
      <LoadingSpinner size={size} />
      <span className={styles.loadingText}>{text}</span>
    </div>
  );
}
