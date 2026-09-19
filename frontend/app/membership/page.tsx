import type { Metadata } from 'next';
import MembershipSection from '@/components/MembershipSection';
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: `Membership Plans | ${SITE_NAME}`,
  description: `Explore membership plans at ${SITE_NAME}.`,
  keywords: [
    'scribble studios membership',
    'creative studio plans',
    'membership plans',
  ],
  alternates: {
    canonical: '/membership',
  },
  openGraph: {
    title: `Membership Plans | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    type: 'website',
    url: '/membership',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Membership Plans | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
  },
};

export default function MembershipPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Membership Plans',
      url: absoluteUrl('/membership'),
      description: SITE_DESCRIPTION,
      isPartOf: {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: absoluteUrl('/'),
      },
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <MembershipSection />
    </>
  );
}
