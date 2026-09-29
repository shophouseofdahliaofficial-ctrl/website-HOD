import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: `Card Stocks | ${SITE_NAME}`,
  description: 'Shop premium card stocks from House Of Dahlia.',
  alternates: {
    canonical: '/cardstocks',
  },
  openGraph: {
    title: `Card Stocks | ${SITE_NAME}`,
    description: 'Shop premium card stocks from House Of Dahlia.',
    type: 'website',
    url: '/cardstocks',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Card Stocks | ${SITE_NAME}`,
    description: 'Shop premium card stocks from House Of Dahlia.',
  },
};

export default function CardStocksPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Card Stocks | ${SITE_NAME}`,
      url: absoluteUrl('/cardstocks'),
      description: 'Shop premium card stocks from House Of Dahlia.',
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
          name: 'Card Stocks',
          item: absoluteUrl('/cardstocks'),
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
      <ProductsClient categoryFilter="Card Stocks" title="Card Stocks" />
    </>
  );
}
