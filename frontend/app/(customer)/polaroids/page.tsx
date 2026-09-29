import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: `Polas & Strips | ${SITE_NAME}`,
  description: 'Shop luxury bespoke photo prints, polaroids and strips from House Of Dahlia.',
  alternates: {
    canonical: '/polaroids',
  },
  openGraph: {
    title: `Polas & Strips | ${SITE_NAME}`,
    description: 'Shop luxury bespoke photo prints, polaroids and strips from House Of Dahlia.',
    type: 'website',
    url: '/polaroids',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Polas & Strips | ${SITE_NAME}`,
    description: 'Shop luxury bespoke photo prints, polaroids and strips from House Of Dahlia.',
  },
};

export default function PolaroidsPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Polas & Strips | ${SITE_NAME}`,
      url: absoluteUrl('/polaroids'),
      description: 'Shop luxury bespoke photo prints, polaroids and strips from House Of Dahlia.',
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
