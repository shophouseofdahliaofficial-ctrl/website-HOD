import Banner from '@/components/Banner';
import ProductsSection from '@/components/ProductsSection';
import MembershipSection from '@/components/MembershipSection';
import VerifyPromoSection from '@/components/VerifyPromoSection';
import Link from 'next/link';
import { absoluteUrl, DEFAULT_KEYWORDS, SITE_ALTERNATE_NAME, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo';

export const metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    type: 'website',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

/**
 * Home Page
 */
export default function HomePage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: SITE_ALTERNATE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${absoluteUrl('/search')}?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: SITE_NAME,
      alternateName: SITE_ALTERNATE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      areaServed: ['Gwalior', 'Madhya Pradesh', 'India'],
      sameAs: [SITE_URL],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'House Of Dahlia main pages',
      itemListElement: [
        {
          '@type': 'SiteNavigationElement',
          position: 1,
          name: 'Home',
          url: absoluteUrl('/'),
        },
        {
          '@type': 'SiteNavigationElement',
          position: 2,
          name: 'Membership',
          url: absoluteUrl('/membership'),
        },
        {
          '@type': 'SiteNavigationElement',
          position: 3,
          name: 'Products',
          url: absoluteUrl('/products'),
        },
        {
          '@type': 'SiteNavigationElement',
          position: 4,
          name: 'Orders',
          url: absoluteUrl('/orders'),
        },
      ],
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

      <nav aria-label="Key Pages" className="visuallyHidden">
        <ul>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/membership">Membership</Link>
          </li>
          <li>
            <Link href="/products">Products</Link>
          </li>
          <li>
            <Link href="/orders">Orders</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

