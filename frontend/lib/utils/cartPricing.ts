import type { Product } from '@/types';
import type { CartItem } from '@/lib/utils/cart';

export type CartItemPriceDetails = {
  unitPrice: number;
  originalUnitPrice: number | null;
  unitOff: number;
  price: number;
  mrp: number | null;
  quantity: number;
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

  let varLabel = '';
  if (it.variationId && p?.variations) {
    const v = p.variations.find((x) => String(x.id) === String(it.variationId));
    if (v?.size) varLabel = v.size;
  }
  if (!varLabel && it.variationId && p?.customizationCombinations) {
    const combo = p.customizationCombinations.find((x) => String(x.id) === String(it.variationId));
    if (combo && combo.combinationKeys && p.customizationOptions) {
      const parts: string[] = [];
      Object.keys(combo.combinationKeys).forEach((gId) => {
        const valId = combo.combinationKeys[gId];
        const group = p.customizationOptions?.find((g) => String(g.id) === String(gId));
        const val = group?.values?.find((v) => String(v.id) === String(valId));
        if (val) parts.push(val.name);
      });
      if (parts.length > 0) varLabel = parts.join(', ');
    }
  }
  if (!varLabel) {
    const fallback =
      (it as any).variationSize ||
      (it as any).size ||
      it.customizations?.size ||
      it.customizations?.variationSize ||
      (it.customizations as any)?.variation?.size ||
      (it.customizations as any)?.variantName ||
      (it.customizations as any)?.variationName;
    if (fallback) {
      varLabel = String(fallback).replace(/^size\s*:\s*/i, '').trim();
    }
  }

  return `${it.quantity} × ${p?.name || 'Product'}${varLabel ? ` (${varLabel})` : ''}`;
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
    return { unitPrice: 0, originalUnitPrice: null, unitOff: 0, price: 0, mrp: null, quantity: it.quantity || 1 };
  }

  const baseSelling = (p.sellingPrice !== null && p.sellingPrice !== undefined && Number.isFinite(Number(p.sellingPrice)))
    ? Number(p.sellingPrice)
    : Number(p.pricePerLitre || 0);
  const baseCompare = (p.compareAtPrice !== null && p.compareAtPrice !== undefined && Number.isFinite(Number(p.compareAtPrice)))
    ? Number(p.compareAtPrice)
    : null;

  let unitPrice = baseSelling;
  let originalUnitPrice: number | null = baseCompare;

  const hasCustomizationOptions = Array.isArray(p.customizationOptions) && p.customizationOptions.length > 0;
  const hasCustomizationCombinations = Array.isArray(p.customizationCombinations) && p.customizationCombinations.length > 0;

  if (p.isCustomizable || hasCustomizationOptions || hasCustomizationCombinations) {
    const combo = it.variationId
      ? (p.customizationCombinations || []).find((c) => String(c.id) === String(it.variationId))
      : null;

    if (combo && combo.price !== undefined && combo.price !== null && Number.isFinite(Number(combo.price))) {
      unitPrice = Number(combo.price);
    } else {
      let sellingSum = baseSelling;
      if (combo && combo.combinationKeys) {
        Object.keys(combo.combinationKeys).forEach((groupId) => {
          const valId = combo.combinationKeys[groupId];
          const group = (p.customizationOptions || []).find((g) => String(g.id) === String(groupId));
          const val = group ? (group.values || []).find((v) => String(v.id) === String(valId)) : null;
          if (val && typeof val.price === 'number' && Number.isFinite(val.price)) {
            sellingSum += val.price;
          }
        });
      } else {
        const selectedOpts =
          (it.customizations as any)?.selectedOptions ||
          (it.customizations as any)?.customizationOptions ||
          (it.customizations as any)?.options ||
          {};
        Object.keys(selectedOpts).forEach((groupId) => {
          const valId = selectedOpts[groupId];
          const group = (p.customizationOptions || []).find((g) => String(g.id) === String(groupId));
          const val = group ? (group.values || []).find((v) => String(v.id) === String(valId)) : null;
          if (val && typeof val.price === 'number' && Number.isFinite(val.price)) {
            sellingSum += val.price;
          }
        });
      }

      // If variationId directly references a value in customization options
      if (it.variationId && sellingSum === baseSelling) {
        for (const grp of p.customizationOptions || []) {
          const val = (grp.values || []).find((v) => String(v.id) === String(it.variationId));
          if (val && typeof val.price === 'number' && Number.isFinite(val.price)) {
            sellingSum += val.price;
            break;
          }
        }
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
            if (textVal.trim() && typeof val.price === 'number' && Number.isFinite(val.price)) {
              unitPrice += val.price;
            }
          });
        }
      });
    }

    if (combo && combo.compareAtPrice !== undefined && combo.compareAtPrice !== null && Number.isFinite(Number(combo.compareAtPrice))) {
      originalUnitPrice = Number(combo.compareAtPrice);
    } else if (baseCompare !== null) {
      let compareSum = baseCompare;
      const selectedOpts =
        (it.customizations as any)?.selectedOptions ||
        (it.customizations as any)?.customizationOptions ||
        (combo?.combinationKeys) ||
        {};
      Object.keys(selectedOpts).forEach((groupId) => {
        const valId = selectedOpts[groupId];
        const group = (p.customizationOptions || []).find((g) => String(g.id) === String(groupId));
        const val = group ? (group.values || []).find((v) => String(v.id) === String(valId)) : null;
        if (val && typeof val.price === 'number' && Number.isFinite(val.price)) {
          compareSum += val.price;
        }
      });
      if (it.customizations?.textPersonalization) {
        const textPers = it.customizations.textPersonalization;
        (p.customizationOptions || []).forEach((group) => {
          if (group.type === 'text_input') {
            (group.values || []).forEach((val) => {
              const inputKey = `${group.id}_${val.id}`;
              const textVal = textPers[inputKey] || '';
              if (textVal.trim() && typeof val.price === 'number' && Number.isFinite(val.price)) {
                compareSum += val.price;
              }
            });
          }
        });
      }
      originalUnitPrice = compareSum;
    }
  } else {
    const v = it.variationId
      ? (p.variations || []).find((x) => String(x.id) === String(it.variationId))
      : null;
    const mult = v?.priceMultiplier != null && Number.isFinite(Number(v.priceMultiplier)) ? Number(v.priceMultiplier) : 1;
    unitPrice = (v?.price != null && Number.isFinite(Number(v.price)))
      ? Number(v.price)
      : (baseSelling * mult);

    const variationCompare = (v?.compareAtPrice !== null && v?.compareAtPrice !== undefined && Number.isFinite(Number(v.compareAtPrice)))
      ? Number(v.compareAtPrice)
      : null;
    originalUnitPrice = variationCompare !== null
      ? variationCompare
      : baseCompare !== null
        ? baseCompare * mult
        : null;
  }

  const unitOff = originalUnitPrice !== null ? Math.max(0, originalUnitPrice - unitPrice) : 0;

  return {
    unitPrice,
    originalUnitPrice,
    unitOff,
    price: unitPrice,
    mrp: originalUnitPrice,
    quantity: it.quantity || 1,
  };
}
