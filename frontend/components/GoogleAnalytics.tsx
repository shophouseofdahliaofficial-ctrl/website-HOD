'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export default function GoogleAnalytics({
  measurementId,
}: {
  measurementId?: string;
}) {
  const pathname = usePathname();

  // Send page_view on client-side route changes (Next.js App Router)
  useEffect(() => {
    if (!measurementId || typeof window === 'undefined') return;
    if (typeof window.gtag === 'function') {
      window.gtag('config', measurementId, { page_path: pathname });
    }
  }, [pathname, measurementId]);

  if (!measurementId) return null;

  // Same as Google's tag: gtag.js + config. Loaded in head (beforeInteractive) per Google's instructions.
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="beforeInteractive"
      />
      <Script id="google-analytics" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
