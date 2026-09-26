import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';

export interface GiftCardItem {
  id: string;
  code: string;
  amount: number;
  type: 'created' | 'redeemed';
  status: 'Created' | 'Redeemed';
  date: string;
}

export interface CreateGiftCardResponse {
  id: string;
  code: string;
  amount: number;
  status: string;
  created_at: string;
}

export interface RedeemGiftCardResponse {
  success: boolean;
  card: {
    id: string;
    code: string;
    amount: number;
  };
  balance: number;
  message: string;
}

export const giftCardApi = {
  create: async (amount: number): Promise<CreateGiftCardResponse> => {
    return apiClient.post<CreateGiftCardResponse>(API_ENDPOINTS.GIFTCARDS.CREATE, { amount });
  },

  redeem: async (code: string): Promise<RedeemGiftCardResponse> => {
    return apiClient.post<RedeemGiftCardResponse>(API_ENDPOINTS.GIFTCARDS.REDEEM, { code });
  },

  getHistory: async (): Promise<GiftCardItem[]> => {
    return apiClient.get<GiftCardItem[]>(API_ENDPOINTS.GIFTCARDS.HISTORY);
  },
};
