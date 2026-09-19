const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

/**
 * Product Routes (Customer)
 * Base path: /api/products
 */

// Public routes (no authentication required for browsing)
router.get('/', productController.getActiveProducts);
router.get('/:id', productController.getProductById);

module.exports = router;

