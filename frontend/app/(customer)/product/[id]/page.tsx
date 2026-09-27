import { Suspense } from 'react';
import ProductClientPage from './ProductClientPage';

export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

export default function ProductDeepLinkPage() {
  return (
    <Suspense fallback={null}>
      <ProductClientPage />
    </Suspense>
  );
}
