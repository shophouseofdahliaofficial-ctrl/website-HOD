const express = require('express');
const { authenticate } = require('../middleware/auth');
const controller = require('../controllers/deliveryTrackingController');

const router = express.Router();

router.use(authenticate);

router.get('/deliveries', controller.getDeliveries);
router.post('/mark-delivered', controller.markDelivered);

module.exports = router;

