export const SITE_NAME = 'House Of Dahlia';
export const SITE_ALTERNATE_NAME = 'House Of Dahlia';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
export const GA_MEASUREMENT_ID = (
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ''
).trim();
export const SITE_DESCRIPTION =
  'House Of Dahlia — Fine Art Photo Prints, Custom Keepsakes, Photo Booth Strips & Floral Boutique.';

export const DEFAULT_KEYWORDS = [
  'house of dahlia',
  'photo prints',
  'polaroids',
  'photo booth',
  'keepsakes',
  'fine art photography',
];

export const PUBLIC_SITEMAP_ROUTES = [
  '/',
  '/membership',
  '/products',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
] as const;

export function getSiteUrl(): URL {
  try {
    return new URL(SITE_URL);
  } catch {
    return new URL('http://localhost:3000');
  }
}

export function absoluteUrl(pathname = '/'): string {
  return new URL(pathname, getSiteUrl()).toString();
}
