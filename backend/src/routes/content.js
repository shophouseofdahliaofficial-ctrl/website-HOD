const express = require('express');
const router = express.Router();
const siteContentModel = require('../models/siteContent');

/**
 * Public Content Routes
 * Base path: /api/content
 * Public access to site content
 */

const COMING_SOON_DEFAULTS = {
  title: 'Scribble is coming soon!',
  content:
    "We're working behind the scenes to bring you 100% pure, chemical-free milk and dairy products.",
  metadata: { waitingCount: 0 },
};

const ensureComingSoonContent = async () => {
  let content = await siteContentModel.getContentByTypeAdmin('coming_soon');
  if (!content) {
    content = await siteContentModel.upsertContent('coming_soon', COMING_SOON_DEFAULTS);
  }
  return content;
};

/**
 * Increment the waiting/like counter for a content type (public)
 * POST /api/content/:type/increment-waiting
 */
router.post('/:type/increment-waiting', async (req, res, next) => {
  try {
    const { type } = req.params;

    if (type === 'coming_soon') {
      await ensureComingSoonContent();
    }

    let updated = await siteContentModel.incrementWaitingCount(type);

    if (!updated) {
      if (type === 'coming_soon') {
        await siteContentModel.upsertContent('coming_soon', COMING_SOON_DEFAULTS);
        updated = await siteContentModel.incrementWaitingCount(type);
      } else {
        return res.status(404).json({ success: false, error: 'Content not found' });
      }
    }

    if (!updated) {
      return res.status(500).json({ success: false, error: 'Failed to update waiting count' });
    }

    res.json({
      success: true,
      data: {
        success: true,
        waitingCount: Number(updated.metadata?.waitingCount || 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get content by type (public)
 * GET /api/content/:type
 * Special case: 'coming_soon' always returns (admin fetch) with enabled = isActive for middleware.
 */
router.get('/:type', async (req, res, next) => {
  try {
    const { type } = req.params;

    if (type === 'coming_soon') {
      const content = await ensureComingSoonContent();
      return res.json({
        success: true,
        data: { ...content, enabled: content.isActive },
      });
    }

    const content = await siteContentModel.getContentByType(type);

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found',
      });
    }

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
