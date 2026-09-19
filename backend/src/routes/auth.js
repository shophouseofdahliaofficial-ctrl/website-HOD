const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

/**
 * Auth Routes
 * Base path: /api/auth
 */

// Public routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/exchange-token', authController.exchangeToken);
router.post('/check-email', authController.checkEmail);
router.post('/telegram', authController.telegramLogin);
router.get('/telegram/config', (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return res.status(500).json({ success: false, error: 'Telegram Bot Token is not configured on the server' });
  }
  const botId = botToken.split(':')[0];
  return res.json({ success: true, botId });
});

// Protected routes
router.get('/me', authenticate, authController.getCurrentUser);
router.patch('/profile', authenticate, authController.updateProfile);
router.post('/change-password', authenticate, authController.changePassword);

// Public route to verify admin password (used by Coming Soon and Admin Password Gate)
router.post('/verify-admin-password', (req, res) => {
  const { password } = req.body;
  const adminPanelPassword = process.env.ADMIN_PANEL_PASSWORD || '2316';
  
  if (password && password.trim() === adminPanelPassword.trim()) {
    return res.json({ success: true, data: { verified: true } });
  } else {
    return res.status(401).json({ success: false, error: 'Incorrect password' });
  }
});

module.exports = router;

