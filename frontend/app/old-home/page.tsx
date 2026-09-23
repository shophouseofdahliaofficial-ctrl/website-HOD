import Banner from '@/components/Banner';
import ProductsSection from '@/components/ProductsSection';
import MembershipSection from '@/components/MembershipSection';
import VerifyPromoSection from '@/components/VerifyPromoSection';
import Link from 'next/link';
import { absoluteUrl, DEFAULT_KEYWORDS, SITE_ALTERNATE_NAME, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo';

export const metadata = {
  title: `${SITE_NAME} (Legacy Home)`,
  description: SITE_DESCRIPTION,
};

/**
 * Archived Legacy Home Page
 * Preserved for future reference
 */
export default function LegacyHomePage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: SITE_ALTERNATE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
    },
  ];

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Banner />
      <ProductsSection />
      <MembershipSection />
      <VerifyPromoSection />
    </div>
  );
}
