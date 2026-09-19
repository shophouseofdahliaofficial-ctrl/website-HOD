const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');

/**
 * Orders Routes
 * Base path: /api/orders
 */

router.use(authenticate);

router.get('/', orderController.getMyOrders);
router.get('/:id', orderController.getOrderById);
router.get('/:id/invoice', orderController.getOrderInvoice);
router.post('/:id/feedback', orderController.submitFeedback);
router.post('/:id/detailed-feedback', orderController.submitDetailedFeedback);
router.post('/verify-payment', orderController.verifyPayment);
router.post('/checkout-fees', orderController.getCheckoutFees);
router.post('/', orderController.createOrder);

module.exports = router;

