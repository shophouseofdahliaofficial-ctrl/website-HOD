/**
 * Per-user localStorage keys so cart, pincode, and subscription-cart lines do not leak across accounts.
 */

const LEGACY_PINCODE = 'milko_delivery_pincode';
const LEGACY_PINCODE_STATUS = 'milko_delivery_status';

export function scopedCartKey(userId: string | null): string {
  return userId ? `milko_cart_v1_u_${userId}` : 'milko_cart_v1_guest';
}

export function scopedPincodeKey(userId: string | null): string {
  return userId ? `milko_delivery_pincode_u_${userId}` : 'milko_delivery_pincode_guest';
}

export function scopedPincodeStatusKey(userId: string | null): string {
  return userId ? `milko_delivery_status_u_${userId}` : 'milko_delivery_status_guest';
}

export function scopedSubscriptionCartKey(userId: string | null): string {
  return userId ? `milko_subscription_cart_item_v1_u_${userId}` : 'milko_subscription_cart_item_v1_guest';
}

export function readScopedPincode(userId: string | null): string {
  if (typeof window === 'undefined') return '';
  const k = scopedPincodeKey(userId);
  let v = localStorage.getItem(k);
  if (!v && !userId) {
    v = localStorage.getItem(LEGACY_PINCODE);
    if (v) {
      localStorage.setItem(k, v);
      const st = localStorage.getItem(LEGACY_PINCODE_STATUS);
      if (st) localStorage.setItem(scopedPincodeStatusKey(null), st);
      localStorage.removeItem(LEGACY_PINCODE);
      localStorage.removeItem(LEGACY_PINCODE_STATUS);
    }
  }
  return (v || '').trim();
}

export function writeScopedPincode(userId: string | null, pin: string, status: 'available' | 'unavailable'): void {
  if (typeof window === 'undefined') return;
  const pk = scopedPincodeKey(userId);
  const sk = scopedPincodeStatusKey(userId);
  if (pin.length > 0) {
    localStorage.setItem(pk, pin);
    localStorage.setItem(sk, status);
  } else {
    localStorage.removeItem(pk);
    localStorage.removeItem(sk);
  }
}

export function clearScopedPincode(userId: string | null): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(scopedPincodeKey(userId));
  localStorage.removeItem(scopedPincodeStatusKey(userId));
}

const LEGACY_SUBSCRIPTION_CART = 'milko_subscription_cart_item_v1';

export function readSubscriptionCartJson(userId: string | null): string | null {
  if (typeof window === 'undefined') return null;
  const k = scopedSubscriptionCartKey(userId);
  let raw = localStorage.getItem(k);
  if (!raw && !userId) {
    raw = localStorage.getItem(LEGACY_SUBSCRIPTION_CART);
    if (raw) {
      localStorage.setItem(k, raw);
      localStorage.removeItem(LEGACY_SUBSCRIPTION_CART);
    }
  }
  if (userId && !raw) {
    const guestKey = scopedSubscriptionCartKey(null);
    const guestRaw = localStorage.getItem(guestKey);
    if (guestRaw) {
      localStorage.setItem(k, guestRaw);
      localStorage.removeItem(guestKey);
      raw = guestRaw;
    }
  }
  return raw;
}

export function writeSubscriptionCartJson(userId: string | null, json: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(scopedSubscriptionCartKey(userId), json);
}

export function clearSubscriptionCart(userId: string | null): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(scopedSubscriptionCartKey(userId));
  if (!userId) localStorage.removeItem(LEGACY_SUBSCRIPTION_CART);
}
