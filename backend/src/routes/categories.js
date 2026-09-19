const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

/**
 * Public category routes
 * Base path: /api/categories
 */
router.get('/', adminController.getAllCategories);

module.exports = router;
