import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { Product, ProductImage, ProductVariation, ProductReview, PaginatedResponse } from '@/types';

/**
 * Products API Service
 */
export const productsApi = {
  /**
   * Get all active products (customer view)
   */
  getAll: async (): Promise<Product[]> => {
    return apiClient.get<Product[]>(API_ENDPOINTS.PRODUCTS.LIST);
  },

  /**
   * Get product by ID (with details - images, variations, reviews)
   */
  getById: async (id: string, includeDetails = false): Promise<Product> => {
    const url = includeDetails 
      ? `${API_ENDPOINTS.PRODUCTS.DETAIL(id)}?details=true`
      : API_ENDPOINTS.PRODUCTS.DETAIL(id);
    return apiClient.get<Product>(url);
  },
};

/**
 * Admin Products API Service
 */
export const adminProductsApi = {
  /**
   * Get all products (admin view - includes inactive)
   */
  getAll: async (): Promise<Product[]> => {
    return apiClient.get<Product[]>(API_ENDPOINTS.ADMIN.PRODUCTS.LIST);
  },

  /**
   * Get product by ID with all details
   */
  getById: async (id: string): Promise<Product> => {
    return apiClient.get<Product>(API_ENDPOINTS.ADMIN.PRODUCTS.DETAIL(id));
  },

  /**
   * Create new product
   * Accepts FormData for file uploads
   */
  create: async (formData: FormData): Promise<Product> => {
    const instance = apiClient.getInstance();
    const response = await instance.post<{ success: boolean; data: Product }>(
      API_ENDPOINTS.ADMIN.PRODUCTS.CREATE,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data.data;
  },

  /**
   * Update product
   */
  update: async (id: string, product: Partial<Product>): Promise<Product> => {
    return apiClient.put<Product>(API_ENDPOINTS.ADMIN.PRODUCTS.UPDATE(id), product);
  },

  /**
   * Delete product
   */
  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.ADMIN.PRODUCTS.DELETE(id));
  },

  // Product Images
  addImage: async (productId: string, image: File | string, displayOrder = 0): Promise<ProductImage> => {
    const instance = apiClient.getInstance();
    if (typeof image === 'string') {
      const response = await instance.post<{ success: boolean; data: ProductImage }>(
        API_ENDPOINTS.ADMIN.PRODUCTS.ADD_IMAGE(productId),
        { imageUrl: image, displayOrder }
      );
      return response.data.data;
    } else {
      const formData = new FormData();
      formData.append('image', image);
      formData.append('displayOrder', displayOrder.toString());
      const response = await instance.post<{ success: boolean; data: ProductImage }>(
        API_ENDPOINTS.ADMIN.PRODUCTS.ADD_IMAGE(productId),
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      return response.data.data;
    }
  },

  deleteImage: async (productId: string, imageId: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.ADMIN.PRODUCTS.DELETE_IMAGE(productId, imageId));
  },

  reorderImages: async (productId: string, orderedUrls: string[]): Promise<Product> => {
    const instance = apiClient.getInstance();
    const response = await instance.put<{ success: boolean; data: Product }>(
      API_ENDPOINTS.ADMIN.PRODUCTS.REORDER_IMAGES(productId),
      { orderedUrls }
    );
    return response.data.data;
  },

  uploadDetailAsset: async (productId: string, imageFile: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    const instance = apiClient.getInstance();
    const response = await instance.post<{ success: boolean; data: { imageUrl: string } }>(
      API_ENDPOINTS.ADMIN.PRODUCTS.UPLOAD_DETAIL_ASSET(productId),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data.imageUrl;
  },

  uploadCustomizationAsset: async (productId: string, imageFile: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    const instance = apiClient.getInstance();
    const response = await instance.post<{ success: boolean; data: { imageUrl: string } }>(
      API_ENDPOINTS.ADMIN.PRODUCTS.UPLOAD_CUSTOMIZATION_ASSET(productId),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data.imageUrl;
  },

  uploadPendingCustomizationAsset: async (imageFile: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    const instance = apiClient.getInstance();
    const response = await instance.post<{ success: boolean; data: { imageUrl: string } }>(
      API_ENDPOINTS.ADMIN.PRODUCTS.UPLOAD_PENDING_CUSTOMIZATION_ASSET,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data.imageUrl;
  },

  addVariation: async (productId: string, variation: {
    size: string;
    priceMultiplier?: number;
    price?: number;
    compareAtPrice?: number | null;
    weight?: number;
    isAvailable?: boolean;
    displayOrder?: number;
  }): Promise<ProductVariation> => {
    return apiClient.post<ProductVariation>(API_ENDPOINTS.ADMIN.PRODUCTS.ADD_VARIATION(productId), variation);
  },

  updateVariation: async (productId: string, variationId: string, updates: Partial<ProductVariation>): Promise<ProductVariation> => {
    return apiClient.put<ProductVariation>(API_ENDPOINTS.ADMIN.PRODUCTS.UPDATE_VARIATION(productId, variationId), updates);
  },

  deleteVariation: async (productId: string, variationId: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.ADMIN.PRODUCTS.DELETE_VARIATION(productId, variationId));
  },

  // Product Reviews
  addReview: async (productId: string, review: {
    reviewerName: string;
    rating: number;
    comment?: string;
    isApproved?: boolean;
  }): Promise<ProductReview> => {
    return apiClient.post<ProductReview>(API_ENDPOINTS.ADMIN.PRODUCTS.ADD_REVIEW(productId), review);
  },

  updateReview: async (productId: string, reviewId: string, updates: Partial<ProductReview>): Promise<ProductReview> => {
    return apiClient.put<ProductReview>(API_ENDPOINTS.ADMIN.PRODUCTS.UPDATE_REVIEW(productId, reviewId), updates);
  },

  deleteReview: async (productId: string, reviewId: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.ADMIN.PRODUCTS.DELETE_REVIEW(productId, reviewId));
  },
};

