'use client';

import { useState } from 'react';
import styles from '../terms/page.module.css';

export default function FAQsPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'What is House Of Dahlia?',
      a: 'House Of Dahlia is a contemporary luxury atelier creating couture fashion, bespoke memory keepsakes, and handcrafted stationery crafted with sustainable materials and exquisite detailing.',
    },
    {
      q: 'How long does shipping take?',
      a: 'Standard nationwide shipping typically takes 3 to 6 business days. Express shipping options are available at checkout.',
    },
    {
      q: 'Do you offer international shipping?',
      a: 'Yes, we ship globally! International delivery timelines vary between 7 to 14 business days depending on customs and location.',
    },
    {
      q: 'How can I track my order?',
      a: 'Once your package has been dispatched, you will receive a tracking link via email and SMS. You can also view real-time updates in your Account under Orders.',
    },
    {
      q: 'What payment methods are accepted?',
      a: 'We accept UPI, all major Credit/Debit Cards, Net Banking, and Dahlia Wallet balance.',
    },
  ];

  return (
    <div className={styles.container} style={{ maxWidth: '840px', margin: '0 auto', padding: '5rem 1.5rem 4rem' }}>
      <h1 className={styles.title} style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: '3rem', fontWeight: 400, color: '#111', marginBottom: '1.5rem' }}>
        Frequently Asked Questions
      </h1>
      <div className={styles.content}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                style={{
                  background: '#ffffff',
                  border: '1px solid #eaeaea',
                  borderRadius: '16px',
                  padding: '1.25rem 1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isOpen ? '0 4px 20px rgba(0,0,0,0.04)' : 'none',
                }}
                onClick={() => setOpenIdx(isOpen ? null : idx)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#111' }}>
                    {faq.q}
                  </h3>
                  <span style={{ fontSize: '1.5rem', color: '#AF5D6A', transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s ease', display: 'inline-block' }}>
                    +
                  </span>
                </div>
                {isOpen && (
                  <p style={{ margin: '1rem 0 0', color: '#555', lineHeight: 1.7, fontSize: '1rem' }}>
                    {faq.a}
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
