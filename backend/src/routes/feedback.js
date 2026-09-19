const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const generalFeedbackModel = require('../models/generalFeedback');

/**
 * Submit general website feedback
 * POST /api/feedback
 */
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { email, message } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!email || !message) {
      return res.status(400).json({ success: false, error: 'Email and message are required' });
    }

    const result = await generalFeedbackModel.submitFeedback({
      userId,
      email,
      message,
    });

    res.json({
      success: true,
      data: result,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
