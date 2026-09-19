import Link from 'next/link';
import styles from './MobileBackToAccount.module.css';

/**
 * Back-to-Account link shown only on mobile when viewing an option page
 * (dashboard, orders, subscriptions, reviews, about, contact, privacy, terms).
 * Hidden on desktop and on the /account page itself.
 */
export default function MobileBackToAccount() {
  return (
    <div className={styles.wrapper}>
      <Link href="/account" className={styles.backLink}>
        <svg className={styles.backIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back
      </Link>
    </div>
  );
}
