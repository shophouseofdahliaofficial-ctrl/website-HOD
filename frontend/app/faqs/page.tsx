'use client';

import { useEffect, useState } from 'react';
import { contentApi } from '@/lib/api';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import styles from './faqs.module.css';

interface FAQItem {
  id?: string;
  question: string;
  answer: string;
}

const DEFAULT_FAQS: FAQItem[] = [
  {
    id: '1',
    question: 'What is House Of Dahlia?',
    answer: "House Of Dahlia is a contemporary luxury women's clothing brand and atelier creating couture fashion, bespoke dresses, and artisanal apparel crafted with sustainable materials and exquisite detailing.",
  },
  {
    id: '2',
    question: 'How long does shipping take?',
    answer: 'Standard nationwide shipping typically takes 3 to 6 business days. Express shipping options are available at checkout.',
  },
  {
    id: '3',
    question: 'Do you offer international shipping?',
    answer: 'Yes, we ship globally! International delivery timelines vary between 7 to 14 business days depending on customs and location.',
  },
  {
    id: '4',
    question: 'How can I track my order?',
    answer: 'Once your package has been dispatched, you will receive a tracking link via email and SMS. You can also view real-time updates in your Account under Orders.',
  },
  {
    id: '5',
    question: 'What payment methods are accepted?',
    answer: 'We accept UPI, all major Credit/Debit Cards, Net Banking, and Dahlia Wallet balance.',
  },
];

export default function FAQsPage() {
  const [faqs, setFaqs] = useState<FAQItem[]>(DEFAULT_FAQS);
  const [loading, setLoading] = useState(true);
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  useEffect(() => {
    let isMounted = true;

    async function loadFAQs() {
      try {
        const data = await contentApi.getByType('faqs', true);
        if (!isMounted) return;

        if (
          data &&
          data.metadata &&
          Array.isArray(data.metadata.faqs) &&
          data.metadata.faqs.length > 0
        ) {
          setFaqs(data.metadata.faqs);
        }
      } catch (error) {
        console.warn('Could not load dynamic FAQs, using defaults:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadFAQs();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '2rem',
        }}
      >
        <LoadingSpinnerWithText text="Just a moment..." />
      </div>
    );
  }

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Frequently Asked Questions</h1>
      <p className={styles.subtitle}>
        Find quick answers to common questions about our couture collections, bespoke tailoring, shipping, and services.
      </p>

      {faqs.length === 0 ? (
        <div className={styles.emptyBox}>
          <p>No questions have been published yet.</p>
        </div>
      ) : (
        <div className={styles.accordionList}>
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={faq.id || idx}
                className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ''}`}
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOpenIdx(isOpen ? null : idx);
                  }
                }}
                aria-expanded={isOpen}
              >
                <div className={styles.questionRow}>
                  <h3 className={styles.questionText}>{faq.question}</h3>
                  <span
                    className={`${styles.toggleIcon} ${
                      isOpen ? styles.toggleIconRotated : ''
                    }`}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </div>
                {isOpen && (
                  <div className={styles.answerContent}>
                    <p style={{ margin: 0 }}>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
