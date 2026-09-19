const addressService = require('../services/addressService');

/**
 * Address Controller
 * Handles HTTP requests for address operations
 */

/**
 * Get all addresses for the current user
 * GET /api/addresses
 */
const getMyAddresses = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const addresses = await addressService.getUserAddresses(userId);
    res.json({ success: true, data: addresses });
  } catch (error) {
    next(error);
  }
};

/**
 * Get address by ID
 * GET /api/addresses/:id
 */
const getAddressById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const address = await addressService.getAddressById(id, userId);
    
    if (!address) {
      return res.status(404).json({
        success: false,
        error: 'Address not found',
      });
    }

    res.json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new address
 * POST /api/addresses
 */
const createAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const address = await addressService.createAddress(userId, req.body);
    res.status(201).json({
      success: true,
      data: address,
      message: 'Address created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an address
 * PUT /api/addresses/:id
 */
const updateAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const address = await addressService.updateAddress(id, userId, req.body);
    res.json({
      success: true,
      data: address,
      message: 'Address updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an address
 * DELETE /api/addresses/:id
 */
const deleteAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    await addressService.deleteAddress(id, userId);
    res.json({ success: true, message: 'Address deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
};
