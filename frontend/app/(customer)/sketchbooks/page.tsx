import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: `Sketchbooks | ${SITE_NAME}`,
  description: 'Shop luxury bespoke sketchbooks from House Of Dahlia.',
  alternates: {
    canonical: '/sketchbooks',
  },
  openGraph: {
    title: `Sketchbooks | ${SITE_NAME}`,
    description: 'Shop luxury bespoke sketchbooks from House Of Dahlia.',
    type: 'website',
    url: '/sketchbooks',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Sketchbooks | ${SITE_NAME}`,
    description: 'Shop luxury bespoke sketchbooks from House Of Dahlia.',
  },
};

export default function SketchbooksPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Sketchbooks | ${SITE_NAME}`,
      url: absoluteUrl('/sketchbooks'),
      description: 'Shop luxury bespoke sketchbooks from House Of Dahlia.',
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
          name: 'Sketchbooks',
          item: absoluteUrl('/sketchbooks'),
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
      <ProductsClient categoryFilter="Sketchbooks" title="Sketchbooks" />
    </>
  );
}
