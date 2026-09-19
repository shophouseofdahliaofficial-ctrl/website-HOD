import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'MemoryBooks | Scribble Studios',
  description: 'Shop our custom memory books and add them to your cart.',
  alternates: {
    canonical: '/memorybooks',
  },
  openGraph: {
    title: 'MemoryBooks | Scribble Studios',
    description: 'Shop our custom memory books and add them to your cart.',
    type: 'website',
    url: '/memorybooks',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MemoryBooks | Scribble Studios',
    description: 'Shop our custom memory books and add them to your cart.',
  },
};

export default function MemoryBooksPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'MemoryBooks | Scribble Studios',
      url: absoluteUrl('/memorybooks'),
      description: 'Shop our custom memory books and add them to your cart.',
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
