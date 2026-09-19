import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Sketchbooks | Scribble Studios',
  description: 'Shop our custom sketchbooks and add them to your cart.',
  alternates: {
    canonical: '/sketchbooks',
  },
  openGraph: {
    title: 'Sketchbooks | Scribble Studios',
    description: 'Shop our custom sketchbooks and add them to your cart.',
    type: 'website',
    url: '/sketchbooks',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sketchbooks | Scribble Studios',
    description: 'Shop our custom sketchbooks and add them to your cart.',
  },
};

export default function SketchbooksPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Sketchbooks | Scribble Studios',
      url: absoluteUrl('/sketchbooks'),
      description: 'Shop our custom sketchbooks and add them to your cart.',
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
