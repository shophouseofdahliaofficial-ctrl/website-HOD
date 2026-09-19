'use client';

import { useEffect, useState } from 'react';
import { contentApi, SiteContent } from '@/lib/api';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import styles from '../terms/page.module.css';

/**
 * About Us Page
 */
export default function AboutPage() {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const data = await contentApi.getByType('about');
      setContent(data);
    } catch (error) {
      console.error('Failed to fetch about content:', error);
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
        <h1>About Us</h1>
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
