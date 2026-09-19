const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { authenticate } = require('../middleware/auth');

/**
 * Address Routes
 * All routes require authentication
 */

// Get all addresses for current user
router.get('/', authenticate, addressController.getMyAddresses);

// Get address by ID
router.get('/:id', authenticate, addressController.getAddressById);

// Create new address
router.post('/', authenticate, addressController.createAddress);

// Update address
router.put('/:id', authenticate, addressController.updateAddress);

// Delete address
router.delete('/:id', authenticate, addressController.deleteAddress);

module.exports = router;
