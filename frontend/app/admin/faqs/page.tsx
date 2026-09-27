'use client';

import { useEffect, useState } from 'react';
import { adminContentApi } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import styles from './page.module.css';

export interface FAQItem {
  id: string;
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

export default function AdminFAQsPage() {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpenIdx, setPreviewOpenIdx] = useState<number | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchFAQs();
  }, []);

  const fetchFAQs = async () => {
    try {
      setLoading(true);
      const data = await adminContentApi.getByType('faqs');
      if (data && data.metadata && Array.isArray(data.metadata.faqs) && data.metadata.faqs.length > 0) {
        setFaqs(data.metadata.faqs);
      } else {
        setFaqs(DEFAULT_FAQS);
      }
    } catch (error) {
      console.error('Failed to load FAQs:', error);
      // If not found yet, default to initial FAQs
      setFaqs(DEFAULT_FAQS);
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = () => {
    const newItem: FAQItem = {
      id: Date.now().toString(),
      question: '',
      answer: '',
    };
    setFaqs((prev) => [...prev, newItem]);
    showToast('New question added to the bottom', 'info');
  };

  const handleUpdate = (id: string, field: 'question' | 'answer', value: string) => {
    setFaqs((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleDelete = (id: string) => {
    setFaqs((prev) => prev.filter((item) => item.id !== id));
    showToast('Question removed', 'info');
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === faqs.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    setFaqs((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[newIndex];
      updated[newIndex] = temp;
      return updated;
    });
  };

  const handleResetDefaults = () => {
    if (confirm('Reset all questions to default House of Dahlia FAQs?')) {
      setFaqs(DEFAULT_FAQS);
      showToast('Reset to default FAQs', 'info');
    }
  };

  const handleSave = async () => {
    // Validate empty questions
    const validFaqs = faqs.filter(
      (f) => f.question.trim().length > 0 || f.answer.trim().length > 0
    );

    if (validFaqs.length === 0) {
      showToast('Please add at least one question and answer', 'error');
      return;
    }

    try {
      setSaving(true);
      await adminContentApi.update('faqs', {
        title: 'Frequently Asked Questions',
        content: 'House of Dahlia FAQs and customer support guide.',
        metadata: {
          faqs: validFaqs,
        },
      });
      setFaqs(validFaqs);
      showToast('FAQs saved and published successfully!', 'success');
    } catch (error: any) {
      console.error('Failed to save FAQs:', error);
      showToast(error.message || 'Failed to save FAQs', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Frequently Asked Questions</h1>
          <p className={styles.subtitle}>
            Add, update, reorder, or remove FAQs displayed on the customer /faqs page.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button type="button" onClick={handleResetDefaults} className={styles.addBtn} title="Reset to initial questions">
            Reset Defaults
          </button>
          <button type="button" onClick={handleAddQuestion} className={styles.addBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Question
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={styles.saveBtn}
          >
            {saving ? 'Saving...' : 'Save FAQs'}
          </button>
        </div>
      </div>

      {/* FAQ Cards List */}
      {faqs.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No FAQs Added Yet</p>
          <p className={styles.emptyText}>Click the button below to add your first question.</p>
          <button type="button" onClick={handleAddQuestion} className={styles.addBtn}>
            Add First Question
          </button>
        </div>
      ) : (
        <div className={styles.faqList}>
          {faqs.map((faq, idx) => (
            <div key={faq.id || idx} className={styles.faqCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIndex}>
                  Question #{idx + 1}
                </span>

                <div className={styles.cardControls}>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, 'up')}
                    disabled={idx === 0}
                    className={styles.iconBtn}
                    title="Move up"
                    aria-label="Move question up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, 'down')}
                    disabled={idx === faqs.length - 1}
                    className={styles.iconBtn}
                    title="Move down"
                    aria-label="Move question down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(faq.id)}
                    className={styles.deleteBtn}
                    title="Delete question"
                    aria-label="Delete question"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Question</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. How long does delivery take?"
                  value={faq.question}
                  onChange={(e) => handleUpdate(faq.id, 'question', e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Answer</label>
                <textarea
                  className={styles.textarea}
                  placeholder="e.g. Standard delivery takes 3 to 6 business days..."
                  value={faq.answer}
                  onChange={(e) => handleUpdate(faq.id, 'answer', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live Preview */}
      <div className={styles.previewSection}>
        <h2 className={styles.previewTitle}>Live Customer Preview</h2>
        <p className={styles.previewSubtitle}>
          Here is how your questions will appear on the live <strong>/faqs</strong> page:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {faqs
            .filter((f) => f.question.trim().length > 0)
            .map((faq, idx) => {
              const isOpen = previewOpenIdx === idx;
              return (
                <div
                  key={faq.id || idx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #eaeaea',
                    borderRadius: '14px',
                    padding: '1.1rem 1.4rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isOpen ? '0 4px 16px rgba(0,0,0,0.04)' : 'none',
                  }}
                  onClick={() => setPreviewOpenIdx(isOpen ? null : idx)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#111' }}>
                      {faq.question || 'Untitled Question'}
                    </h4>
                    <span style={{ fontSize: '1.35rem', color: '#AF5D6A', transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s ease', display: 'inline-block' }}>
                      +
                    </span>
                  </div>
                  {isOpen && (
                    <p style={{ margin: '0.85rem 0 0', color: '#555', lineHeight: 1.6, fontSize: '0.95rem', whiteSpace: 'pre-line' }}>
                      {faq.answer || 'No answer provided yet.'}
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
