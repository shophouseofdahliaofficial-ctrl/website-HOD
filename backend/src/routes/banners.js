const express = require('express');
const router = express.Router();
const bannerService = require('../services/bannerService');

/**
 * Public Banner Routes
 * Base path: /api/banners
 * Public endpoints for fetching banners
 */

/**
 * Get all active banners (for homepage)
 * GET /api/banners
 */
router.get('/', async (req, res, next) => {
  try {
    const banners = await bannerService.getActiveBanners();

    res.json({
      success: true,
      data: banners,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;



