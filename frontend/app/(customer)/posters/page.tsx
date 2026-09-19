import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Posters | Scribble Studios',
  description: 'Shop our custom posters and add them to your cart.',
  alternates: {
    canonical: '/posters',
  },
  openGraph: {
    title: 'Posters | Scribble Studios',
    description: 'Shop our custom posters and add them to your cart.',
    type: 'website',
    url: '/posters',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Posters | Scribble Studios',
    description: 'Shop our custom posters and add them to your cart.',
  },
};

export default function PostersPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Posters | Scribble Studios',
      url: absoluteUrl('/posters'),
      description: 'Shop our custom posters and add them to your cart.',
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
          name: 'Posters',
          item: absoluteUrl('/posters'),
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
      <ProductsClient categoryFilter="Posters" title="Posters" />
    </>
  );
}
