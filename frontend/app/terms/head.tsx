import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export default function Head() {
  const title = `Terms & Conditions | ${SITE_NAME}`;
  const description =
    'Read the Scribble Studios terms and conditions for ordering and account usage.';
  const canonical = absoluteUrl('/terms');

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
