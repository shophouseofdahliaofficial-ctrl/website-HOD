import type { MetadataRoute } from 'next';
import { PUBLIC_SITEMAP_ROUTES, absoluteUrl } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_SITEMAP_ROUTES.map((route) => ({
    url: absoluteUrl(route),
    lastModified,
    changeFrequency: route === '/' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : route === '/products' || route === '/membership' ? 0.9 : 0.7,
  }));
}
