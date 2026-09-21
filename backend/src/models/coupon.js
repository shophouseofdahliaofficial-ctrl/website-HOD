const { query } = require('../config/database');

/**
 * Coupon Model
 * Handles all database operations for coupons
 */

let schemaEnsured = false;

const ensureCouponSchema = async () => {
  if (schemaEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
        discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
        min_purchase_amount DECIMAL(10, 2) DEFAULT 0,
        max_discount_amount DECIMAL(10, 2),
        usage_limit INTEGER,
        used_count INTEGER DEFAULT 0,
        valid_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        valid_until TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await query(`
      ALTER TABLE coupons
      ADD COLUMN IF NOT EXISTS code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) DEFAULT 'percentage',
      ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS min_purchase_amount DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS max_discount_amount DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS usage_limit INTEGER,
      ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    `);

    await query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'coupons' AND column_name = 'min_order_amount'
        ) THEN
          UPDATE coupons 
          SET min_purchase_amount = COALESCE(min_purchase_amount, min_order_amount, 0)
          WHERE min_purchase_amount IS NULL OR min_purchase_amount = 0;
        END IF;
      END $$;
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active) WHERE is_active = true;`);
    await query(`CREATE INDEX IF NOT EXISTS idx_coupons_valid_until ON coupons(valid_until);`);

    schemaEnsured = true;
  } catch (error) {
    console.warn('[milko-backend] ensureCouponSchema error:', error.message);
  }
};

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
    discountValue: parseFloat(coupon.discount_value || 0),
    minPurchaseAmount: coupon.min_purchase_amount ? parseFloat(coupon.min_purchase_amount) : (coupon.min_order_amount ? parseFloat(coupon.min_order_amount) : null),
    maxDiscountAmount: coupon.max_discount_amount ? parseFloat(coupon.max_discount_amount) : null,
    usageLimit: coupon.usage_limit,
    usedCount: coupon.used_count || 0,
    validFrom: coupon.valid_from ? new Date(coupon.valid_from).toISOString() : new Date().toISOString(),
    validUntil: coupon.valid_until ? new Date(coupon.valid_until).toISOString() : null,
    isActive: coupon.is_active ?? true,
    createdAt: coupon.created_at ? new Date(coupon.created_at).toISOString() : new Date().toISOString(),
    updatedAt: coupon.updated_at ? new Date(coupon.updated_at).toISOString() : new Date().toISOString(),
  };
};

/**
 * Create a new coupon
 * @param {Object} couponData - Coupon data
 * @returns {Promise<Object>} Created coupon (camelCase format)
 */
const createCoupon = async (couponData) => {
  await ensureCouponSchema();
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
  await ensureCouponSchema();
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
  await ensureCouponSchema();
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
  await ensureCouponSchema();
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
  await ensureCouponSchema();
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
  await ensureCouponSchema();
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
  await ensureCouponSchema();
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
  await ensureCouponSchema();
  const result = await query(
    `DELETE FROM coupons 
     WHERE id = $1
     RETURNING *`,
    [couponId]
  );

  return transformCoupon(result.rows[0]);
};

module.exports = {
  ensureCouponSchema,
  createCoupon,
  getAllCoupons,
  getActiveCoupons,
  getCouponById,
  getCouponByCode,
  updateCoupon,
  incrementUsedCount,
  deleteCoupon,
};
