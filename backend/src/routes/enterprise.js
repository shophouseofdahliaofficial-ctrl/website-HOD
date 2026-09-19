const express = require('express');
const router = express.Router();
const enterpriseController = require('../controllers/enterpriseController');

/**
 * Enterprise routes
 * Base path: /api/enterprise
 */

// Public route to submit an enterprise inquiry
router.post('/inquiry', enterpriseController.submitInquiry);

module.exports = router;
