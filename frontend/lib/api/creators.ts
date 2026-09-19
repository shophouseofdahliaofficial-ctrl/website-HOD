import { apiClient } from './client';

export interface Creator {
  id: string;
  name: string;
  slug: string;
  productIds: string[];
  productsTitle: string;
  salesCount?: number;
  salesMoney?: number;
  createdAt?: string;
  updatedAt?: string;
}

export const creatorsApi = {
  getBySlug: async (slug: string): Promise<Creator> => {
    return apiClient.get<Creator>(`/api/creators/slug/${slug}`);
  }
};

export const adminCreatorsApi = {
  getAll: async (): Promise<Creator[]> => {
    return apiClient.get<Creator[]>('/api/admin/creators');
  },
  create: async (data: { name: string; slug: string; productIds: string[]; productsTitle: string }): Promise<Creator> => {
    return apiClient.post<Creator>('/api/admin/creators', data);
  },
  update: async (id: string, data: { name?: string; slug?: string; productIds?: string[]; productsTitle?: string }): Promise<Creator> => {
    return apiClient.put<Creator>(`/api/admin/creators/${id}`, data);
  },
  delete: async (id: string): Promise<Creator> => {
    return apiClient.delete<Creator>(`/api/admin/creators/${id}`);
  }
};
