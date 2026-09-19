import type { Metadata } from 'next';
import styles from './layout.module.css';

export const metadata: Metadata = {
  title: 'PhotoBooth',
  description: 'Create a scrapbook of moments — Scribble Studios PhotoBooth.',
};

export default function PhotoboothLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.smoothRoot}>
      {children}
    </div>
  );
}
