'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './page.module.css';

type Card = {
  title: string;
  href: string;
  description: string;
  icon: ReactNode;
};

export default function AdminMorePage() {
  const cards: Card[] = [
    {
      title: 'Products',
      href: '/admin/products',
      description: 'Manage products',
      icon: (
        <>
          <path d="M21 16V8C21 6.9 20.1 6 19 6H5C3.9 6 3 6.9 3 8V16C3 17.1 3.9 18 5 18H19C20.1 18 21 17.1 21 16Z" />
          <path d="M3 10H21" />
          <path d="M8 14H8.01" />
        </>
      ),
    },
    {
      title: 'Banners',
      href: '/admin/banners',
      description: 'Manage banners',
      icon: (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
          <path d="M3 9H21" />
          <path d="M8 14L10.5 11.5L13 14L15.5 12L18 14.5" />
        </>
      ),
    },
    {
      title: 'Customers',
      href: '/admin/customers',
      description: 'Customer list & analytics',
      icon: (
        <>
          <path d="M12 12C14.7614 12 17 9.7614 17 7C17 4.2386 14.7614 2 12 2C9.2386 2 7 4.2386 7 7C7 9.7614 9.2386 12 12 12Z" />
          <path d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22" />
        </>
      ),
    },

    {
      title: 'Feedback',
      href: '/admin/feedback',
      description: 'Ratings & feedback',
      icon: <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />,
    },
    {
      title: 'Categories',
      href: '/admin/categories',
      description: 'Product categories',
      icon: (
        <>
          <path d="M3 3H10V10H3V3Z" />
          <path d="M14 3H21V10H14V3Z" />
          <path d="M3 14H10V21H3V14Z" />
          <path d="M14 14H21V21H14V14Z" />
        </>
      ),
    },
    {
      title: 'Coupons',
      href: '/admin/coupons',
      description: 'Discount coupons',
      icon: (
        <>
          <path d="M4 8.5C4 7.12 5.12 6 6.5 6H17.5C18.88 6 20 7.12 20 8.5V10C18.9 10 18 10.9 18 12C18 13.1 18.9 14 20 14V15.5C20 16.88 18.88 18 17.5 18H6.5C5.12 18 4 16.88 4 15.5V14C5.1 14 6 13.1 6 12C6 10.9 5.1 10 4 10V8.5Z" />
          <path d="M10 9H12" />
          <path d="M10 15H12" />
        </>
      ),
    },
    {
      title: 'Content',
      href: '/admin/content',
      description: 'Terms, privacy, about…',
      icon: (
        <>
          <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" />
          <path d="M14 2V8H20" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        </>
      ),
    },
    {
      title: 'Logo',
      href: '/admin/logo',
      description: 'Update logo',
      icon: (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16V12" />
          <path d="M12 8H12.01" />
        </>
      ),
    },
    {
      title: 'Favicon',
      href: '/admin/favicon',
      description: 'Update browser tab icon',
      icon: (
        <>
          <path d="M6 4H14L18 8V20H6V4Z" />
          <path d="M14 4V8H18" />
          <circle cx="12" cy="13" r="3" />
        </>
      ),
    },
    {
      title: 'Platform fees',
      href: '/admin/content/platform_fee',
      description: 'Set flat checkout fee',
      icon: (
        <>
          <path d="M6 7h12" />
          <path d="M6 12h8" />
          <path d="M6 17h10" />
          <path d="M17.5 10.5c1.93 0 3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5S14 15.93 14 14h3.5" />
        </>
      ),
    },
    {
      title: 'Gifting',
      href: '/admin/content/gifting',
      description: 'Manage gift wrap price & availability',
      icon: (
        <>
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </>
      ),
    },
    {
      title: 'COD Settings',
      href: '/admin/content/cod',
      description: 'Manage Cash on Delivery toggle & availability',
      icon: (
        <>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>More</h1>
        <p className={styles.subtitle}>All admin sections</p>
      </div>

      <div className={styles.grid}>
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className={styles.card}>
            <div className={styles.cardMain}>
              <div>
                <div className={styles.cardTitle}>{c.title}</div>
                <div className={styles.cardDesc}>{c.description}</div>
              </div>
              <span className={styles.cardIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" role="presentation">
                  {c.icon}
                </svg>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

