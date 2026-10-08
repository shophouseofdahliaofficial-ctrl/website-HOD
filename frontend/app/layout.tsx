import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import '@fontsource-variable/inter';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/epilogue';
import './globals.css';
import { Inter, Epilogue } from 'next/font/google';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { ToastProvider } from '@/contexts/ToastContext';
import OAuthErrorHandler from '@/components/OAuthErrorHandler';
import Header from '@/components/Header';
import AdminHeader from '@/components/AdminHeader';
import ConditionalHeader from '@/components/ConditionalHeader';
import ConditionalFooter from '@/components/ConditionalFooter';

import Toast from '@/components/Toast';
import TopAmbientGlow from '@/components/ui/TopAmbientGlow';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import MetaPixel from '@/components/MetaPixel';
import NativeGoogleBridge from '@/components/NativeGoogleBridge';
import FaviconManager from '@/components/FaviconManager';
import BottomBlurStrip from '@/components/BottomBlurStrip';
import SmoothScroll from '@/components/SmoothScroll';
import { DEFAULT_KEYWORDS, GA_MEASUREMENT_ID, SITE_DESCRIPTION, SITE_NAME, getSiteUrl } from '@/lib/seo';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
});

const epilogue = Epilogue({
  subsets: ['latin'],
  variable: '--font-epilogue',
  display: 'swap',
  fallback: ['Epilogue', 'sans-serif'],
});

const itcFenice = localFont({
  src: '../fonts/ITC Fenice Regular.otf',
  variable: '--font-instrument-serif',
  display: 'swap',
});

const chupsItalic = localFont({
  src: '../fonts/Chups italic ttf.ttf',
  variable: '--font-chups-italic',
  display: 'swap',
});

function metadataBaseUrl(): URL {
  return getSiteUrl();
}

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: metadataBaseUrl(),
  keywords: DEFAULT_KEYWORDS,
  applicationName: SITE_NAME,
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: '/',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://houseofdahlia.in/#organization',
        name: SITE_NAME,
        url: 'https://houseofdahlia.in',
        logo: {
          '@type': 'ImageObject',
          url: 'https://houseofdahlia.in/finallogo.png',
        },
        description: SITE_DESCRIPTION,
        email: 'contact@houseofdahlia.in',
        sameAs: ['https://www.instagram.com/houseofdahlia.official/'],
      },
      {
        '@type': 'WebSite',
        '@id': 'https://houseofdahlia.in/#website',
        url: 'https://houseofdahlia.in',
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: {
          '@id': 'https://houseofdahlia.in/#organization',
        },
      },
      {
        '@type': 'ItemList',
        '@id': 'https://houseofdahlia.in/#sitelinks',
        name: 'House Of Dahlia Key Navigation',
        itemListElement: [
          {
            '@type': 'SiteNavigationElement',
            position: 1,
            name: 'Home',
            description: "House Of Dahlia official store — luxury women's clothing & atelier",
            url: 'https://houseofdahlia.in/',
          },
          {
            '@type': 'SiteNavigationElement',
            position: 2,
            name: 'Products',
            description: "Explore bespoke collections, luxury apparel, and designer dresses",
            url: 'https://houseofdahlia.in/products',
          },
          {
            '@type': 'SiteNavigationElement',
            position: 3,
            name: 'My Account',
            description: "View and manage your House Of Dahlia account, orders, and details",
            url: 'https://houseofdahlia.in/account',
          },
          {
            '@type': 'SiteNavigationElement',
            position: 4,
            name: 'About Us',
            description: "Learn about the House Of Dahlia story, heritage, and atelier craftsmanship",
            url: 'https://houseofdahlia.in/about',
          },
          {
            '@type': 'SiteNavigationElement',
            position: 5,
            name: 'Exchanges and Refunds',
            description: "House Of Dahlia policy and guidelines on hassle-free exchanges and returns",
            url: 'https://houseofdahlia.in/exchanges-and-refunds',
          },
        ],
      },
    ],
  };

  return (
    <html lang="en" className={`${inter.variable} ${epilogue.variable} ${itcFenice.variable} ${chupsItalic.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Epilogue:ital,wght@0,300..900;1,300..900&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <CartProvider>
            <ToastProvider>
              <SmoothScroll>
                <Suspense fallback={null}>
                  <OAuthErrorHandler />
                </Suspense>
                <FaviconManager />
                <NativeGoogleBridge />
                <ConditionalHeader />
                {children}
                <ConditionalFooter />

                <Toast />
                <TopAmbientGlow />
                <Analytics />
                <SpeedInsights />
                <GoogleAnalytics measurementId={GA_MEASUREMENT_ID} />
                <MetaPixel pixelId="1610748856653453" />
                <BottomBlurStrip />
              </SmoothScroll>
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

