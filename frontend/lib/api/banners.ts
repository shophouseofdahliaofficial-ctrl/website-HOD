import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';

export interface BannerImageItem {
  id?: string;
  imageUrl: string;
  imagePublicId?: string | null;
  mobileImageUrl?: string | null;
  mobileImagePublicId?: string | null;
  title?: string;
  link?: string;
  linkTarget?: 'same_tab' | 'new_tab';
}

export interface Banner {
  id: string;
  title?: string;
  description?: string;
  imageUrl: string;
  imagePublicId?: string;
  mobileImageUrl?: string;
  mobileImagePublicId?: string;
  images?: BannerImageItem[];
  desktopDisplayMode?: 'swipe' | 'down';
  mobileDisplayMode?: 'swipe' | 'down';
  link?: string; // Optional URL - if provided, banner becomes clickable
  linkTarget?: 'same_tab' | 'new_tab';
  orderIndex: number;
  isActive: boolean;
  adaptToFirstImage?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Public Banners API Service
 */
export const bannersApi = {
  /**
   * Get all active banners (for homepage)
   */
  getAll: async (): Promise<Banner[]> => {
    return apiClient.get<Banner[]>(API_ENDPOINTS.BANNERS.LIST);
  },
};

/**
 * Admin Banners API Service
 */
export const adminBannersApi = {
  /**
   * Get all banners (admin view - includes inactive)
   */
  getAll: async (): Promise<Banner[]> => {
    return apiClient.get<Banner[]>(API_ENDPOINTS.ADMIN.BANNERS.LIST);
  },

  /**
   * Create banner
   */
  create: async (data: FormData): Promise<Banner> => {
    const instance = apiClient.getInstance();
    const response = await instance.post(API_ENDPOINTS.ADMIN.BANNERS.CREATE, data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data as Banner;
  },

  /**
   * Update banner
   */
  update: async (id: string, data: FormData): Promise<Banner> => {
    const instance = apiClient.getInstance();
    const response = await instance.put(API_ENDPOINTS.ADMIN.BANNERS.UPDATE(id), data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data as Banner;
  },

  /**
   * Delete banner
   */
  delete: async (id: string): Promise<void> => {
    return apiClient.delete(API_ENDPOINTS.ADMIN.BANNERS.DELETE(id));
  },
};

