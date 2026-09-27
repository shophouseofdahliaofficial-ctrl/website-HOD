export const runtime = 'edge';

import { Suspense } from 'react';
import ProductClientPage from './ProductClientPage';

export default function ProductDeepLinkPage() {
  return (
    <Suspense fallback={null}>
      <ProductClientPage />
    </Suspense>
  );
}
