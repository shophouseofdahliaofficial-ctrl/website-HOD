import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export default function Head() {
  const title = `Privacy Policy | ${SITE_NAME}`;
  const description =
    'Read the Scribble Studios privacy policy to understand how customer information is collected, used, and protected.';
  const canonical = absoluteUrl('/privacy');

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content="article" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </>
  );
}
