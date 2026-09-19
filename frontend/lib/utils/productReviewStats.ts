import { Product } from '@/types';

export function getAverageProductRating(product: Product): number {
  if (product.reviewSummary && product.reviewSummary.count > 0) {
    return product.reviewSummary.averageRating;
  }
  const reviews = product.reviews || [];
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
}

export function getProductReviewCount(product: Product): number {
  if (product.reviewSummary) return product.reviewSummary.count;
  return product.reviews?.length ?? 0;
}

export function formatProductReviewCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export function formatShortReviewCount(count: number): string {
  if (!count || count <= 0) return '(0)';
  if (count < 1000) return `(${count})`;
  if (count < 1000000) {
    const k = count / 1000;
    const formatted = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '');
    return `(${formatted}K)`;
  }
  const m = count / 1000000;
  const formatted = m % 1 === 0 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '');
  return `(${formatted}M)`;
}
