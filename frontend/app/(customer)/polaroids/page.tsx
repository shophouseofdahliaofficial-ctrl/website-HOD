import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Polas & Strips | Scribble Studios',
  description: 'Shop our custom polaroids and strips and add them to your cart.',
  alternates: {
    canonical: '/polaroids',
  },
  openGraph: {
    title: 'Polas & Strips | Scribble Studios',
    description: 'Shop our custom polaroids and strips and add them to your cart.',
    type: 'website',
    url: '/polaroids',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Polas & Strips | Scribble Studios',
    description: 'Shop our custom polaroids and strips and add them to your cart.',
  },
};

export default function PolaroidsPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Polas & Strips | Scribble Studios',
      url: absoluteUrl('/polaroids'),
      description: 'Shop our custom polaroids and strips and add them to your cart.',
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
          name: 'Polas & Strips',
          item: absoluteUrl('/polaroids'),
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
      <ProductsClient categoryFilter="Polas & Strips" title="Polas & Strips" />
    </>
  );
}
