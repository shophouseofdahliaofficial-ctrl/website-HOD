export const SITE_NAME = 'House Of Dahlia';
export const SITE_ALTERNATE_NAME = 'House Of Dahlia';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://houseofdahlia.in').trim();
export const GA_MEASUREMENT_ID = (
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-YCKBCKBLWM'
).trim();
export const SITE_DESCRIPTION =
  "House Of Dahlia — Women's Clothing Brand & Luxury Atelier.";

export const DEFAULT_KEYWORDS = [
  'house of dahlia',
  'houseofdahlia',
  "women's clothing brand",
  "women's clothing",
  "women's fashion",
  'luxury atelier',
  'custom wear',
  'bespoke apparel',
  'luxury dresses',
  'couture',
  'haute couture',
  'designer wear',
];

export const PUBLIC_SITEMAP_ROUTES = [
  '/',
  '/membership',
  '/products',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/refunds',
  '/returns',
  '/exchanges-and-refunds',
  '/faqs',
] as const;

export function getSiteUrl(): URL {
  try {
    return new URL(SITE_URL);
  } catch {
    return new URL('https://houseofdahlia.in');
  }
}

export function absoluteUrl(pathname = '/'): string {
  return new URL(pathname, getSiteUrl()).toString();
}
