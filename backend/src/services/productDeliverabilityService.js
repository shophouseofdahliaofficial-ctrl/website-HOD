const { query } = require('../config/database');
const { ValidationError } = require('../utils/errors');

function normalizePostalCode(value) {
  const pin = String(value || '').replace(/[^\d]/g, '').trim();
  return /^\d{6}$/.test(pin) ? pin : null;
}

function normalizeDeliveryPincodes(raw) {
  const base = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];
  return Array.from(
    new Set(
      base
        .map((v) => normalizePostalCode(v && typeof v === 'object' ? v.pincode : v))
        .filter(Boolean)
    )
  );
}

async function getProductDeliveryPincodes(productId) {
  const res = await query(`SELECT delivery_pincodes FROM products WHERE id = $1`, [productId]);
  if (res.rows.length === 0) return null;
  return normalizeDeliveryPincodes(res.rows[0].delivery_pincodes);
}

async function getProductDeliverabilitySettings(productId) {
  const res = await query(
    `SELECT delivery_pincodes, is_nationwide_delivery FROM products WHERE id = $1`,
    [productId]
  );
  if (res.rows.length === 0) return null;
  return {
    deliveryPincodes: normalizeDeliveryPincodes(res.rows[0].delivery_pincodes),
    isNationwideDelivery: Boolean(res.rows[0].is_nationwide_delivery),
  };
}

async function getSubscriptionServiceablePincodes() {
  const res = await query(
    `SELECT metadata
     FROM site_content
     WHERE content_type = 'subscription_delivery' AND is_active = true
     ORDER BY updated_at DESC
     LIMIT 1`
  );
  if (res.rows.length === 0) return [];
  const meta = res.rows[0]?.metadata || {};
  const raw = Array.isArray(meta.serviceablePincodes) ? meta.serviceablePincodes : [];
  const parsed = raw.map((entry) => (entry && typeof entry === 'object' ? entry.pincode : entry));
  return normalizeDeliveryPincodes(parsed);
}

function isSubscriptionPostalCodeServiceable(serviceablePincodes, postalCode) {
  if (!Array.isArray(serviceablePincodes) || serviceablePincodes.length === 0) return true;
  const normalizedPostalCode = normalizePostalCode(postalCode);
  if (!normalizedPostalCode) return false;
  return serviceablePincodes.includes(normalizedPostalCode);
}

async function assertSubscriptionPostalCodeServiceable(postalCode) {
  const serviceablePincodes = await getSubscriptionServiceablePincodes();
  if (serviceablePincodes.length === 0) return;
  const normalizedPostalCode = normalizePostalCode(postalCode);
  if (!normalizedPostalCode) {
    throw new ValidationError('Subscription is available only for configured 6-digit pincodes');
  }
  if (!isSubscriptionPostalCodeServiceable(serviceablePincodes, normalizedPostalCode)) {
    throw new ValidationError(`Subscription is not available for pincode ${normalizedPostalCode}`);
  }
}

function isDeliverableForProduct(deliveryPincodes, postalCode, isNationwideDelivery = false) {
  const normalizedPostalCode = normalizePostalCode(postalCode);
  if (!normalizedPostalCode) return false;
  if (isNationwideDelivery) {
    return true;
  }
  if (!Array.isArray(deliveryPincodes) || deliveryPincodes.length === 0) return false;
  return deliveryPincodes.includes(normalizedPostalCode);
}

async function assertProductsDeliverableToPostalCode(items, postalCode) {
  const normalizedPostalCode = normalizePostalCode(postalCode);
  if (!normalizedPostalCode) {
    throw new ValidationError('Delivery address must include a valid 6-digit postal code');
  }

  const checked = new Set();
  for (const item of items) {
    const productId = Number(item?.productId);
    if (!Number.isFinite(productId) || checked.has(productId)) continue;
    checked.add(productId);
    const deliverability = await getProductDeliverabilitySettings(productId);
    if (deliverability === null) {
      throw new ValidationError('One or more selected products are unavailable');
    }
    if (!isDeliverableForProduct(deliverability.deliveryPincodes, normalizedPostalCode, deliverability.isNationwideDelivery)) {
      throw new ValidationError(`Product ${productId} is not deliverable to pincode ${normalizedPostalCode}`);
    }
  }
}

module.exports = {
  normalizePostalCode,
  normalizeDeliveryPincodes,
  getProductDeliveryPincodes,
  getProductDeliverabilitySettings,
  isDeliverableForProduct,
  assertProductsDeliverableToPostalCode,
  getSubscriptionServiceablePincodes,
  isSubscriptionPostalCodeServiceable,
  assertSubscriptionPostalCodeServiceable,
};
