const { query } = require('../config/database');

/**
 * Address Model
 * Handles all database operations for user addresses
 */

/**
 * Transform address row from database to API format
 * @param {Object} row - Database row with snake_case
 * @returns {Object} API format with camelCase
 */
const transformAddress = (row) => {
  if (!row) return null;

  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: row.name,
    street: row.street,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    phone: row.phone || undefined,
    latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : undefined,
    longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : undefined,
    isDefault: row.is_default || false,
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };
};

const ensureAddressSchema = async () => {
  await query(`
    ALTER TABLE addresses
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION
  `);
};

/**
 * Get all addresses for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of addresses (camelCase format)
 */
const getAddressesByUserId = async (userId) => {
  const result = await query(
    `SELECT * FROM addresses 
     WHERE user_id = $1 
     ORDER BY is_default DESC, created_at DESC`,
    [userId]
  );

  return result.rows.map(transformAddress);
};

/**
 * Get address by ID
 * @param {string} addressId - Address ID
 * @param {string} userId - User ID (for security check)
 * @returns {Promise<Object|null>} Address object or null (camelCase format)
 */
const getAddressById = async (addressId, userId) => {
  const result = await query(
    `SELECT * FROM addresses 
     WHERE id = $1 AND user_id = $2`,
    [addressId, userId]
  );

  return transformAddress(result.rows[0] || null);
};

/**
 * Create a new address
 * @param {string} userId - User ID
 * @param {Object} addressData - Address data
 * @returns {Promise<Object>} Created address (camelCase format)
 */
const createAddress = async (userId, addressData) => {
  const {
    name,
    street,
    city,
    state,
    postalCode,
    country = 'India',
    phone,
    latitude,
    longitude,
    isDefault = false,
  } = addressData;

  // If this is set as default, unset other defaults for this user
  if (isDefault) {
    await query(
      `UPDATE addresses 
       SET is_default = false 
       WHERE user_id = $1`,
      [userId]
    );
  }

  const result = await query(
    `INSERT INTO addresses (user_id, name, street, city, state, postal_code, country, phone, latitude, longitude, is_default, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
     RETURNING *`,
    [userId, name, street, city, state, postalCode, country, phone || null, latitude ?? null, longitude ?? null, isDefault]
  );

  return transformAddress(result.rows[0]);
};

/**
 * Update an address
 * @param {string} addressId - Address ID
 * @param {string} userId - User ID (for security check)
 * @param {Object} addressData - Updated address data
 * @returns {Promise<Object>} Updated address (camelCase format)
 */
const updateAddress = async (addressId, userId, addressData) => {
  const {
    name,
    street,
    city,
    state,
    postalCode,
    country,
    phone,
    latitude,
    longitude,
    isDefault,
  } = addressData;

  // If this is set as default, unset other defaults for this user
  if (isDefault) {
    await query(
      `UPDATE addresses 
       SET is_default = false 
       WHERE user_id = $1 AND id != $2`,
      [userId, addressId]
    );
  }

  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(name);
  }
  if (street !== undefined) {
    updates.push(`street = $${paramIndex++}`);
    values.push(street);
  }
  if (city !== undefined) {
    updates.push(`city = $${paramIndex++}`);
    values.push(city);
  }
  if (state !== undefined) {
    updates.push(`state = $${paramIndex++}`);
    values.push(state);
  }
  if (postalCode !== undefined) {
    updates.push(`postal_code = $${paramIndex++}`);
    values.push(postalCode);
  }
  if (country !== undefined) {
    updates.push(`country = $${paramIndex++}`);
    values.push(country);
  }
  if (phone !== undefined) {
    updates.push(`phone = $${paramIndex++}`);
    values.push(phone || null);
  }
  if (latitude !== undefined) {
    updates.push(`latitude = $${paramIndex++}`);
    values.push(latitude === null ? null : Number(latitude));
  }
  if (longitude !== undefined) {
    updates.push(`longitude = $${paramIndex++}`);
    values.push(longitude === null ? null : Number(longitude));
  }
  if (isDefault !== undefined) {
    updates.push(`is_default = $${paramIndex++}`);
    values.push(isDefault);
  }

  if (updates.length === 0) {
    return getAddressById(addressId, userId);
  }

  values.push(addressId, userId);

  const result = await query(
    `UPDATE addresses 
     SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return transformAddress(result.rows[0]);
};

/**
 * Delete an address
 * @param {string} addressId - Address ID
 * @param {string} userId - User ID (for security check)
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
const deleteAddress = async (addressId, userId) => {
  const result = await query(
    `DELETE FROM addresses 
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [addressId, userId]
  );

  return result.rows.length > 0;
};

module.exports = {
  ensureAddressSchema,
  getAddressesByUserId,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
};
