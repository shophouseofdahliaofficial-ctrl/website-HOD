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
      title: 'Subscriptions',
      href: '/admin/subscriptions',
      description: 'Manage subscriptions',
      icon: (
        <>
          <path d="M5 16L3 5L8.5 10L12 8L15.5 10L21 5L19 16H5Z" />
          <path d="M3 16H21" />
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
      title: 'Delivery rates',
      href: '/admin/content/delivery_rates',
      description: 'Warehouse distance-based checkout charges',
      icon: (
        <>
          <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
          <path d="M16 17h5" />
          <path d="M18.5 14.5v5" />
        </>
      ),
    },
    {
      title: 'Delivery time off',
      href: '/admin/content/delivery_time_off',
      description: 'After a daily cutoff (IST), ask customers to confirm before paying',
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6l4 2" />
        </>
      ),
    },
    {
      title: 'Photobooth settings',
      href: '/admin/content/photobooth_links',
      description: 'Configure links, cover images, and promo card placements for Polaroids and Photostrips',
      icon: (
        <>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
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

