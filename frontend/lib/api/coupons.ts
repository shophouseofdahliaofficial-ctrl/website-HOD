import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';

export interface Coupon {
  id: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchaseAmount?: number | null;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  usedCount: number;
  validFrom: string;
  validUntil?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCouponInput {
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  validFrom?: string;
  validUntil?: string | null;
  isActive?: boolean;
}

export interface UpdateCouponInput extends Partial<CreateCouponInput> {}

export interface ValidateCouponInput {
  code: string;
  cartAmount?: number;
}

/**
 * Public Coupons API Service (for customers)
 */
export const couponsApi = {
  /**
   * Validate coupon code
   */
  validate: async (code: string, cartAmount: number = 0): Promise<Coupon> => {
    return apiClient.post<Coupon>(API_ENDPOINTS.COUPONS.VALIDATE, { code, cartAmount });
  },
  /**
   * List all active coupons
   */
  listActive: async (): Promise<Coupon[]> => {
    return apiClient.get<Coupon[]>(API_ENDPOINTS.COUPONS.LIST);
  },
};

/**
 * Admin Coupons API Service
 */
export const adminCouponsApi = {
  /**
   * Get all coupons (admin view)
   */
  getAll: async (): Promise<Coupon[]> => {
    return apiClient.get<Coupon[]>(API_ENDPOINTS.ADMIN.COUPONS.LIST);
  },

  /**
   * Get coupon by ID
   */
  getById: async (id: string): Promise<Coupon> => {
    return apiClient.get<Coupon>(API_ENDPOINTS.ADMIN.COUPONS.DETAIL(id));
  },

  /**
   * Create coupon
   */
  create: async (data: CreateCouponInput): Promise<Coupon> => {
    return apiClient.post<Coupon>(API_ENDPOINTS.ADMIN.COUPONS.CREATE, data);
  },

  /**
   * Update coupon
   */
  update: async (id: string, data: UpdateCouponInput): Promise<Coupon> => {
    return apiClient.put<Coupon>(API_ENDPOINTS.ADMIN.COUPONS.UPDATE(id), data);
  },

  /**
   * Delete coupon
   */
  delete: async (id: string): Promise<void> => {
    return apiClient.delete(API_ENDPOINTS.ADMIN.COUPONS.DELETE(id));
  },
};
