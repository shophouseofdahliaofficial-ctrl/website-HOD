import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/** Open product details as a dedicated page (same on mobile and desktop). */
export function openProductPage(router: AppRouterInstance, productId: string) {
  router.push(`/product/${productId}`);
}
