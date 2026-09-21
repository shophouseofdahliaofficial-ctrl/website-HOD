import type { ProductImage } from '@/types';

/**
 * Ordered image URLs for product gallery + listing: merges `products.image_url` with `product_images`
 * so the legacy primary image is not dropped when extra gallery rows exist.
 */
export function getOrderedProductImageUrls(product: {
  imageUrl?: string | null;
  images?: ProductImage[] | null;
  imageUrls?: string[] | null;
} | null | undefined): string[] {
  if (!product) return [];

  const list: string[] = [];

  // Primary image
  if (product.imageUrl && typeof product.imageUrl === 'string') {
    list.push(product.imageUrl);
  }

  // Related ProductImage[] objects
  if (Array.isArray(product.images) && product.images.length > 0) {
    const sorted = [...product.images].sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
    );
    for (const img of sorted) {
      if (img?.imageUrl && typeof img.imageUrl === 'string' && !list.includes(img.imageUrl)) {
        list.push(img.imageUrl);
      }
    }
  }

  // String array imageUrls if present
  if (Array.isArray((product as any).imageUrls)) {
    for (const url of (product as any).imageUrls) {
      if (url && typeof url === 'string' && !list.includes(url)) {
        list.push(url);
      }
    }
  }

  return list;
}

export function getPrimaryProductImageUrl(product: {
  imageUrl?: string | null;
  images?: ProductImage[] | null;
  imageUrls?: string[] | null;
} | null | undefined): string | null {
  return getOrderedProductImageUrls(product)[0] || null;
}
