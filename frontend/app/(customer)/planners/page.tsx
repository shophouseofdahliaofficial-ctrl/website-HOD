import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: `Planners | ${SITE_NAME}`,
  description: 'Shop luxury bespoke planners from House Of Dahlia.',
  alternates: {
    canonical: '/planners',
  },
  openGraph: {
    title: `Planners | ${SITE_NAME}`,
    description: 'Shop luxury bespoke planners from House Of Dahlia.',
    type: 'website',
    url: '/planners',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Planners | ${SITE_NAME}`,
    description: 'Shop luxury bespoke planners from House Of Dahlia.',
  },
};

export default function PlannersPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Planners | ${SITE_NAME}`,
      url: absoluteUrl('/planners'),
      description: 'Shop luxury bespoke planners from House Of Dahlia.',
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
