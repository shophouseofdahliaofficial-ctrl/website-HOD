import type { Product } from '@/types';
import type { CartItem } from '@/lib/utils/cart';
import {
  PRINT_DELIVERY_FEE,
  PRINT_PRICE_PER_POLAROID,
} from '@/lib/photobooth/purchaseConstants';

export type CartItemPriceDetails = {
  unitPrice: number;
  originalUnitPrice: number | null;
  unitOff: number;
};

export function getPhotoboothCartProject(it: CartItem) {
  return it.customizations?.photoboothProject ?? null;
}

export function isOrphanPhotoboothProductItem(it: CartItem, p?: Product | null): boolean {
  if (getPhotoboothCartProject(it)) return false;
  return p?.name === 'Photobooth Print';
}

/** Include in price summary rows — skip bare catalog photobooth lines without a project. */
export function shouldShowCartPriceLine(it: CartItem, p?: Product | null): boolean {
  return !isOrphanPhotoboothProductItem(it, p);
}

export function getPhotoboothPrintsSubtotal(it: CartItem): number {
  const photobooth = getPhotoboothCartProject(it);
  if (!photobooth) return 0;
  return photobooth.polaroidCount * PRINT_PRICE_PER_POLAROID * it.quantity;
}

export function getPhotoboothDeliveryForItem(it: CartItem): number {
  const photobooth = getPhotoboothCartProject(it);
  if (!photobooth) return 0;
  return PRINT_DELIVERY_FEE * it.quantity;
}

export function sumPhotoboothDeliveryFees(items: CartItem[]): number {
  return items.reduce((sum, it) => sum + getPhotoboothDeliveryForItem(it), 0);
}

export function getPhotoboothPrintsLabel(it: CartItem): string | null {
  const photobooth = getPhotoboothCartProject(it);
  if (!photobooth) return null;

  const unit = photobooth.projectType === 'strip' ? 'strip' : 'polaroid';
  const count = photobooth.polaroidCount;
  const unitLabel = count === 1 ? unit : `${unit}s`;
  return `${count} × ₹${PRINT_PRICE_PER_POLAROID} ${unitLabel}`;
}

/** @deprecated Use getPhotoboothPrintsLabel — delivery is shown on the Delivery row. */
export function getPhotoboothPriceBreakdownLabel(it: CartItem): string | null {
  return getPhotoboothPrintsLabel(it);
}

export function getCartItemCheckoutLineLabel(it: CartItem, p?: Product | null): string {
  const photobooth = getPhotoboothCartProject(it);
  if (photobooth) {
    return getPhotoboothPrintsLabel(it) ?? 'Photobooth print';
  }

  const v = it.variationId ? (p?.variations || []).find((x) => x.id === it.variationId) : null;
  return `${it.quantity} × ${p?.name || 'Product'}${v ? ` (${v.size})` : ''}`;
}

/** Amount shown on the item line in price summary (prints only for photobooth). */
export function getCartItemPriceLineAmount(it: CartItem, p?: Product | null): number {
  if (getPhotoboothCartProject(it)) {
    return getPhotoboothPrintsSubtotal(it);
  }
  const { unitPrice } = getCartItemPriceDetails(it, p);
  return unitPrice * it.quantity;
}

/** Full line contribution to order subtotal (prints + photobooth delivery). */
export function getCartItemOrderSubtotalContribution(it: CartItem, p?: Product | null): number {
  if (getPhotoboothCartProject(it)) {
    return getPhotoboothPrintsSubtotal(it) + getPhotoboothDeliveryForItem(it);
  }
  const { unitPrice } = getCartItemPriceDetails(it, p);
  const base = unitPrice * it.quantity;
  const giftWrapFee = it.customizations?.giftWrap ? it.customizations.giftWrap.price : 0;
  return base + giftWrapFee;
}

export function getCartItemPriceDetails(it: CartItem, p?: Product | null): CartItemPriceDetails {
  const photobooth = getPhotoboothCartProject(it);
  if (photobooth) {
    return {
      unitPrice: photobooth.polaroidCount * PRINT_PRICE_PER_POLAROID,
      originalUnitPrice: null,
      unitOff: 0,
    };
  }

  if (!p) {
    return { unitPrice: 0, originalUnitPrice: null, unitOff: 0 };
  }

  const baseSelling = (p.sellingPrice !== null && p.sellingPrice !== undefined)
    ? p.sellingPrice
    : p.pricePerLitre;
  const baseCompare = (p.compareAtPrice !== null && p.compareAtPrice !== undefined)
    ? p.compareAtPrice
    : null;

  let unitPrice = baseSelling;
  let originalUnitPrice: number | null = baseCompare;

  if (p.isCustomizable) {
    const combo = it.variationId ? (p.customizationCombinations || []).find((c) => c.id === it.variationId) : null;
    if (combo && combo.price !== undefined && combo.price !== null) {
      unitPrice = combo.price;
    } else {
      let sellingSum = baseSelling;
      if (combo) {
        Object.keys(combo.combinationKeys || {}).forEach((groupId) => {
          const valId = combo.combinationKeys[groupId];
          const group = (p.customizationOptions || []).find((g) => g.id === groupId);
          const val = group ? (group.values || []).find((v) => v.id === valId) : null;
          if (val && typeof val.price === 'number') {
            sellingSum += val.price;
          }
        });
      }
      unitPrice = sellingSum;
    }

    if (it.customizations?.textPersonalization) {
      const textPers = it.customizations.textPersonalization;
      (p.customizationOptions || []).forEach((group) => {
        if (group.type === 'text_input') {
          (group.values || []).forEach((val) => {
            const inputKey = `${group.id}_${val.id}`;
            const textVal = textPers[inputKey] || '';
            if (textVal.trim() && typeof val.price === 'number') {
              unitPrice += val.price;
            }
          });
        }
      });
    }

    if (combo && combo.compareAtPrice !== undefined && combo.compareAtPrice !== null) {
      originalUnitPrice = combo.compareAtPrice;
    } else if (baseCompare !== null) {
      let compareSum = baseCompare;
      if (combo) {
        Object.keys(combo.combinationKeys || {}).forEach((groupId) => {
          const valId = combo.combinationKeys[groupId];
          const group = (p.customizationOptions || []).find((g) => g.id === groupId);
          const val = group ? (group.values || []).find((v) => v.id === valId) : null;
          if (val && typeof val.price === 'number') {
            compareSum += val.price;
          }
        });
      }
      if (it.customizations?.textPersonalization) {
        const textPers = it.customizations.textPersonalization;
        (p.customizationOptions || []).forEach((group) => {
          if (group.type === 'text_input') {
            (group.values || []).forEach((val) => {
              const inputKey = `${group.id}_${val.id}`;
              const textVal = textPers[inputKey] || '';
              if (textVal.trim() && typeof val.price === 'number') {
                compareSum += val.price;
              }
            });
          }
        });
      }
      originalUnitPrice = compareSum;
    }
  } else {
    const v = it.variationId ? (p.variations || []).find((x) => x.id === it.variationId) : null;
    const mult = v?.priceMultiplier ?? 1;
    unitPrice = v?.price ?? (baseSelling * mult);
    const variationCompare = (v?.compareAtPrice !== null && v?.compareAtPrice !== undefined)
      ? Number(v.compareAtPrice)
      : null;
    originalUnitPrice = variationCompare !== null
      ? variationCompare
      : baseCompare !== null
        ? baseCompare * mult
        : null;
  }

  const unitOff = originalUnitPrice !== null ? Math.max(0, originalUnitPrice - unitPrice) : 0;

  return { unitPrice, originalUnitPrice, unitOff };
}
