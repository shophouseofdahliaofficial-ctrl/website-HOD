import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>{`My Orders | ${SITE_NAME}`}</title>
      <meta
        name="description"
        content={`View and track your ${SITE_NAME} orders and order history in one place.`}
      />
      <meta
        name="keywords"
        content={`${SITE_NAME} orders, track order, order history`}
      />
      <meta name="robots" content="index,follow" />
      <link rel="canonical" href={absoluteUrl('/orders')} />
    </>
  );
}
