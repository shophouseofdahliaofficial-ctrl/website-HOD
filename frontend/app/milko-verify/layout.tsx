import type { Metadata } from 'next';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: `Verify Your Product Authenticity | ${SITE_NAME}`,
  description: 'Check if your product is genuine instantly. Enter the unique 6-digit code on your packaging to verify authenticity.',
  openGraph: {
    title: `Product Authenticity Verification | ${SITE_NAME}`,
    description: 'Check if your product is genuine instantly. Enter the unique 6-digit code on your packaging to verify authenticity.',
  },
};

export default function ProductVerifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
