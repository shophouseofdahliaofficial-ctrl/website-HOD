import type { Product, VariationGroup } from '@/types';

/** Pixels per centimeter in the photobook design coordinate system (5 cm → 380 px). */
export const PB_PX_PER_CM = 76;

export const PB_DEFAULT_PAGE_SIZE_CM = 5;

export type PhotobookPageSizePx = {
  widthPx: number;
  heightPx: number;
};

export function cmToPagePx(cm: number): number {
  const safe = Number(cm);
  if (!Number.isFinite(safe) || safe <= 0) return PB_DEFAULT_PAGE_SIZE_CM * PB_PX_PER_CM;
  return Math.round(safe * PB_PX_PER_CM * 100) / 100;
}

export function resolvePhotobookPageSizePx(
  widthCm?: number | null,
  heightCm?: number | null,
): PhotobookPageSizePx {
  const w = widthCm && widthCm > 0 ? widthCm : PB_DEFAULT_PAGE_SIZE_CM;
  const h = heightCm && heightCm > 0 ? heightCm : PB_DEFAULT_PAGE_SIZE_CM;
  return { widthPx: cmToPagePx(w), heightPx: cmToPagePx(h) };
}

export function getImageSelectorGroups(customizationOptions: VariationGroup[] = []) {
  return customizationOptions.filter(
    (group) => group.type === 'image_selector' && Array.isArray(group.values) && group.values.length > 0,
  );
}

export function resolvePhotobookSizeFromCustomizations(
  customizationOptions: VariationGroup[],
  selectedCustomizations: Record<string, string>,
): PhotobookPageSizePx | null {
  const imageSelectorGroups = getImageSelectorGroups(customizationOptions);
  if (imageSelectorGroups.length === 0) {
    return resolvePhotobookPageSizePx();
  }

  for (const group of imageSelectorGroups) {
    const valueId = selectedCustomizations[group.id];
    if (!valueId) continue;
    const value = group.values.find((entry) => entry.id === valueId);
    if (!value) continue;
    const widthCm = value.photobookWidthCm;
    const heightCm = value.photobookHeightCm;
    if (widthCm && widthCm > 0 && heightCm && heightCm > 0) {
      return resolvePhotobookPageSizePx(widthCm, heightCm);
    }
  }

  return null;
}

export function productRequiresPhotobookSizeSelection(product: Product): boolean {
  if (!product.photobookEditorEnabled) return false;
  return getImageSelectorGroups(product.customizationOptions).length > 0;
}

export function canOpenPhotobookEditor(
  product: Product,
  selectedCustomizations: Record<string, string>,
): { ok: true; pageSize: PhotobookPageSizePx } | { ok: false; message: string } {
  if (!product.photobookEditorEnabled) {
    return { ok: false, message: 'Photobook editor is not enabled for this product.' };
  }

  if (!productRequiresPhotobookSizeSelection(product)) {
    return { ok: true, pageSize: resolvePhotobookPageSizePx() };
  }

  const pageSize = resolvePhotobookSizeFromCustomizations(
    product.customizationOptions || [],
    selectedCustomizations,
  );

  if (!pageSize) {
    return {
      ok: false,
      message: 'Select a size option with canvas dimensions before starting to design.',
    };
  }

  return { ok: true, pageSize };
}
