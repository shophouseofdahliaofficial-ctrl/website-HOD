import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';

export interface MediaResource {
  publicId: string;
  url: string;
  secure_url?: string;
  secureUrl?: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
  folder?: string;
  filename?: string;
  createdAt: string;
}

export interface MediaLibraryResponse {
  resources: MediaResource[];
  nextCursor: string | null;
  totalCount: number;
}

/**
 * Admin Media API Service (Cloudinary Media Library)
 */
export const adminMediaApi = {
  /**
   * Get all media resources from Cloudinary
   */
  getAll: async (params?: {
    maxResults?: number;
    nextCursor?: string;
    folder?: string;
    search?: string;
  }): Promise<MediaLibraryResponse> => {
    return apiClient.get<MediaLibraryResponse>(API_ENDPOINTS.ADMIN.MEDIA.LIST, {
      params,
    });
  },

  /**
   * Upload an image to Cloudinary media library
   */
  upload: async (file: File, folder?: string): Promise<MediaResource> => {
    const formData = new FormData();
    formData.append('image', file);
    if (folder) {
      formData.append('folder', folder);
    }

    const instance = apiClient.getInstance();
    const response = await instance.post(API_ENDPOINTS.ADMIN.MEDIA.UPLOAD, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data as MediaResource;
  },

  /**
   * Delete image from Cloudinary by publicId
   */
  delete: async (publicId: string): Promise<any> => {
    return apiClient.delete(API_ENDPOINTS.ADMIN.MEDIA.DELETE, {
      data: { publicId },
    });
  },
};
