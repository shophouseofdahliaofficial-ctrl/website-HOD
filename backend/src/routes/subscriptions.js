const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authenticate } = require('../middleware/auth');

/**
 * Subscription Routes (Customer)
 * Base path: /api/subscriptions
 * All routes require authentication
 */

router.use(authenticate); // All routes require authentication

router.get('/', subscriptionController.getMySubscriptions);
router.post('/trial-pack/estimate', subscriptionController.estimateTrialPack);
router.post('/trial-pack', subscriptionController.createTrialPack);
router.post('/trial-pack/verify-payment', subscriptionController.verifyTrialPackPayment);
router.post('/verify-payment', subscriptionController.verifyPayment);
router.get('/:id', subscriptionController.getSubscriptionById);
router.post('/', subscriptionController.createSubscription);
router.post('/:id/pause', subscriptionController.pauseSubscription);
router.post('/:id/resume', subscriptionController.resumeSubscription);
router.post('/:id/cancel', subscriptionController.cancelSubscription);
router.post('/:id/cancel-today', subscriptionController.cancelTodaysDelivery);
router.post('/:id/setup-autopay', subscriptionController.setupAutoPay);
router.post('/:id/verify-autopay-setup', subscriptionController.verifyAutopaySetup);
router.post('/:id/remove-autopay', subscriptionController.removeAutoPay);
router.post('/:id/renew-init', subscriptionController.renewExpiredInit);
router.post('/:id/renew-verify', subscriptionController.renewExpiredVerify);

module.exports = router;
