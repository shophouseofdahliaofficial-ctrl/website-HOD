import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';

export type ExchangeItemDetail = {
  itemId?: string | null;
  productId?: number | null;
  productName: string;
  originalVariation?: string | null;
  originalUnitPrice: number;
  quantity: number;
  requestedItemName?: string | null;
  requestedVariation?: string | null;
  requestedUnitPrice: number;
  priceDifference: number;
  reason?: string;
};

export type OrderExchange = {
  id: string;
  orderId: string;
  userId: string;
  orderNumber: string;
  itemId?: string | null;
  productId?: number | null;
  productName: string;
  originalVariation?: string | null;
  originalUnitPrice: number;
  quantity: number;
  requestedItemName?: string | null;
  requestedVariation?: string | null;
  requestedUnitPrice: number;
  priceDifference: number;
  exchangeItems?: ExchangeItemDetail[] | null;
  reason: string;
  customerMessage?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  rejectionReason?: string | null;
  approvalMessage?: string | null;
  adminNote?: string | null;
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'waived' | 'not_required';
  paymentMethod?: 'wallet' | 'online' | 'free' | 'wallet_refund' | null;
  paymentReference?: string | null;
  reverseWaybill?: string | null;
  reverseStatus?: string | null;
  reverseTrackingUrl?: string | null;
  reversePickupScheduledAt?: string | null;
  returnReceivedAt?: string | null;
  returnVerifiedAt?: string | null;
  replacementWaybill?: string | null;
  replacementStatus?: string | null;
  replacementTrackingUrl?: string | null;
  replacementDispatchedAt?: string | null;
  replacementDeliveredAt?: string | null;
  requestedAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  orderCreatedAt?: string | null;
  orderDeliveredAt?: string | null;
};

export type RequestExchangeInput = {
  orderId: string;
  items?: ExchangeItemDetail[];
  itemId?: string | null;
  productId?: number | null;
  productName?: string;
  originalVariation?: string | null;
  originalUnitPrice?: number;
  quantity?: number;
  requestedItemName?: string;
  requestedVariation?: string | null;
  requestedUnitPrice?: number;
  reason: string;
  customerMessage?: string;
};

export const exchangesApi = {
  request: async (input: RequestExchangeInput): Promise<OrderExchange> => {
    const res = await apiClient.post<{ success: boolean; data: OrderExchange; message: string }>(
      API_ENDPOINTS.EXCHANGES.REQUEST,
      input
    );
    return (res as any).data || res;
  },

  getForOrder: async (orderId: string): Promise<OrderExchange | null> => {
    const res: any = await apiClient.get<any>(
      API_ENDPOINTS.EXCHANGES.GET_FOR_ORDER(orderId)
    );
    if (!res) return null;
    return res.data !== undefined ? res.data : (res as OrderExchange);
  },

  createPaymentOrder: async (
    exchangeId: string
  ): Promise<{ razorpayOrderId: string; key: string; currency: string; amount: number; exchangeId: string }> => {
    const res = await apiClient.post<{
      success: boolean;
      data: { razorpayOrderId: string; key: string; currency: string; amount: number; exchangeId: string };
    }>(API_ENDPOINTS.EXCHANGES.PAYMENT_ORDER, { exchangeId });
    return (res as any).data || res;
  },

  settleOrPay: async (payload: {
    exchangeId: string;
    paymentMethod: 'wallet' | 'online' | 'free';
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
    razorpaySignature?: string;
  }): Promise<{ exchange: OrderExchange; walletBalance?: number; message?: string }> => {
    const res = await apiClient.post<{
      success: boolean;
      data: OrderExchange;
      walletBalance?: number;
      message?: string;
    }>(API_ENDPOINTS.EXCHANGES.SETTLE, payload);
    return {
      exchange: (res as any).data || res,
      walletBalance: (res as any).walletBalance,
      message: (res as any).message,
    };
  },
};

export const adminExchangesApi = {
  getAll: async (params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: OrderExchange[]; total: number; page: number; limit: number }> => {
    const searchParams = new URLSearchParams();
    if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const url = `${API_ENDPOINTS.ADMIN.EXCHANGES.LIST}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const res: any = await apiClient.get<any>(url);

    if (Array.isArray(res)) {
      return { data: res, total: res.length, page: 1, limit: res.length };
    }
    if (res && Array.isArray(res.exchanges)) {
      return { data: res.exchanges, total: res.total || res.exchanges.length, page: res.page || 1, limit: res.limit || 50 };
    }
    if (res && Array.isArray(res.data)) {
      return { data: res.data, total: res.total || res.data.length, page: res.page || 1, limit: res.limit || 50 };
    }
    return { data: [], total: 0, page: 1, limit: 50 };
  },

  getPendingCount: async (): Promise<{ count: number }> => {
    const res: any = await apiClient.get<any>(API_ENDPOINTS.ADMIN.EXCHANGES.PENDING_COUNT);
    if (typeof res === 'number') return { count: res };
    if (res && typeof res.count === 'number') return { count: res.count };
    return { count: 0 };
  },

  getById: async (id: string): Promise<OrderExchange> => {
    const res = await apiClient.get<{ success: boolean; data: OrderExchange }>(
      API_ENDPOINTS.ADMIN.EXCHANGES.DETAIL(id)
    );
    return (res as any).data || res;
  },

  approve: async (
    id: string,
    data?: { priceDifference?: number; requestedVariation?: string; requestedUnitPrice?: number; approvalMessage?: string; adminNote?: string }
  ): Promise<OrderExchange> => {
    const res = await apiClient.post<{ success: boolean; data: OrderExchange }>(
      API_ENDPOINTS.ADMIN.EXCHANGES.APPROVE(id),
      data || {}
    );
    return (res as any).data || res;
  },

  reject: async (id: string, data: { rejectionReason: string; adminNote?: string }): Promise<OrderExchange> => {
    const res = await apiClient.post<{ success: boolean; data: OrderExchange }>(
      API_ENDPOINTS.ADMIN.EXCHANGES.REJECT(id),
      data
    );
    return (res as any).data || res;
  },

  markReturnReceived: async (id: string, data?: { adminNote?: string }): Promise<OrderExchange> => {
    const res = await apiClient.post<{ success: boolean; data: OrderExchange }>(
      API_ENDPOINTS.ADMIN.EXCHANGES.MARK_RETURN_RECEIVED(id),
      data || {}
    );
    return (res as any).data || res;
  },

  markReturnVerified: async (id: string, data?: { adminNote?: string }): Promise<OrderExchange> => {
    const res = await apiClient.post<{ success: boolean; data: OrderExchange }>(
      API_ENDPOINTS.ADMIN.EXCHANGES.MARK_RETURN_VERIFIED(id),
      data || {}
    );
    return (res as any).data || res;
  },

  dispatchReplacement: async (id: string, data?: { adminNote?: string }): Promise<OrderExchange> => {
    const res = await apiClient.post<{ success: boolean; data: OrderExchange }>(
      API_ENDPOINTS.ADMIN.EXCHANGES.DISPATCH_REPLACEMENT(id),
      data || {}
    );
    return (res as any).data || res;
  },

  markReplacementDelivered: async (id: string, data?: { adminNote?: string }): Promise<OrderExchange> => {
    const res = await apiClient.post<{ success: boolean; data: OrderExchange }>(
      API_ENDPOINTS.ADMIN.EXCHANGES.MARK_REPLACEMENT_DELIVERED(id),
      data || {}
    );
    return (res as any).data || res;
  },
};
