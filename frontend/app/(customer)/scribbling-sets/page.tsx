import type { Metadata } from 'next';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';
import ScribblingSetsClient from './ScribblingSetsClient';

export const metadata: Metadata = {
  title: `Scribbling Sets | ${SITE_NAME}`,
  description: 'Shop custom luxury stationery & scribbling sets from House Of Dahlia.',
  alternates: {
    canonical: '/scribbling-sets',
  },
  openGraph: {
    title: `Scribbling Sets | ${SITE_NAME}`,
    description: 'Shop custom luxury stationery & scribbling sets from House Of Dahlia.',
    type: 'website',
    url: '/scribbling-sets',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Scribbling Sets | ${SITE_NAME}`,
    description: 'Shop custom luxury stationery & scribbling sets from House Of Dahlia.',
  },
};

export default function ScribblingSetsPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Scribbling Sets | ${SITE_NAME}`,
      url: absoluteUrl('/scribbling-sets'),
      description: 'Shop custom luxury stationery & scribbling sets from House Of Dahlia.',
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
          name: 'Scribbling Sets',
          item: absoluteUrl('/scribbling-sets'),
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
      <ScribblingSetsClient />
    </>
  );
}
