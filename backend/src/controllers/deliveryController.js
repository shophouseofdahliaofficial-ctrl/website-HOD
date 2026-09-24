const delhiveryService = require('../services/delhiveryService');
const productDeliverabilityService = require('../services/productDeliverabilityService');
const { query } = require('../config/database');

/**
 * Check delivery availability for a pincode (via Delhivery & Product deliverability rules)
 */
async function checkPincode(req, res) {
  try {
    const rawPin = req.query.pincode || req.body.pincode;
    const productId = req.query.productId || req.body.productId;

    const pincode = String(rawPin || '').replace(/[^\d]/g, '').trim();

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        deliverable: false,
        message: 'Please provide a valid 6-digit Indian PIN code',
      });
    }

    // 1. Query Delhivery for live courier serviceability
    const delhiveryResult = await delhiveryService.checkPincodeServiceability(pincode);

    let deliverable = Boolean(delhiveryResult.serviceable);
    let deliveryTimeText = delhiveryResult.deliveryTimeText || '3-5 Days';
    let locationMessage = delhiveryResult.city || delhiveryResult.district
      ? `${delhiveryResult.city || delhiveryResult.district}${delhiveryResult.state ? `, ${delhiveryResult.state}` : ''}`
      : (delhiveryResult.state || (delhiveryResult.serviceable ? 'India' : pincode));

    // 2. If a specific product is being checked, enforce product deliverability constraints
    if (productId) {
      const productSettings = await productDeliverabilityService.getProductDeliverabilitySettings(productId);
      if (productSettings) {
        const { deliveryPincodes, isNationwideDelivery } = productSettings;

        // Fetch full product for custom delivery_time_text or configs
        const prodRes = await query(
          `SELECT delivery_time_text, delivery_pincodes, is_nationwide_delivery FROM products WHERE id = $1`,
          [productId]
        );

        if (prodRes.rows.length > 0) {
          const row = prodRes.rows[0];
          const configs = Array.isArray(row.delivery_pincodes)
            ? row.delivery_pincodes
            : typeof row.delivery_pincodes === 'string'
              ? (() => {
                  try {
                    return JSON.parse(row.delivery_pincodes);
                  } catch {
                    return [];
                  }
                })()
              : [];

          // Match custom pincode delivery time text if set for this specific pincode
          const matchedConfig = configs.find(
            (c) => (typeof c === 'object' && c && String(c.pincode || '').trim() === pincode)
          );

          if (matchedConfig && matchedConfig.deliveryTimeText) {
            deliveryTimeText = matchedConfig.deliveryTimeText;
          } else if (row.delivery_time_text && String(row.delivery_time_text).trim()) {
            deliveryTimeText = String(row.delivery_time_text).trim();
          }

          // If product is NOT nationwide delivery and pincode is not in allowed list
          if (!isNationwideDelivery) {
            const isAllowedByProduct = Array.isArray(deliveryPincodes) && deliveryPincodes.includes(pincode);
            if (!isAllowedByProduct) {
              deliverable = false;
            }
          }
        }
      }
    }

    const message = deliverable
      ? `Delivery available to ${locationMessage} (${pincode})`
      : (delhiveryResult.message || `Delivery is currently unavailable to ${locationMessage || pincode}`);

    const payload = {
      deliverable,
      pincode,
      city: delhiveryResult.city || '',
      district: delhiveryResult.district || '',
      state: delhiveryResult.state || '',
      cod: deliverable ? Boolean(delhiveryResult.cod) : false,
      prepaid: deliverable ? Boolean(delhiveryResult.prepaid) : false,
      isOda: deliverable ? Boolean(delhiveryResult.isOda) : false,
      deliveryTimeText: deliverable ? deliveryTimeText : null,
      provider: 'delhivery',
      locationLabel: locationMessage || pincode,
      message,
    };

    return res.json({
      success: true,
      data: payload,
      ...payload,
    });
  } catch (error) {
    console.error('[DeliveryController] checkPincode error:', error);
    return res.status(500).json({
      success: false,
      deliverable: false,
      message: 'Failed to verify delivery serviceability',
    });
  }
}

module.exports = {
  checkPincode,
};
