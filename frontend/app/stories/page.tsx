'use client';

import Link from 'next/link';
import styles from '../terms/page.module.css';

export default function StoriesPage() {
  const stories = [
    {
      title: 'The Art of Dahlia: Modern Couture & Botanical Elegance',
      date: 'September 2026',
      readTime: '4 min read',
      excerpt: 'Explore the inspiration behind our signature blossom embellishments, delicate tulle overlays, and artisanal tailoring.',
    },
    {
      title: 'Crafting Memories: Why Tangible Keepsakes Matter',
      date: 'August 2026',
      readTime: '5 min read',
      excerpt: 'In an era of fleeting digital moments, discover the lasting warmth and legacy of hardcover photobooks and fine art prints.',
    },
    {
      title: 'Sustainable Luxury: Our Commitment to Ethical Craft',
      date: 'July 2026',
      readTime: '3 min read',
      excerpt: 'From acid-free archival papers to zero-waste pattern drafting, how we curate every detail with care for our planet.',
    },
  ];

  return (
    <div className={styles.container} style={{ maxWidth: '880px', margin: '0 auto', padding: '5rem 1.5rem 4rem' }}>
      <h1 className={styles.title} style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: '3.2rem', fontWeight: 400, color: '#111', marginBottom: '0.75rem' }}>
        Stories & Editorials
      </h1>
      <p style={{ color: '#666', fontSize: '1.1rem', marginBottom: '3rem' }}>
        Narratives on couture design, botanical aesthetics, craftsmanship, and timeless keepsakes.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {stories.map((story, idx) => (
          <article
            key={idx}
            style={{
              padding: '2rem',
              borderRadius: '24px',
              background: '#faf8fa',
              border: '1px solid #f0edf0',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: '#AF5D6A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              {story.date} • {story.readTime}
            </div>
            <h2 style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: '1.85rem', color: '#111', margin: '0.25rem 0 0.75rem', fontWeight: 400 }}>
              {story.title}
            </h2>
            <p style={{ color: '#555', lineHeight: 1.7, margin: '0 0 1.25rem' }}>
              {story.excerpt}
            </p>
            <Link
              href="/products"
              style={{
                color: '#AF5D6A',
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: '0.95rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              Read story &rarr;
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
