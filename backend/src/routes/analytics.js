const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const cartAnalytics = require('../models/cartAnalytics');

/**
 * Analytics Routes
 * Base path: /api/analytics
 */

router.post('/cart-event', optionalAuth, async (req, res, next) => {
  try {
    const {
      sessionId,
      eventType,
      productId = null,
      variationId = null,
      cartItemCount = 0,
    } = req.body || {};

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ success: false, error: 'sessionId is required' });
    }
    if (!eventType || typeof eventType !== 'string') {
      return res.status(400).json({ success: false, error: 'eventType is required' });
    }
    if (!['add', 'remove', 'clear', 'order_placed'].includes(eventType)) {
      return res.status(400).json({ success: false, error: 'Invalid eventType' });
    }

    await cartAnalytics.insertCartEvent({
      sessionId,
      userId: req.user?.id || null,
      eventType,
      productId,
      variationId,
      cartItemCount: Number(cartItemCount) || 0,
    });

    return res.json({ success: true, data: { ok: true } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

