import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: `MemoryBooks | ${SITE_NAME}`,
  description: 'Shop luxury bespoke memory books from House Of Dahlia.',
  alternates: {
    canonical: '/memorybooks',
  },
  openGraph: {
    title: `MemoryBooks | ${SITE_NAME}`,
    description: 'Shop luxury bespoke memory books from House Of Dahlia.',
    type: 'website',
    url: '/memorybooks',
  },
  twitter: {
    card: 'summary_large_image',
    title: `MemoryBooks | ${SITE_NAME}`,
    description: 'Shop luxury bespoke memory books from House Of Dahlia.',
  },
};

export default function MemoryBooksPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `MemoryBooks | ${SITE_NAME}`,
      url: absoluteUrl('/memorybooks'),
      description: 'Shop luxury bespoke memory books from House Of Dahlia.',
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
          name: 'MemoryBooks',
          item: absoluteUrl('/memorybooks'),
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
      <ProductsClient categoryFilter="MemoryBooks" title="MemoryBooks" />
    </>
  );
}
