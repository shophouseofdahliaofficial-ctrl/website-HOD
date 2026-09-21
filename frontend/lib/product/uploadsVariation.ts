import type { VariationGroup, Product } from '@/types';

type UploadFlagSource = {
  polaroidUploadEnabled?: boolean;
  stripUploadEnabled?: boolean;
};

/** When an uploads variation group exists, only its flags apply (no product-level fallback). */
export function resolveUploadFlags(
  uploadsGroup: VariationGroup | null | undefined,
  product?: UploadFlagSource | null,
) {
  if (uploadsGroup?.type === 'uploads') {
    return {
      polaroidEnabled: Boolean(uploadsGroup.polaroidUploadEnabled),
      stripEnabled: Boolean(uploadsGroup.stripUploadEnabled),
    };
  }
  return {
    polaroidEnabled: Boolean(product?.polaroidUploadEnabled),
    stripEnabled: Boolean(product?.stripUploadEnabled),
  };
}

export function isUploadsVariationActive(group?: VariationGroup | Product | null): boolean {
  if (!group) return false;
  if ('type' in group && group.type === 'uploads') {
    return Boolean(group.polaroidUploadEnabled) || Boolean(group.stripUploadEnabled);
  }
  return Boolean(group.polaroidUploadEnabled) || Boolean(group.stripUploadEnabled);
}

export function getUploadsVariationHint(
  group: VariationGroup,
  polaroidEnabled: boolean,
  stripEnabled: boolean,
): string {
  if (polaroidEnabled && stripEnabled) {
    return group.uploadHintBoth?.trim() || 'Upload photos for polaroids and strips.';
  }
  if (polaroidEnabled) {
    return group.polaroidUploadHint?.trim() || 'Upload photos for polaroids.';
  }
  if (stripEnabled) {
    return group.stripUploadHint?.trim() || 'Upload photos for strips.';
  }
  return '';
}
