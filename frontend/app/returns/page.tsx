'use client';

import Link from 'next/link';
import styles from '../terms/page.module.css';

export default function ReturnsPage() {
  return (
    <div className={styles.container} style={{ maxWidth: '840px', margin: '0 auto', padding: '5rem 1.5rem 4rem' }}>
      <h1 className={styles.title} style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: '3rem', fontWeight: 400, color: '#111', marginBottom: '1.5rem' }}>
        Returns & Exchanges
      </h1>
      <div className={styles.content} style={{ color: '#444', lineHeight: 1.8, fontSize: '1.05rem' }}>
        <p>
          At <strong>House Of Dahlia</strong>, we strive to ensure that every couture piece and curated keepsake meets the highest standards of luxury and craftsmanship.
        </p>
        <h3 style={{ marginTop: '2rem', marginBottom: '0.75rem', color: '#111', fontSize: '1.35rem', fontFamily: 'var(--font-instrument-serif), Georgia, serif' }}>
          Eligibility for Return or Exchange
        </h3>
        <p>
          Items can be returned or exchanged within <strong>7 days</strong> of delivery, provided they are in their original unworn, unwashed condition with all tags and designer packaging intact.
        </p>
        <h3 style={{ marginTop: '2rem', marginBottom: '0.75rem', color: '#111', fontSize: '1.35rem', fontFamily: 'var(--font-instrument-serif), Georgia, serif' }}>
          Custom & Personalized Pieces
        </h3>
        <p>
          Please note that bespoke, customized, or made-to-order garments and engraved items are crafted exclusively for you and are non-refundable unless a manufacturing defect has occurred.
        </p>
        <h3 style={{ marginTop: '2rem', marginBottom: '0.75rem', color: '#111', fontSize: '1.35rem', fontFamily: 'var(--font-instrument-serif), Georgia, serif' }}>
          Initiate a Request
        </h3>
        <p>
          To initiate a return or exchange, please reach out to our concierge team at <Link href="/contact" style={{ color: '#AF5D6A', textDecoration: 'underline' }}>Contact Us</Link> or email us with your Order ID.
        </p>
      </div>
    </div>
  );
}
