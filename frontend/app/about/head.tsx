import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';

export default function Head() {
  const title = `About ${SITE_NAME}`;
  const description =
    `Discover ${SITE_NAME} — A luxury women's clothing brand and atelier crafting timeless apparel and bespoke couture.`;
  const canonical = absoluteUrl('/about');

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="keywords" content={`${SITE_NAME}, women's clothing brand, luxury atelier, custom wear, couture`} />
      <meta name="application-name" content={SITE_NAME} />
      <meta name="subject" content={SITE_DESCRIPTION} />
    </>
  );
}
