const express = require('express');
const router = express.Router();
const couponService = require('../services/couponService');

const debugApi =
  () => process.env.MILKO_DEBUG_API === '1' || process.env.MILKO_DEBUG_API === 'true';

/**
 * Public Coupon Routes
 * Base path: /api/coupons
 * Public access for coupon validation
 */

/**
 * Validate coupon code
 * POST /api/coupons/validate
 * Body: { code: string, cartAmount: number }
 */
router.post('/validate', async (req, res, next) => {
  try {
    const { code, cartAmount = 0 } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Coupon code is required',
      });
    }

    const coupon = await couponService.validateCoupon(code, cartAmount);

    if (debugApi()) {
      console.log('[COUPONS] validate ok', {
        codeLen: String(code).length,
        cartAmount: Number(cartAmount) || 0,
      });
    }

    res.json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    console.error('[COUPONS] validate error', {
      message: error?.message,
      name: error?.name,
      codeLen: typeof req.body?.code === 'string' ? req.body.code.length : 0,
    });
    // Return validation errors as 400, not 500
    if (error.message && error.message.includes('Invalid') || 
        error.message.includes('not active') ||
        error.message.includes('expired') ||
        error.message.includes('limit') ||
        error.message.includes('Minimum purchase')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

/**
 * List all active coupons (for customers)
 * GET /api/coupons
 */
router.get('/', async (req, res, next) => {
  try {
    const coupons = await couponService.getActiveCoupons();
    if (debugApi()) {
      console.log('[COUPONS] listActive ok', { count: Array.isArray(coupons) ? coupons.length : -1 });
    }
    res.json({
      success: true,
      data: coupons,
    });
  } catch (error) {
    console.error('[COUPONS] listActive failed', {
      message: error?.message,
      name: error?.name,
      code: error?.code,
    });
    next(error);
  }
});

module.exports = router;
