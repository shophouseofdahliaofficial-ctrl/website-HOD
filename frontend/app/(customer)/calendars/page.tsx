import type { Metadata } from 'next';
import ProductsClient from '../products/ProductsClient';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: `Calendars | ${SITE_NAME}`,
  description: 'Shop luxury bespoke calendars from House Of Dahlia.',
  alternates: {
    canonical: '/calendars',
  },
  openGraph: {
    title: `Calendars | ${SITE_NAME}`,
    description: 'Shop luxury bespoke calendars from House Of Dahlia.',
    type: 'website',
    url: '/calendars',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Calendars | ${SITE_NAME}`,
    description: 'Shop luxury bespoke calendars from House Of Dahlia.',
  },
};

export default function CalendarsPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Calendars | ${SITE_NAME}`,
      url: absoluteUrl('/calendars'),
      description: 'Shop luxury bespoke calendars from House Of Dahlia.',
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
