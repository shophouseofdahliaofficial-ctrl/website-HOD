import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Planners | Scribble Studios',
  description: 'Shop our custom planners and add them to your cart.',
  alternates: {
    canonical: '/planners',
  },
  openGraph: {
    title: 'Planners | Scribble Studios',
    description: 'Shop our custom planners and add them to your cart.',
    type: 'website',
    url: '/planners',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Planners | Scribble Studios',
    description: 'Shop our custom planners and add them to your cart.',
  },
};

export default function PlannersPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Planners | Scribble Studios',
      url: absoluteUrl('/planners'),
      description: 'Shop our custom planners and add them to your cart.',
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
          name: 'Planners',
          item: absoluteUrl('/planners'),
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
      <ProductsClient categoryFilter="Planners" title="Planners" />
    </>
  );
}
