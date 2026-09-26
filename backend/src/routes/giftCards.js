const express = require('express');
const router = express.Router();
const giftCardController = require('../controllers/giftCardController');
const { authenticate, optionalAuth } = require('../middleware/auth');

router.post('/create', optionalAuth, giftCardController.createGiftCard);
router.post('/redeem', authenticate, giftCardController.redeemGiftCard);
router.get('/history', optionalAuth, giftCardController.getHistory);

module.exports = router;
