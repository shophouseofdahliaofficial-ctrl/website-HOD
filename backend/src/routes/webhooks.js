const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

/**
 * Webhook Routes
 * Base path: /api/webhooks
 * These routes are public (called by external services)
 * Security is handled via signature verification
 */

// Razorpay webhook
// Note: This route should NOT use body-parser JSON middleware
// Razorpay requires raw body for signature verification
router.post(
  '/razorpay',
  express.raw({ type: 'application/json' }),
  webhookController.handleRazorpayWebhook
);

// Shiprocket webhook (Named logistics-update because Shiprocket forbids 'shiprocket' in URL)
// Requires json body parsing, assuming the main app uses express.json() before this router or we can add it here.
router.post(
  '/logistics-update',
  express.json(),
  webhookController.handleShiprocketWebhook
);

// Delhivery webhook for automated tracking updates
router.post(
  '/delhivery',
  express.json(),
  webhookController.handleDelhiveryWebhook
);

module.exports = router;

