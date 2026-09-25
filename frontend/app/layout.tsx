import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
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
});

const epilogue = Epilogue({
  subsets: ['latin'],
  variable: '--font-epilogue',
  display: 'swap',
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
  return (
    <html lang="en" className={`${inter.variable} ${epilogue.variable} ${itcFenice.variable} ${chupsItalic.variable}`} suppressHydrationWarning>
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

