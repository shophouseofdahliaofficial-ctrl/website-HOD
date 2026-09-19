import type { Metadata } from 'next';
import ProductsClient from './ProductsClient';
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: `Our Products | ${SITE_NAME}`,
  description: `Browse and shop products from ${SITE_NAME}.`,
  alternates: {
    canonical: '/products',
  },
  openGraph: {
    title: `Our Products | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    type: 'website',
    url: '/products',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Our Products | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
  },
};

export default function ProductsPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Our Products | ${SITE_NAME}`,
      url: absoluteUrl('/products'),
      description: SITE_DESCRIPTION,
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
          name: 'Products',
          item: absoluteUrl('/products'),
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
      <ProductsClient />
    </>
  );
}
