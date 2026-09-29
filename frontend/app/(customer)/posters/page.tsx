import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: `Posters | ${SITE_NAME}`,
  description: 'Shop luxury bespoke prints and posters from House Of Dahlia.',
  alternates: {
    canonical: '/posters',
  },
  openGraph: {
    title: `Posters | ${SITE_NAME}`,
    description: 'Shop luxury bespoke prints and posters from House Of Dahlia.',
    type: 'website',
    url: '/posters',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Posters | ${SITE_NAME}`,
    description: 'Shop luxury bespoke prints and posters from House Of Dahlia.',
  },
};

export default function PostersPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Posters | ${SITE_NAME}`,
      url: absoluteUrl('/posters'),
      description: 'Shop luxury bespoke prints and posters from House Of Dahlia.',
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
