export const SITE_NAME = 'Scribble Studios';
export const SITE_ALTERNATE_NAME = 'Scribble Studios';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
export const GA_MEASUREMENT_ID = (
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-QKZXGGXZGQ'
).trim();
export const SITE_DESCRIPTION =
  'Premium digital creation, design, and development services by Scribble Studios.';

export const DEFAULT_KEYWORDS = [
  'scribble studios',
  'design studio',
  'digital agency',
  'development services',
  'creative agency',
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
