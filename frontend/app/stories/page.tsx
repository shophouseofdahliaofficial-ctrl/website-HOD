import Link from 'next/link';
import styles from './stories.module.css';

export const metadata = {
  title: 'Stories | House of Dahlia',
  description: 'Be the first to create a story with House of Dahlia.',
};

export default function StoriesPage() {
  return (
    <main className={styles.wrapper}>
      <h1 className={styles.title}>Be the first to create a story</h1>
      <Link href="/products" className={styles.shopButton}>
        Shop now
      </Link>
    </main>
  );
}
