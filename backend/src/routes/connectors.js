const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const connectorController = require('../controllers/connectorController');

// All connector routes require authentication
router.use(authenticate);

// Exchange authorization code for refresh token
router.post('/google/exchange', connectorController.exchangeCode);

// Get a fresh access token using stored refresh token
router.get('/google/token', connectorController.getAccessToken);

// Disconnect (remove stored refresh token)
router.delete('/google/disconnect', connectorController.disconnect);

// Get connection status for current user
router.get('/google/status', connectorController.getStatus);

// Google Photos Picker session endpoints
router.post('/google/photos/session', connectorController.createPhotosSession);
router.get('/google/photos/session/:sessionId', connectorController.pollPhotosSession);
router.get('/google/photos/proxy', connectorController.proxyPhoto);

module.exports = router;
