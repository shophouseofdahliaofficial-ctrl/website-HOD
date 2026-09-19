const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', walletController.getWallet);
router.post('/topup', walletController.createTopupOrder);
router.post('/verify-topup', walletController.verifyTopup);

module.exports = router;

