const { query } = require('../config/database');
const siteContentModel = require('../models/siteContent');
const shiprocketService = require('./shiprocketService');

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMoney(value) {
  return Math.max(0, Math.round(Number(value || 0) * 100) / 100);
}

function normalizeDeliveryRatesConfig(metadata) {
  const warehouseLatitude = toFiniteNumber(metadata?.warehouseLatitude);
  const warehouseLongitude = toFiniteNumber(metadata?.warehouseLongitude);
  const ranges = Array.isArray(metadata?.ranges)
    ? metadata.ranges
        .map((row) => {
          const startMeters = toFiniteNumber(row?.startMeters);
          const endMeters = toFiniteNumber(row?.endMeters);
          const rate = toFiniteNumber(row?.rate);
          if (startMeters === null || endMeters === null || rate === null) return null;
          return {
            startMeters: Math.max(0, Math.round(startMeters)),
            endMeters: Math.max(0, Math.round(endMeters)),
            rate: roundMoney(rate),
          };
        })
        .filter((row) => !!row && row.endMeters >= row.startMeters)
        .sort((a, b) => a.startMeters - b.startMeters || a.endMeters - b.endMeters)
    : [];

  return {
    warehouseLatitude: warehouseLatitude ?? undefined,
    warehouseLongitude: warehouseLongitude ?? undefined,
    ranges,
  };
}

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  const toRadians = (deg) => (deg * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

function resolveDeliveryRate(config, customerLatitude, customerLongitude) {
  if (
    !Number.isFinite(config.warehouseLatitude)
    || !Number.isFinite(config.warehouseLongitude)
    || !Number.isFinite(customerLatitude)
    || !Number.isFinite(customerLongitude)
  ) {
    return { distanceMeters: null, charge: 0 };
  }

  const distanceMeters = Math.round(
    calculateDistanceMeters(
      Number(config.warehouseLatitude),
      Number(config.warehouseLongitude),
      Number(customerLatitude),
      Number(customerLongitude),
    ),
  );

  if (config.ranges.length === 0) {
    return { distanceMeters, charge: 0 };
  }

  const directMatch = config.ranges.find(
    (row) => distanceMeters >= row.startMeters && distanceMeters <= row.endMeters,
  );
  if (directMatch) {
    return { distanceMeters, charge: directMatch.rate };
  }

  const lastRange = config.ranges[config.ranges.length - 1];
  if (lastRange && distanceMeters > lastRange.endMeters) {
    return { distanceMeters, charge: lastRange.rate };
  }

  return { distanceMeters, charge: 0 };
}

async function getPlatformFeeAmount() {
  try {
    const data = await siteContentModel.getContentByType('platform_fee');
    const metadataAmount = toFiniteNumber(data?.metadata?.amount);
    const titleAmount = toFiniteNumber(data?.title);
    const amount = metadataAmount !== null ? metadataAmount : titleAmount;
    return amount !== null && amount > 0 ? roundMoney(amount) : 0;
  } catch {
    return 0;
  }
}

async function getDeliveryRatesConfig() {
  try {
    const data = await siteContentModel.getContentByType('delivery_rates');
    return normalizeDeliveryRatesConfig(data?.metadata || {});
  } catch {
    return { ranges: [] };
  }
}

function extractAddressCoordinates(deliveryAddress) {
  return {
    latitude: toFiniteNumber(deliveryAddress?.latitude),
    longitude: toFiniteNumber(deliveryAddress?.longitude),
  };
}

async function isFirstProductOrder(userId) {
  if (!userId) return false;

  try {
    const res = await query(
      `
      SELECT COUNT(*)::int AS c
      FROM orders
      WHERE user_id = $1
        AND payment_status IN ('paid', 'cod')
      `,
      [userId],
    );
    return Number(res.rows?.[0]?.c || 0) === 0;
  } catch {
    return false;
  }
}

async function calculateCheckoutFees({ userId, items, deliveryAddress, paymentMethod }) {
  const [platformFee, deliveryRatesConfig, firstOrder] = await Promise.all([
    getPlatformFeeAmount(),
    getDeliveryRatesConfig(),
    Array.isArray(items) && items.length > 0 ? isFirstProductOrder(userId) : Promise.resolve(false),
  ]);

  const deliveryPostalCode = deliveryAddress?.postalCode || deliveryAddress?.postal_code || deliveryAddress?.postalCode;

  // Let's resolve the items, querying the DB for each item to check if it is nationwide delivery
  let isNationwideDelivery = false;
  let totalWeight = 0;
  let declaredValue = 0;

  if (Array.isArray(items) && items.length > 0) {
    for (const item of items) {
      const productId = Number(item.productId);
      const variationId = item.variationId ? Number(item.variationId) : null;
      const quantity = Number(item.quantity || 1);

      // Query database for product
      const productRes = await query(
        `SELECT is_nationwide_delivery, delivery_pincodes, weight, selling_price, price_per_litre FROM products WHERE id = $1`,
        [productId]
      );
      if (productRes.rows.length > 0) {
        const p = productRes.rows[0];
        let isItemNationwide = false;
        if (p.is_nationwide_delivery) {
          const rawPincodes = Array.isArray(p.delivery_pincodes) ? p.delivery_pincodes : [];
          const allowedPincodes = rawPincodes.map(entry => {
            if (entry && typeof entry === 'object') {
              return String(entry.pincode || '').trim();
            }
            return String(entry || '').trim();
          });
          if (deliveryPostalCode && !allowedPincodes.includes(String(deliveryPostalCode).trim())) {
            isItemNationwide = true;
          }
        }

        if (isItemNationwide) {
          isNationwideDelivery = true;
          let weight = p.weight != null ? parseFloat(p.weight) : 0.1;
          let unitPrice = 0;

          const basePrice = p.selling_price != null
            ? parseFloat(p.selling_price)
            : parseFloat(p.price_per_litre || 0);

          let mult = 1;

          if (variationId) {
            const varRes = await query(
              `SELECT weight, price, price_multiplier FROM product_variations WHERE id = $1 AND product_id = $2`,
              [variationId, productId]
            );
            if (varRes.rows.length > 0) {
              const v = varRes.rows[0];
              if (v.weight != null) {
                weight = parseFloat(v.weight);
              }
              if (v.price_multiplier != null) {
                mult = parseFloat(v.price_multiplier);
              }
              if (v.price != null) {
                unitPrice = parseFloat(v.price);
              } else {
                unitPrice = basePrice * mult;
              }
            } else {
              unitPrice = basePrice * mult;
            }
          } else {
            unitPrice = basePrice * mult;
          }

          totalWeight += weight * quantity;
          declaredValue += unitPrice * quantity;
        }
      }
    }
  }

  let deliveryCharges = 0;
  let deliveryDistanceMeters = null;
  let shiprocketResult = null;

  if (isNationwideDelivery) {
    // Fetch adminPincode from deliveryRatesConfig
    const contentData = await siteContentModel.getContentByType('delivery_rates');
    const adminPincode = contentData?.metadata?.adminPincode;

    if (adminPincode && deliveryPostalCode) {
      // Query Shiprocket Courier Serviceability
      const cheapest = await shiprocketService.getCheapestRate({
        pickupPostcode: adminPincode,
        deliveryPostcode: deliveryPostalCode,
        weight: Math.max(0.1, totalWeight),
        cod: paymentMethod === 'cod',
        declaredValue: declaredValue,
      });

      if (cheapest) {
        deliveryCharges = cheapest.rate;
        shiprocketResult = cheapest;
      } else {
        // Fallback to local rate resolving if serviceability query fails
        const { latitude, longitude } = extractAddressCoordinates(deliveryAddress);
        const deliveryRate = resolveDeliveryRate(deliveryRatesConfig, latitude, longitude);
        deliveryCharges = deliveryRate.charge;
        deliveryDistanceMeters = deliveryRate.distanceMeters;
      }
    } else {
      // Fallback if pincodes are missing
      const { latitude, longitude } = extractAddressCoordinates(deliveryAddress);
      const deliveryRate = resolveDeliveryRate(deliveryRatesConfig, latitude, longitude);
      deliveryCharges = deliveryRate.charge;
      deliveryDistanceMeters = deliveryRate.distanceMeters;
    }
  } else {
    // Local delivery
    const { latitude, longitude } = extractAddressCoordinates(deliveryAddress);
    const deliveryRate = resolveDeliveryRate(deliveryRatesConfig, latitude, longitude);
    deliveryCharges = deliveryRate.charge;
    deliveryDistanceMeters = deliveryRate.distanceMeters;
  }

  // Free delivery for the first product order
  if (Array.isArray(items) && items.length > 0 && firstOrder) {
    deliveryCharges = 0;
  }

  return {
    platformFee,
    deliveryCharges: roundMoney(deliveryCharges),
    isFirstProductOrder: firstOrder,
    deliveryDistanceMeters,
    isNationwideDelivery,
    shiprocketResult,
  };
}

module.exports = {
  calculateCheckoutFees,
  getPlatformFeeAmount,
  roundMoney,
};
