import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Card Stocks | Scribble Studios',
  description: 'Shop our custom card stocks and add them to your cart.',
  alternates: {
    canonical: '/cardstocks',
  },
  openGraph: {
    title: 'Card Stocks | Scribble Studios',
    description: 'Shop our custom card stocks and add them to your cart.',
    type: 'website',
    url: '/cardstocks',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Card Stocks | Scribble Studios',
    description: 'Shop our custom card stocks and add them to your cart.',
  },
};

export default function CardStocksPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Card Stocks | Scribble Studios',
      url: absoluteUrl('/cardstocks'),
      description: 'Shop our custom card stocks and add them to your cart.',
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
