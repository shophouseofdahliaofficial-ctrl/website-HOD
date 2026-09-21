import type { Product } from '@/types';
import type { CartItem } from '@/lib/utils/cart';

export type CartItemPriceDetails = {
  unitPrice: number;
  originalUnitPrice: number | null;
  unitOff: number;
};

export function getPhotoboothCartProject(it: CartItem) {
  if (!it?.customizations) return null;
  return (
    it.customizations.photoboothProject ||
    it.customizations.photobooth ||
    (it.customizations.photoboothProjectId ? { id: it.customizations.photoboothProjectId } : null)
  );
}

export function getPhotoboothPrintsLabel(it: CartItem): string | null {
  const photobooth = getPhotoboothCartProject(it);
  if (!photobooth) return null;

  const count = photobooth.polaroidCount || (Array.isArray(photobooth.capturedPhotos) ? photobooth.capturedPhotos.length : 1);
  const unit = photobooth.projectType === 'strip' ? 'strip' : 'polaroid';
  const unitLabel = count === 1 ? unit : `${unit}s`;
  if (photobooth.label) {
    return `${photobooth.label} (${count} ${unitLabel})`;
  }
  return `${count} ${unitLabel}`;
}

export function shouldShowCartPriceLine(it: CartItem, p?: Product | null): boolean {
  return true;
}

export function getCartItemCheckoutLineLabel(it: CartItem, p?: Product | null): string {
  const photobooth = getPhotoboothCartProject(it);
  if (photobooth) {
    return getPhotoboothPrintsLabel(it) ?? 'Photobooth print';
  }

  const v = it.variationId ? (p?.variations || []).find((x) => x.id === it.variationId) : null;
  return `${it.quantity} × ${p?.name || 'Product'}${v ? ` (${v.size})` : ''}`;
}

export function getCartItemPriceLineAmount(it: CartItem, p?: Product | null): number {
  const { unitPrice } = getCartItemPriceDetails(it, p);
  return unitPrice * it.quantity;
}

export function getCartItemOrderSubtotalContribution(it: CartItem, p?: Product | null): number {
  const { unitPrice } = getCartItemPriceDetails(it, p);
  const base = unitPrice * it.quantity;
  const giftWrapFee = it.customizations?.giftWrap ? it.customizations.giftWrap.price : 0;
  return base + giftWrapFee;
}

export function getCartItemPriceDetails(it: CartItem, p?: Product | null): CartItemPriceDetails {
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
