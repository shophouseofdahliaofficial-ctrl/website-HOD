'use client';

import { useEffect, useState } from 'react';
import { contentApi, SiteContent } from '@/lib/api';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import styles from './page.module.css';

/**
 * Exchanges & Refunds Policy Page
 * Displays dynamically editable exchanges and refunds content from Admin
 */
export default function RefundsPage() {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const data = await contentApi.getByType('refunds');
      setContent(data);
    } catch (error) {
      console.error('Failed to fetch refunds policy:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          padding: '2rem',
        }}
      >
        <LoadingSpinnerWithText text="Loading..." />
      </div>
    );
  }

  if (!content) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Exchanges & Refunds</h1>
        <div className={styles.content}>
          <p>
            At House Of Dahlia, we take pride in delivering premium quality, finely crafted products.
            If your order arrives damaged, defective, or incorrect, please reach out to us within 48 hours
            for a free replacement or resolution.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{content.title || 'Exchanges & Refunds'}</h1>
      <div
        className={styles.content}
        dangerouslySetInnerHTML={{
          __html: (content.content || '').replace(/\n/g, '<br />'),
        }}
      />
    </div>
  );
}
