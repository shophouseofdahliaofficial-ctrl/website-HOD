const { query } = require('../config/database');

/**
 * Coupon Model
 * Handles all database operations for coupons
 */

/**
 * Transform coupon from database format (snake_case) to API format (camelCase)
 * @param {Object} coupon - Coupon row from database
 * @returns {Object|null} Transformed coupon or null
 */
const transformCoupon = (coupon) => {
  if (!coupon) return null;
  
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discount_type,
    discountValue: parseFloat(coupon.discount_value),
    minPurchaseAmount: coupon.min_purchase_amount ? parseFloat(coupon.min_purchase_amount) : null,
    maxDiscountAmount: coupon.max_discount_amount ? parseFloat(coupon.max_discount_amount) : null,
    usageLimit: coupon.usage_limit,
    usedCount: coupon.used_count || 0,
    validFrom: coupon.valid_from?.toISOString(),
    validUntil: coupon.valid_until?.toISOString() || null,
    isActive: coupon.is_active,
    createdAt: coupon.created_at?.toISOString(),
    updatedAt: coupon.updated_at?.toISOString(),
  };
};

/**
 * Create a new coupon
 * @param {Object} couponData - Coupon data
 * @returns {Promise<Object>} Created coupon (camelCase format)
 */
const createCoupon = async (couponData) => {
  const { 
    code,
    description,
    discountType,
    discountValue,
    minPurchaseAmount = 0,
    maxDiscountAmount = null,
    usageLimit = null,
    validFrom = null,
    validUntil = null,
    isActive = true
  } = couponData;

  const result = await query(
    `INSERT INTO coupons (code, description, discount_type, discount_value, min_purchase_amount, max_discount_amount, usage_limit, valid_from, valid_until, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
     RETURNING *`,
    [code, description || null, discountType, discountValue, minPurchaseAmount, maxDiscountAmount, usageLimit, validFrom || new Date(), validUntil, isActive]
  );

  return transformCoupon(result.rows[0]);
};

/**
 * Get all coupons (for admin)
 * @returns {Promise<Array>} Array of all coupons (camelCase format)
 */
const getAllCoupons = async () => {
  const result = await query(
    'SELECT * FROM coupons ORDER BY created_at DESC'
  );

  return result.rows.map(transformCoupon);
};

/**
 * Get active coupons (for customer use)
 * @returns {Promise<Array>} Array of active coupons (camelCase format)
 */
const getActiveCoupons = async () => {
  const now = new Date();
  const result = await query(
    `SELECT * FROM coupons 
     WHERE is_active = true 
     AND valid_from <= $1 
     AND (valid_until IS NULL OR valid_until >= $1)
     AND (usage_limit IS NULL OR used_count < usage_limit)
     ORDER BY created_at DESC`,
    [now]
  );

  return result.rows.map(transformCoupon);
};

/**
 * Get coupon by ID
 * @param {string} couponId - Coupon ID
 * @returns {Promise<Object|null>} Coupon object or null (camelCase format)
 */
const getCouponById = async (couponId) => {
  const result = await query(
    'SELECT * FROM coupons WHERE id = $1',
    [couponId]
  );

  return transformCoupon(result.rows[0] || null);
};

/**
 * Get coupon by code
 * @param {string} code - Coupon code
 * @returns {Promise<Object|null>} Coupon object or null (camelCase format)
 */
const getCouponByCode = async (code) => {
  const result = await query(
    'SELECT * FROM coupons WHERE code = $1',
    [code.toUpperCase()]
  );

  return transformCoupon(result.rows[0] || null);
};

/**
 * Update coupon
 * @param {string} couponId - Coupon ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated coupon (camelCase format)
 */
const updateCoupon = async (couponId, updates) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(updates).forEach((key) => {
    // Map camelCase to snake_case
    const dbKey = key === 'discountType' ? 'discount_type' : 
                  key === 'discountValue' ? 'discount_value' :
                  key === 'minPurchaseAmount' ? 'min_purchase_amount' :
                  key === 'maxDiscountAmount' ? 'max_discount_amount' :
                  key === 'usageLimit' ? 'usage_limit' :
                  key === 'usedCount' ? 'used_count' :
                  key === 'validFrom' ? 'valid_from' :
                  key === 'validUntil' ? 'valid_until' :
                  key === 'isActive' ? 'is_active' : key;
    
    fields.push(`${dbKey} = $${paramCount}`);
    values.push(updates[key]);
    paramCount++;
  });

  fields.push(`updated_at = NOW()`);
  values.push(couponId);

  const result = await query(
    `UPDATE coupons 
     SET ${fields.join(', ')} 
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );

  return transformCoupon(result.rows[0]);
};

/**
 * Increment used count for a coupon
 * @param {string} couponId - Coupon ID
 * @returns {Promise<Object>} Updated coupon (camelCase format)
 */
const incrementUsedCount = async (couponId) => {
  const result = await query(
    `UPDATE coupons 
     SET used_count = used_count + 1, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [couponId]
  );

  return transformCoupon(result.rows[0]);
};

/**
 * Delete coupon
 * @param {string} couponId - Coupon ID
 * @returns {Promise<Object>} Deleted coupon (camelCase format)
 */
const deleteCoupon = async (couponId) => {
  const result = await query(
    `DELETE FROM coupons 
     WHERE id = $1
     RETURNING *`,
    [couponId]
  );

  return transformCoupon(result.rows[0]);
};

module.exports = {
  createCoupon,
  getAllCoupons,
  getActiveCoupons,
  getCouponById,
  getCouponByCode,
  updateCoupon,
  incrementUsedCount,
  deleteCoupon,
};
