'use client';

import { useEffect, useState } from 'react';
import { contentApi, SiteContent } from '@/lib/api';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import styles from './page.module.css';

/**
 * Terms & Conditions Page
 * Displays terms and conditions content
 */
export default function TermsPage() {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const data = await contentApi.getByType('terms');
      setContent(data);
    } catch (error) {
      console.error('Failed to fetch terms:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        padding: '2rem'
      }}>
        <LoadingSpinnerWithText text="Loading..." />
      </div>
    );
  }

  if (!content) {
    return (
      <div className={styles.container}>
        <h1>Terms & Conditions</h1>
        <p>Content not available.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{content.title}</h1>
      <div 
        className={styles.content}
        dangerouslySetInnerHTML={{ __html: content.content.replace(/\n/g, '<br />') }}
      />
    </div>
  );
}
