const express = require('express');
const router = express.Router();
const exchangeController = require('../controllers/exchangeController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Customer Exchange Endpoints
router.post('/', exchangeController.requestExchange);
router.get('/order/:orderId', exchangeController.getExchangeForOrder);
router.post('/payment-order', exchangeController.createPaymentOrder);
router.post('/settle', exchangeController.settleOrPay);

module.exports = router;
