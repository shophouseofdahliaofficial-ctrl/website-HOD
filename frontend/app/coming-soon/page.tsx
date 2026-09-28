import { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Coming Soon | House of Dahlia',
  description: 'Coming soon',
};

export default function ComingSoonPage() {
  return (
    <main className={styles.wrapper}>
      <h1 className={styles.title}>Coming soon</h1>
    </main>
  );
}
