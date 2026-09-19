import { AxiosHeaders } from 'axios';
import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { Subscription, SubscriptionCreateRequest, RazorpayOrder, PausedDate, TrialPackCreateRequestItem, TrialPackCheckoutBreakdown } from '@/types';

/**
 * Subscriptions API Service (Customer)
 */
export const subscriptionsApi = {
  /**
   * Get all subscriptions for current user
   */
  getAll: async (): Promise<Subscription[]> => {
    return apiClient.get<Subscription[]>(API_ENDPOINTS.SUBSCRIPTIONS.LIST);
  },

  /**
   * Get subscription by ID
   */
  getById: async (id: string): Promise<Subscription> => {
    return apiClient.get<Subscription>(API_ENDPOINTS.SUBSCRIPTIONS.DETAIL(id), {
      headers: new AxiosHeaders(),
      params: {
        _ts: Date.now(),
      },
    });
  },

  /**
   * Create new subscription
   * Returns subscription and optional Razorpay order details for payment
   */
  create: async (data: SubscriptionCreateRequest): Promise<{ subscription: Subscription; razorpayOrder: RazorpayOrder | null }> => {
    return apiClient.post<{ subscription: Subscription; razorpayOrder: RazorpayOrder | null }>(API_ENDPOINTS.SUBSCRIPTIONS.CREATE, data);
  },

  estimateTrialPack: async (data: {
    items: TrialPackCreateRequestItem[];
    addressId: string;
    deliveryTime?: string | null;
  }): Promise<TrialPackCheckoutBreakdown> => {
    return apiClient.post<TrialPackCheckoutBreakdown>(API_ENDPOINTS.SUBSCRIPTIONS.ESTIMATE_TRIAL_PACK, data);
  },

  createTrialPack: async (data: {
    items: TrialPackCreateRequestItem[];
    addressId: string;
    deliveryTime: string;
    paymentMethod?: 'online' | 'cod';
  }): Promise<{
    subscriptions: Subscription[];
    razorpayOrder: RazorpayOrder | null;
    trialCheckoutOrderId?: string | null;
    orderTotal?: number;
    checkoutBreakdown?: TrialPackCheckoutBreakdown;
  }> => {
    return apiClient.post<{
      subscriptions: Subscription[];
      razorpayOrder: RazorpayOrder | null;
      trialCheckoutOrderId?: string | null;
      orderTotal?: number;
      checkoutBreakdown?: TrialPackCheckoutBreakdown;
    }>(
      API_ENDPOINTS.SUBSCRIPTIONS.CREATE_TRIAL_PACK,
      data,
    );
  },

  /**
   * Pause subscription
   */
  pause: async (id: string): Promise<Subscription> => {
    return apiClient.post<Subscription>(API_ENDPOINTS.SUBSCRIPTIONS.PAUSE(id));
  },

  /**
   * Resume subscription
   */
  resume: async (id: string): Promise<Subscription> => {
    return apiClient.post<Subscription>(API_ENDPOINTS.SUBSCRIPTIONS.RESUME(id));
  },

  /**
   * Cancel subscription
   */
  cancel: async (id: string): Promise<Subscription> => {
    return apiClient.post<Subscription>(API_ENDPOINTS.SUBSCRIPTIONS.CANCEL(id));
  },

  cancelToday: async (id: string): Promise<Subscription> => {
    return apiClient.post<Subscription>(API_ENDPOINTS.SUBSCRIPTIONS.CANCEL_TODAY(id));
  },

  setupAutopay: async (id: string): Promise<{ razorpaySubscriptionId: string; shortUrl: string | null; alreadyLinked: boolean; autopayStatus?: string; key?: string | null }> => {
    return apiClient.post<{ razorpaySubscriptionId: string; shortUrl: string | null; alreadyLinked: boolean; autopayStatus?: string; key?: string | null }>(
      API_ENDPOINTS.SUBSCRIPTIONS.SETUP_AUTOPAY(id)
    );
  },

  verifyAutopaySetup: async (
    id: string,
    payload: { razorpay_payment_id: string; razorpay_subscription_id?: string; razorpay_signature?: string }
  ): Promise<Subscription> => {
    return apiClient.post<Subscription>(API_ENDPOINTS.SUBSCRIPTIONS.VERIFY_AUTOPAY_SETUP(id), payload);
  },

  removeAutopay: async (id: string): Promise<Subscription> => {
    return apiClient.post<Subscription>(API_ENDPOINTS.SUBSCRIPTIONS.REMOVE_AUTOPAY(id));
  },

  renewInit: async (id: string): Promise<{ subscriptionId: string; razorpayOrder: RazorpayOrder }> => {
    return apiClient.post<{ subscriptionId: string; razorpayOrder: RazorpayOrder }>(
      API_ENDPOINTS.SUBSCRIPTIONS.RENEW_INIT(id)
    );
  },

  renewVerify: async (id: string, payload: { razorpay_order_id: string; razorpay_payment_id: string }): Promise<Subscription> => {
    return apiClient.post<Subscription>(API_ENDPOINTS.SUBSCRIPTIONS.RENEW_VERIFY(id), payload);
  },

  verifyPayment: async (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    trialSubscriptionId?: string;
  }): Promise<Subscription> => {
    return apiClient.post<Subscription>(API_ENDPOINTS.SUBSCRIPTIONS.VERIFY_PAYMENT, payload);
  },

  verifyTrialPackPayment: async (payload: { razorpay_order_id: string; razorpay_payment_id: string }): Promise<Subscription[]> => {
    return apiClient.post<Subscription[]>(API_ENDPOINTS.SUBSCRIPTIONS.VERIFY_TRIAL_PACK_PAYMENT, payload);
  },

  /**
   * Pause a specific delivery date
   */
  pauseDate: async (id: string, date: string): Promise<PausedDate> => {
    return apiClient.post<PausedDate>(API_ENDPOINTS.SUBSCRIPTIONS.PAUSE_DATE(id), { date });
  },
};

/**
 * Admin Subscriptions API Service
 */
export const adminSubscriptionsApi = {
  /**
   * Get all subscriptions (admin view)
   */
  getAll: async (): Promise<Subscription[]> => {
    return apiClient.get<Subscription[]>(API_ENDPOINTS.ADMIN.SUBSCRIPTIONS.LIST);
  },

  /**
   * Get subscription by ID
   */
  getById: async (id: string): Promise<Subscription> => {
    return apiClient.get<Subscription>(API_ENDPOINTS.ADMIN.SUBSCRIPTIONS.DETAIL(id));
  },

  /**
   * Pause subscription (admin)
   */
  pause: async (id: string): Promise<Subscription> => {
    return apiClient.post<Subscription>(API_ENDPOINTS.ADMIN.SUBSCRIPTIONS.PAUSE(id));
  },

  /**
   * Resume subscription (admin)
   */
  resume: async (id: string): Promise<Subscription> => {
    return apiClient.post<Subscription>(API_ENDPOINTS.ADMIN.SUBSCRIPTIONS.RESUME(id));
  },
};
