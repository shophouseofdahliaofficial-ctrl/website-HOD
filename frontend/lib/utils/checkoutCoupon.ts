/** Persists cart coupon across navigation to `/checkout` (session tab). */
export const CHECKOUT_COUPON_STORAGE_KEY = 'milko_checkout_coupon_v1';

export function saveCheckoutCouponCode(code: string | null): void {
  if (typeof window === 'undefined') return;
  if (!code?.trim()) {
    sessionStorage.removeItem(CHECKOUT_COUPON_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(
    CHECKOUT_COUPON_STORAGE_KEY,
    JSON.stringify({ code: code.trim().toUpperCase() }),
  );
}

export function readCheckoutCouponCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CHECKOUT_COUPON_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { code?: string };
    return typeof o.code === 'string' && o.code.trim() ? o.code.trim().toUpperCase() : null;
  } catch {
    return null;
  }
}
