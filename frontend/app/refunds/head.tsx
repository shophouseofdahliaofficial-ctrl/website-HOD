import { SITE_NAME } from '@/lib/seo';

export default function Head() {
  return (
    <>
      <title>{`Exchanges & Refunds | ${SITE_NAME}`}</title>
      <meta
        name="description"
        content={`Exchanges & Refunds policy for ${SITE_NAME}. Learn about our replacement and returns policy for women's clothing and custom wear.`}
      />
    </>
  );
}
