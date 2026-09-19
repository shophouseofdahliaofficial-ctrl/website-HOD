import type { DeliverySchedule, Subscription } from '@/types';

/** Product line for admin lists: base name plus chosen variation (size), when present. */
export function productWithVariationDisplayLabel(
  productName: string | null | undefined,
  variationSize: string | null | undefined,
): string {
  const base = String(productName ?? '').trim() || 'N/A';
  const variation = String(variationSize ?? '').trim();
  if (!variation) return base;
  return `${base} · ${variation}`;
}

export function subscriptionProductDisplayLabel(sub: Pick<Subscription, 'product' | 'variationSize'>): string {
  return productWithVariationDisplayLabel(sub.product?.name, sub.variationSize);
}

export function deliveryScheduleProductDisplayLabel(
  d: Pick<DeliverySchedule, 'productName' | 'variationSize'>,
): string {
  return productWithVariationDisplayLabel(d.productName, d.variationSize);
}
