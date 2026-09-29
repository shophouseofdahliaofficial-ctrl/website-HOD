import type { MetadataRoute } from 'next';
import { PUBLIC_SITEMAP_ROUTES, absoluteUrl } from '@/lib/seo';

const ROUTE_SEO_CONFIG: Record<
  string,
  { priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }
> = {
  '/': { priority: 1.0, changeFrequency: 'daily' },
  '/products': { priority: 0.9, changeFrequency: 'daily' },
  '/account': { priority: 0.85, changeFrequency: 'weekly' },
  '/about': { priority: 0.8, changeFrequency: 'weekly' },
  '/exchanges-and-refunds': { priority: 0.8, changeFrequency: 'weekly' },
  '/contact': { priority: 0.6, changeFrequency: 'monthly' },
  '/faqs': { priority: 0.6, changeFrequency: 'monthly' },
  '/refunds': { priority: 0.5, changeFrequency: 'monthly' },
  '/returns': { priority: 0.5, changeFrequency: 'monthly' },
  '/terms': { priority: 0.5, changeFrequency: 'monthly' },
  '/privacy': { priority: 0.5, changeFrequency: 'monthly' },
};

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_SITEMAP_ROUTES.map((route) => {
    const config = ROUTE_SEO_CONFIG[route] ?? {
      priority: 0.5,
      changeFrequency: 'monthly' as const,
    };

    return {
      url: absoluteUrl(route),
      lastModified,
      changeFrequency: config.changeFrequency,
      priority: config.priority,
    };
  });
}

