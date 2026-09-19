import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Papers | Scribble Studios',
  description: 'Shop our custom papers and add them to your cart.',
  alternates: {
    canonical: '/papers',
  },
  openGraph: {
    title: 'Papers | Scribble Studios',
    description: 'Shop our custom papers and add them to your cart.',
    type: 'website',
    url: '/papers',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Papers | Scribble Studios',
    description: 'Shop our custom papers and add them to your cart.',
  },
};

export default function PapersPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Papers | Scribble Studios',
      url: absoluteUrl('/papers'),
      description: 'Shop our custom papers and add them to your cart.',
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
