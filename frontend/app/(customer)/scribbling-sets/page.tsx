import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/seo';
import ScribblingSetsClient from './ScribblingSetsClient';

export const metadata: Metadata = {
  title: 'Scribbling Sets | Scribble Studios',
  description: 'Shop our custom scribbling sets, journals, and notepads.',
  alternates: {
    canonical: '/scribbling-sets',
  },
  openGraph: {
    title: 'Scribbling Sets | Scribble Studios',
    description: 'Shop our custom scribbling sets, journals, and notepads.',
    type: 'website',
    url: '/scribbling-sets',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Scribbling Sets | Scribble Studios',
    description: 'Shop our custom scribbling sets, journals, and notepads.',
  },
};

export default function ScribblingSetsPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Scribbling Sets | Scribble Studios',
      url: absoluteUrl('/scribbling-sets'),
      description: 'Shop our custom scribbling sets, journals, and notepads.',
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
