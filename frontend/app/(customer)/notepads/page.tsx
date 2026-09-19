import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Notepads | Scribble Studios',
  description: 'Shop our custom notepads and add them to your cart.',
  alternates: {
    canonical: '/notepads',
  },
  openGraph: {
    title: 'Notepads | Scribble Studios',
    description: 'Shop our custom notepads and add them to your cart.',
    type: 'website',
    url: '/notepads',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Notepads | Scribble Studios',
    description: 'Shop our custom notepads and add them to your cart.',
  },
};

export default function NotepadsPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Notepads | Scribble Studios',
      url: absoluteUrl('/notepads'),
      description: 'Shop our custom notepads and add them to your cart.',
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
