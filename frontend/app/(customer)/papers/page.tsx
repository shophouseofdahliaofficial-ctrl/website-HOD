import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: `Papers | ${SITE_NAME}`,
  description: 'Shop luxury bespoke paper collections from House Of Dahlia.',
  alternates: {
    canonical: '/papers',
  },
  openGraph: {
    title: `Papers | ${SITE_NAME}`,
    description: 'Shop luxury bespoke paper collections from House Of Dahlia.',
    type: 'website',
    url: '/papers',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Papers | ${SITE_NAME}`,
    description: 'Shop luxury bespoke paper collections from House Of Dahlia.',
  },
};

export default function PapersPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Papers | ${SITE_NAME}`,
      url: absoluteUrl('/papers'),
      description: 'Shop luxury bespoke paper collections from House Of Dahlia.',
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
          name: 'Papers',
          item: absoluteUrl('/papers'),
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
      <ProductsClient categoryFilter="Papers" title="Papers" />
    </>
  );
}
