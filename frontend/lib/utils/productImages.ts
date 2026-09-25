/**
 * Automatically applies Cloudinary automatic format (WebP/AVIF) and compression (q_auto)
 * to any Cloudinary image URL and ensures .webp extension.
 */
export function optimizeCloudinaryUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('res.cloudinary.com')) return url;

  let result = url;
  if (result.includes('/upload/') && !result.includes('/f_webp') && !result.includes('/f_auto')) {
    result = result.replace('/upload/', '/upload/f_webp,q_auto/');
  }
  result = result.replace(/\.(png|jpg|jpeg|jfif|pjpeg|pjp|avif|bmp|tiff|tif)(\?.*)?$/i, '.webp$2');
  return result;
}

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
    const opt = optimizeCloudinaryUrl(product.imageUrl);
    if (opt) list.push(opt);
  }

  // Related ProductImage[] objects
  if (Array.isArray(product.images) && product.images.length > 0) {
    const sorted = [...product.images].sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
    );
    for (const img of sorted) {
      if (img?.imageUrl && typeof img.imageUrl === 'string') {
        const opt = optimizeCloudinaryUrl(img.imageUrl);
        if (opt && !list.includes(opt)) {
          list.push(opt);
        }
      }
    }
  }

  // String array imageUrls if present
  if (Array.isArray((product as any).imageUrls)) {
    for (const url of (product as any).imageUrls) {
      if (url && typeof url === 'string') {
        const opt = optimizeCloudinaryUrl(url);
        if (opt && !list.includes(opt)) {
          list.push(opt);
        }
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
