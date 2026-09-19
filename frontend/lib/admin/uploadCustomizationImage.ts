import { adminProductsApi } from '@/lib/api';

/**
 * Upload a customization option or combination image to Cloudinary.
 * Uses product-scoped folder when editing; pending folder when creating a new product.
 */
export async function uploadCustomizationImage(
  file: File,
  productId?: string,
): Promise<string> {
  if (productId) {
    return adminProductsApi.uploadCustomizationAsset(productId, file);
  }
  return adminProductsApi.uploadPendingCustomizationAsset(file);
}
