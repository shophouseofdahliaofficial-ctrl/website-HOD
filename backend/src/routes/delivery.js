const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');

// Public pincode serviceability check
router.get('/check-pincode', deliveryController.checkPincode);
router.post('/check-pincode', deliveryController.checkPincode);

module.exports = router;
