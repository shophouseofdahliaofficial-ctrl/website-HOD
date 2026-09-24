import { apiClient } from './client';

export interface DeliveryPincodeCheckResponse {
  success: boolean;
  deliverable: boolean;
  pincode: string;
  city?: string;
  district?: string;
  state?: string;
  cod?: boolean;
  prepaid?: boolean;
  isOda?: boolean;
  deliveryTimeText?: string;
  provider?: string;
  locationLabel?: string;
  message?: string;
}

export const deliveryApi = {
  /**
   * Check delivery serviceability for a pincode via Delhivery and product rules
   */
  async checkPincode(pincode: string, productId?: string): Promise<DeliveryPincodeCheckResponse> {
    const cleanPin = String(pincode || '').replace(/[^\d]/g, '').trim();
    const query = new URLSearchParams({ pincode: cleanPin });
    if (productId) {
      query.append('productId', productId);
    }
    const res = await apiClient.getInstance().get(`/delivery/check-pincode?${query.toString()}`);
    const data = (res.data && res.data.data) ? res.data.data : (res.data || {});
    return data as DeliveryPincodeCheckResponse;
  },
};
