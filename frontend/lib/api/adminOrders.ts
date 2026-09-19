import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';

/**
 * Admin Orders API Service
 */
export const adminOrdersApi = {
  /**
   * Get pending orders count (for badge)
   */
  getPendingCount: async (): Promise<{ count: number }> => {
    return apiClient.get<{ count: number }>(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.PENDING_COUNT);
  },
};
