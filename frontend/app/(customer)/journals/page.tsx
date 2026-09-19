import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Journals | Scribble Studios',
  description: 'Shop our custom journals and add them to your cart.',
  alternates: {
    canonical: '/journals',
  },
  openGraph: {
    title: 'Journals | Scribble Studios',
    description: 'Shop our custom journals and add them to your cart.',
    type: 'website',
    url: '/journals',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Journals | Scribble Studios',
    description: 'Shop our custom journals and add them to your cart.',
  },
};

export default function JournalsPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Journals | Scribble Studios',
      url: absoluteUrl('/journals'),
      description: 'Shop our custom journals and add them to your cart.',
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
