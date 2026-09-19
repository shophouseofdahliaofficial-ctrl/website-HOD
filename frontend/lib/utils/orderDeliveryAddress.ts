export type OrderDeliveryAddress = {
  name?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
};

/** Normalize delivery_address JSON from API (camelCase or legacy snake_case). */
export function normalizeOrderDeliveryAddress(raw: unknown): OrderDeliveryAddress | null {
  if (raw == null) return null;
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }
  if (!obj) return null;

  const str = (v: unknown) => (v != null && String(v).trim() !== '' ? String(v).trim() : undefined);
  const num = (v: unknown) => {
    if (v == null || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : undefined;
  };

  const normalized: OrderDeliveryAddress = {
    name: str(obj.name),
    street: str(obj.street),
    city: str(obj.city),
    state: str(obj.state),
    postalCode: str(obj.postalCode ?? obj.postal_code),
    country: str(obj.country),
    phone: str(obj.phone),
    latitude: num(obj.latitude),
    longitude: num(obj.longitude),
  };

  const hasContent = Boolean(
    normalized.name ||
      normalized.street ||
      normalized.city ||
      normalized.state ||
      normalized.postalCode ||
      normalized.phone,
  );
  return hasContent ? normalized : null;
}

export function formatOrderDeliveryCityLine(addr: OrderDeliveryAddress): string {
  return [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ');
}
