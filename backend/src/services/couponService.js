const couponModel = require('../models/coupon');
const { ValidationError } = require('../utils/errors');

/**
 * Coupon Service
 * Business logic for coupon operations
 */

const parseDateBoundary = (val, isEndOfDay = false) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(isEndOfDay ? `${trimmed}T23:59:59.999Z` : `${trimmed}T00:00:00.000Z`);
    }
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

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
    isActive = true,
  } = couponData;

  // Validate required fields
  if (!code || !String(code).trim()) {
    throw new ValidationError('Coupon code is required');
  }
  if (!discountType) {
    throw new ValidationError('Discount type is required');
  }
  if (discountValue === undefined || discountValue === null || discountValue === '') {
    throw new ValidationError('Discount value is required');
  }

  // Validate discount type
  if (!['percentage', 'fixed'].includes(discountType)) {
    throw new ValidationError('Discount type must be "percentage" or "fixed"');
  }

  // Validate discount value
  const numDiscountValue = parseFloat(String(discountValue));
  if (isNaN(numDiscountValue) || numDiscountValue <= 0) {
    throw new ValidationError('Discount value must be greater than 0');
  }

  // Validate percentage discount (0-100)
  if (discountType === 'percentage' && numDiscountValue > 100) {
    throw new ValidationError('Percentage discount cannot exceed 100%');
  }

  // Validate dates
  const parsedValidFrom = parseDateBoundary(validFrom, false) || new Date();
  const parsedValidUntil = parseDateBoundary(validUntil, true);

  if (parsedValidUntil && parsedValidUntil < parsedValidFrom) {
    throw new ValidationError('Valid until date cannot be before valid from date');
  }

  // Check if code already exists
  const normalizedCode = String(code).trim().toUpperCase();
  const existing = await couponModel.getCouponByCode(normalizedCode);
  if (existing) {
    throw new ValidationError(`Coupon code "${normalizedCode}" already exists`);
  }

  return await couponModel.createCoupon({
    code: normalizedCode,
    description: description ? String(description).trim() : null,
    discountType,
    discountValue: numDiscountValue,
    minPurchaseAmount: minPurchaseAmount ? Math.max(0, parseFloat(String(minPurchaseAmount)) || 0) : 0,
    maxDiscountAmount: maxDiscountAmount != null && maxDiscountAmount !== '' ? Math.max(0, parseFloat(String(maxDiscountAmount)) || 0) : null,
    usageLimit: usageLimit != null && usageLimit !== '' ? Math.max(1, parseInt(String(usageLimit), 10) || 1) : null,
    validFrom: parsedValidFrom,
    validUntil: parsedValidUntil,
    isActive: isActive !== false,
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

  const payload = {};

  // Validate discount type if provided
  if (updates.discountType !== undefined) {
    if (!['percentage', 'fixed'].includes(updates.discountType)) {
      throw new ValidationError('Discount type must be "percentage" or "fixed"');
    }
    payload.discountType = updates.discountType;
  }

  // Validate discount value if provided
  if (updates.discountValue !== undefined && updates.discountValue !== null && updates.discountValue !== '') {
    const numDiscountValue = parseFloat(String(updates.discountValue));
    if (isNaN(numDiscountValue) || numDiscountValue <= 0) {
      throw new ValidationError('Discount value must be greater than 0');
    }
    const discountType = payload.discountType || coupon.discountType;
    if (discountType === 'percentage' && numDiscountValue > 100) {
      throw new ValidationError('Percentage discount cannot exceed 100%');
    }
    payload.discountValue = numDiscountValue;
  }

  // Validate code uniqueness if code is being updated
  if (updates.code) {
    const normalizedCode = String(updates.code).trim().toUpperCase();
    const existing = await couponModel.getCouponByCode(normalizedCode);
    if (existing && String(existing.id) !== String(couponId)) {
      throw new ValidationError(`Coupon code "${normalizedCode}" already exists`);
    }
    payload.code = normalizedCode;
  }

  if (updates.description !== undefined) {
    payload.description = updates.description ? String(updates.description).trim() : null;
  }

  // Validate dates
  let validFromDate = coupon.validFrom ? new Date(coupon.validFrom) : new Date();
  if (updates.validFrom !== undefined) {
    const parsed = parseDateBoundary(updates.validFrom, false);
    if (updates.validFrom && !parsed) {
      throw new ValidationError('Invalid valid from date');
    }
    validFromDate = parsed || new Date();
    payload.validFrom = validFromDate;
  }

  if (updates.validUntil !== undefined) {
    if (updates.validUntil) {
      const parsed = parseDateBoundary(updates.validUntil, true);
      if (!parsed) {
        throw new ValidationError('Invalid valid until date');
      }
      if (parsed < validFromDate) {
        throw new ValidationError('Valid until date cannot be before valid from date');
      }
      payload.validUntil = parsed;
    } else {
      payload.validUntil = null;
    }
  }

  if (updates.minPurchaseAmount !== undefined) {
    payload.minPurchaseAmount = updates.minPurchaseAmount != null && updates.minPurchaseAmount !== '' 
      ? Math.max(0, parseFloat(String(updates.minPurchaseAmount)) || 0) 
      : 0;
  }

  if (updates.maxDiscountAmount !== undefined) {
    payload.maxDiscountAmount = updates.maxDiscountAmount != null && updates.maxDiscountAmount !== '' 
      ? Math.max(0, parseFloat(String(updates.maxDiscountAmount)) || 0) 
      : null;
  }

  if (updates.usageLimit !== undefined) {
    payload.usageLimit = updates.usageLimit != null && updates.usageLimit !== '' 
      ? Math.max(1, parseInt(String(updates.usageLimit), 10) || 1) 
      : null;
  }

  if (updates.isActive !== undefined) {
    payload.isActive = Boolean(updates.isActive);
  }

  return await couponModel.updateCoupon(couponId, payload);
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
