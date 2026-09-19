import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { WalletSummary } from '@/types';

export const walletApi = {
  getSummary: async (): Promise<WalletSummary> => {
    return apiClient.get<WalletSummary>(API_ENDPOINTS.WALLET.SUMMARY);
  },

  createTopupOrder: async (
    amount: number
  ): Promise<
    | { manual: true; credited: boolean; balance: number; currency: string; amount: number }
    | { razorpayOrderId: string; key: string; currency: string; amount: number }
  > => {
    return apiClient.post<
      | { manual: true; credited: boolean; balance: number; currency: string; amount: number }
      | { razorpayOrderId: string; key: string; currency: string; amount: number }
    >(API_ENDPOINTS.WALLET.TOPUP, { amount });
  },

  verifyTopup: async (payload: { razorpay_order_id: string; razorpay_payment_id: string }): Promise<{ balance: number; credited: boolean }> => {
    return apiClient.post<{ balance: number; credited: boolean }>(API_ENDPOINTS.WALLET.VERIFY_TOPUP, payload);
  },
};

