import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Calendars | Scribble Studios',
  description: 'Shop our custom calendars and add them to your cart.',
  alternates: {
    canonical: '/calendars',
  },
  openGraph: {
    title: 'Calendars | Scribble Studios',
    description: 'Shop our custom calendars and add them to your cart.',
    type: 'website',
    url: '/calendars',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calendars | Scribble Studios',
    description: 'Shop our custom calendars and add them to your cart.',
  },
};

export default function CalendarsPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Calendars | Scribble Studios',
      url: absoluteUrl('/calendars'),
      description: 'Shop our custom calendars and add them to your cart.',
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
          name: 'Calendars',
          item: absoluteUrl('/calendars'),
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
      <ProductsClient categoryFilter="Calendars" title="Calendars" />
    </>
  );
}
