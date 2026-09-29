import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export default function Head() {
  const title = `Contact ${SITE_NAME} | Support & Atelier Help`;
  const description =
    `Contact ${SITE_NAME} customer support for assistance with bespoke couture, orders, and inquiries.`;
  const canonical = absoluteUrl('/contact');

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
    </>
  );
}
