const productService = require('../services/productService');

/**
 * Product Controller
 * Handles product HTTP requests
 */

/**
 * Get all active products (customer view)
 * GET /api/products
 */
const getActiveProducts = async (req, res, next) => {
  try {
    const products = await productService.getActiveProducts();

    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get product by ID
 * GET /api/products/:id?details=true (optional - includes images, variations, reviews)
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const includeDetails = req.query.details === 'true';
    const product = await productService.getProductById(id, includeDetails);

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveProducts,
  getProductById,
};

