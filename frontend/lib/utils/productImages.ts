import type { ProductImage } from '@/types';

/**
 * Ordered image URLs for product gallery + listing: merges `products.image_url` with `product_images`
 * so the legacy primary image is not dropped when extra gallery rows exist.
 */
export function getOrderedProductImageUrls(product: {
  imageUrl?: string | null;
  images?: ProductImage[] | null;
}): string[] {
  const rows = [...(product.images || [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const urls = rows.map((r) => r.imageUrl);
  const main = product.imageUrl || null;
  if (rows.length === 0) {
    return main ? [main] : [];
  }
  if (main && !urls.includes(main)) {
    return [main, ...urls];
  }
  return urls;
}

export function getPrimaryProductImageUrl(product: {
  imageUrl?: string | null;
  images?: ProductImage[] | null;
}): string | null {
  return getOrderedProductImageUrls(product)[0] || null;
}
