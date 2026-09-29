import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: `Notepads | ${SITE_NAME}`,
  description: 'Shop luxury bespoke notepads from House Of Dahlia.',
  alternates: {
    canonical: '/notepads',
  },
  openGraph: {
    title: `Notepads | ${SITE_NAME}`,
    description: 'Shop luxury bespoke notepads from House Of Dahlia.',
    type: 'website',
    url: '/notepads',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Notepads | ${SITE_NAME}`,
    description: 'Shop luxury bespoke notepads from House Of Dahlia.',
  },
};

export default function NotepadsPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Notepads | ${SITE_NAME}`,
      url: absoluteUrl('/notepads'),
      description: 'Shop luxury bespoke notepads from House Of Dahlia.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: absoluteUrl('/'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Notepads',
          item: absoluteUrl('/notepads'),
        },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <ProductsClient categoryFilter="Notepads" title="Notepads" />
    </>
  );
}
