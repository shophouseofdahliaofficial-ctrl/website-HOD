const couponModel = require('../models/coupon');
const { ValidationError } = require('../utils/errors');

/**
 * Coupon Service
 * Business logic for coupon operations
 */

/**
 * Create a new coupon
 * @param {Object} couponData - Coupon data
 * @returns {Promise<Object>} Created coupon
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

  // Validate required fields
  if (!code || !discountType || !discountValue) {
    throw new ValidationError('Code, discount type, and discount value are required');
  }

  // Validate discount type
  if (!['percentage', 'fixed'].includes(discountType)) {
    throw new ValidationError('Discount type must be "percentage" or "fixed"');
  }

  // Validate discount value
  if (discountValue <= 0) {
    throw new ValidationError('Discount value must be greater than 0');
  }

  // Validate percentage discount (0-100)
  if (discountType === 'percentage' && discountValue > 100) {
    throw new ValidationError('Percentage discount cannot exceed 100%');
  }

  // Validate dates
  if (validUntil && validFrom) {
    const fromDate = new Date(validFrom);
    const untilDate = new Date(validUntil);
    if (untilDate <= fromDate) {
      throw new ValidationError('Valid until date must be after valid from date');
    }
  }

  // Check if code already exists
  const existing = await couponModel.getCouponByCode(code);
  if (existing) {
    throw new ValidationError('Coupon code already exists');
  }

  return await couponModel.createCoupon({
    code: code.toUpperCase().trim(),
    description,
    discountType,
    discountValue,
    minPurchaseAmount,
    maxDiscountAmount,
    usageLimit,
    validFrom: validFrom ? new Date(validFrom) : new Date(),
    validUntil: validUntil ? new Date(validUntil) : null,
    isActive
  });
};

/**
 * Update coupon
 * @param {string} couponId - Coupon ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated coupon
 */
const updateCoupon = async (couponId, updates) => {
  const coupon = await couponModel.getCouponById(couponId);
  if (!coupon) {
    throw new ValidationError('Coupon not found');
  }

  // Validate discount type if provided
  if (updates.discountType && !['percentage', 'fixed'].includes(updates.discountType)) {
    throw new ValidationError('Discount type must be "percentage" or "fixed"');
  }

  // Validate discount value if provided
  if (updates.discountValue !== undefined) {
    if (updates.discountValue <= 0) {
      throw new ValidationError('Discount value must be greater than 0');
    }
    if (updates.discountType === 'percentage' || coupon.discountType === 'percentage') {
      const discountType = updates.discountType || coupon.discountType;
      if (discountType === 'percentage' && updates.discountValue > 100) {
        throw new ValidationError('Percentage discount cannot exceed 100%');
      }
    }
  }

  // Validate code uniqueness if code is being updated
  if (updates.code) {
    const existing = await couponModel.getCouponByCode(updates.code);
    if (existing && existing.id !== couponId) {
      throw new ValidationError('Coupon code already exists');
    }
    updates.code = updates.code.toUpperCase().trim();
  }

  // Validate dates
  const validFrom = updates.validFrom ? new Date(updates.validFrom) : coupon.validFrom;
  const validUntil = updates.validUntil ? new Date(updates.validUntil) : coupon.validUntil;
  if (validUntil && validFrom && validUntil <= validFrom) {
    throw new ValidationError('Valid until date must be after valid from date');
  }

  return await couponModel.updateCoupon(couponId, updates);
};

/**
 * Validate and get coupon by code (for customer use)
 * @param {string} code - Coupon code
 * @param {number} cartAmount - Cart total amount
 * @returns {Promise<Object>} Valid coupon
 */
const validateCoupon = async (code, cartAmount = 0) => {
  const coupon = await couponModel.getCouponByCode(code);
  
  if (!coupon) {
    throw new ValidationError('Invalid coupon code');
  }

  if (!coupon.isActive) {
    throw new ValidationError('Coupon is not active');
  }

  const now = new Date();
  const validFrom = new Date(coupon.validFrom);
  const validUntil = coupon.validUntil ? new Date(coupon.validUntil) : null;

  if (now < validFrom) {
    throw new ValidationError('Coupon is not yet valid');
  }

  if (validUntil && now > validUntil) {
    throw new ValidationError('Coupon has expired');
  }

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw new ValidationError('Coupon usage limit reached');
  }

  if (coupon.minPurchaseAmount && cartAmount < coupon.minPurchaseAmount) {
    throw new ValidationError(`Minimum purchase amount of ₹${coupon.minPurchaseAmount} required`);
  }

  return coupon;
};

const getActiveCoupons = async () => {
  return await couponModel.getActiveCoupons();
};

module.exports = {
  createCoupon,
  updateCoupon,
  validateCoupon,
  getActiveCoupons,
};
