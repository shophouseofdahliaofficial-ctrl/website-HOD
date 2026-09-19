import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { Address } from '@/types';

export interface CreateAddressInput {
  name: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export interface UpdateAddressInput extends Partial<CreateAddressInput> {}

/**
 * Address API Service
 */
export const addressesApi = {
  /**
   * Get all addresses for the current user
   */
  getAll: async (): Promise<Address[]> => {
    return apiClient.get<Address[]>(API_ENDPOINTS.ADDRESSES.LIST);
  },

  /**
   * Get address by ID
   */
  getById: async (id: string): Promise<Address> => {
    return apiClient.get<Address>(API_ENDPOINTS.ADDRESSES.DETAIL(id));
  },

  /**
   * Create a new address
   */
  create: async (data: CreateAddressInput): Promise<Address> => {
    return apiClient.post<Address>(API_ENDPOINTS.ADDRESSES.CREATE, data);
  },

  /**
   * Update an address
   */
  update: async (id: string, data: UpdateAddressInput): Promise<Address> => {
    return apiClient.put<Address>(API_ENDPOINTS.ADDRESSES.UPDATE(id), data);
  },

  /**
   * Delete an address
   */
  delete: async (id: string): Promise<void> => {
    return apiClient.delete(API_ENDPOINTS.ADDRESSES.DELETE(id));
  },
};
