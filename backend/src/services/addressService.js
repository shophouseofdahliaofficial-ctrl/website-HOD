const addressModel = require('../models/address');

const validateCoordinates = (addressData) => {
  if (addressData.latitude !== undefined && addressData.latitude !== null) {
    const latitude = Number(addressData.latitude);
    if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
  }
  if (addressData.longitude !== undefined && addressData.longitude !== null) {
    const longitude = Number(addressData.longitude);
    if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }
  }
};

/**
 * Address Service
 * Business logic for address operations
 */

/**
 * Get all addresses for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of addresses
 */
const getUserAddresses = async (userId) => {
  await addressModel.ensureAddressSchema();
  return await addressModel.getAddressesByUserId(userId);
};

/**
 * Get address by ID
 * @param {string} addressId - Address ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Address or null
 */
const getAddressById = async (addressId, userId) => {
  await addressModel.ensureAddressSchema();
  return await addressModel.getAddressById(addressId, userId);
};

/**
 * Create a new address
 * @param {string} userId - User ID
 * @param {Object} addressData - Address data
 * @returns {Promise<Object>} Created address
 */
const createAddress = async (userId, addressData) => {
  await addressModel.ensureAddressSchema();
  // Validate required fields
  if (!addressData.name || !addressData.street || !addressData.city || !addressData.state || !addressData.postalCode) {
    throw new Error('Missing required address fields');
  }

  // Allow any postal code format; deliverability is checked per-product during checkout/subscription.
  if (typeof addressData.postalCode === 'string') {
    addressData.postalCode = addressData.postalCode.trim();
  }
  if (!addressData.postalCode) {
    throw new Error('Postal code is required');
  }
  validateCoordinates(addressData);

  return await addressModel.createAddress(userId, addressData);
};

/**
 * Update an address
 * @param {string} addressId - Address ID
 * @param {string} userId - User ID
 * @param {Object} addressData - Updated address data
 * @returns {Promise<Object>} Updated address
 */
const updateAddress = async (addressId, userId, addressData) => {
  await addressModel.ensureAddressSchema();
  // Allow any postal code format; deliverability is checked per-product during checkout/subscription.
  if (typeof addressData.postalCode === 'string') {
    addressData.postalCode = addressData.postalCode.trim();
  }
  if (addressData.postalCode !== undefined && !addressData.postalCode) {
    throw new Error('Postal code cannot be empty');
  }
  validateCoordinates(addressData);

  const updated = await addressModel.updateAddress(addressId, userId, addressData);
  
  if (!updated) {
    throw new Error('Address not found');
  }

  return updated;
};

/**
 * Delete an address
 * @param {string} addressId - Address ID
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
const deleteAddress = async (addressId, userId) => {
  const deleted = await addressModel.deleteAddress(addressId, userId);
  
  if (!deleted) {
    throw new Error('Address not found');
  }
};

module.exports = {
  getUserAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
};
