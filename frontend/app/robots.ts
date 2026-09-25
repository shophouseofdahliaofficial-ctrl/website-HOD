import type { MetadataRoute } from 'next';
import { absoluteUrl, getSiteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/*',
          '/auth',
          '/auth/*',
          '/account',
          '/dashboard',
          '/subscriptions',
          '/subscriptions/*',
          '/cart',
          '/checkout',
          '/coming-soon',
          '/order-success',
          '/search',
          '/subscribe',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: siteUrl.host,
  };
}
