const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const generalFeedbackModel = require('../models/generalFeedback');
const emailService = require('../services/emailService');

/**
 * Submit general website feedback / contact inquiries
 * POST /api/feedback
 */
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { email, message, name, topic, subject } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!email || !message) {
      return res.status(400).json({ success: false, error: 'Email and message are required' });
    }

    // Save to database
    const result = await generalFeedbackModel.submitFeedback({
      userId,
      email,
      message,
      feedbackType: topic || 'contact_inquiry',
    });

    // Send email notification to contact@houseofdahlia.in asynchronously
    emailService.sendContactInquiry({
      name: name || req.user?.name,
      email,
      topic: topic || 'General Inquiry',
      subject: subject || 'New Website Inquiry',
      message,
    }).catch(err => {
      console.error('[Feedback Route] Email notification error:', err);
    });

    res.json({
      success: true,
      data: result,
      message: 'Inquiry submitted and dispatched successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
