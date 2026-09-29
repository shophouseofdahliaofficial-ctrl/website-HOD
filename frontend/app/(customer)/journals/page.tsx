import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: `Journals | ${SITE_NAME}`,
  description: 'Shop luxury bespoke journals from House Of Dahlia.',
  alternates: {
    canonical: '/journals',
  },
  openGraph: {
    title: `Journals | ${SITE_NAME}`,
    description: 'Shop luxury bespoke journals from House Of Dahlia.',
    type: 'website',
    url: '/journals',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Journals | ${SITE_NAME}`,
    description: 'Shop luxury bespoke journals from House Of Dahlia.',
  },
};

export default function JournalsPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Journals | ${SITE_NAME}`,
      url: absoluteUrl('/journals'),
      description: 'Shop luxury bespoke journals from House Of Dahlia.',
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
          name: 'Journals',
          item: absoluteUrl('/journals'),
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
      <ProductsClient categoryFilter="Journals" title="Journals" />
    </>
  );
}
