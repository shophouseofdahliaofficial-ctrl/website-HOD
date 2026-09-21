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
    name: row.name || row.type || 'Home',
    street: row.street || row.street_address || '',
    city: row.city || '',
    state: row.state || '',
    postalCode: row.postal_code || '',
    country: row.country || 'India',
    phone: row.phone || undefined,
    latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : undefined,
    longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : undefined,
    isDefault: row.is_default || false,
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };
};

let schemaEnsured = false;

const ensureAddressSchema = async () => {
  if (schemaEnsured) return;
  try {
    // 1. Ensure table exists
    await query(`
      CREATE TABLE IF NOT EXISTS addresses (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        name VARCHAR(255) DEFAULT '',
        type VARCHAR(50) DEFAULT 'home',
        street VARCHAR(500) DEFAULT '',
        street_address TEXT DEFAULT '',
        apartment_suite VARCHAR(100),
        city VARCHAR(255) DEFAULT '',
        state VARCHAR(255) DEFAULT '',
        postal_code VARCHAR(20) DEFAULT '',
        country VARCHAR(100) DEFAULT 'India',
        phone VARCHAR(20),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Ensure all columns exist in case table was created with an older or partial schema
    await query(`
      ALTER TABLE addresses
      ADD COLUMN IF NOT EXISTS user_id UUID,
      ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'home',
      ADD COLUMN IF NOT EXISTS street VARCHAR(500) DEFAULT '',
      ADD COLUMN IF NOT EXISTS street_address TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS apartment_suite VARCHAR(100),
      ADD COLUMN IF NOT EXISTS city VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS state VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India',
      ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    // 3. Relax not-null constraints from legacy table schemas
    await query(`
      ALTER TABLE addresses ALTER COLUMN street_address DROP NOT NULL;
      ALTER TABLE addresses ALTER COLUMN street_address SET DEFAULT '';
      ALTER TABLE addresses ALTER COLUMN street DROP NOT NULL;
      ALTER TABLE addresses ALTER COLUMN street SET DEFAULT '';
      ALTER TABLE addresses ALTER COLUMN city DROP NOT NULL;
      ALTER TABLE addresses ALTER COLUMN city SET DEFAULT '';
      ALTER TABLE addresses ALTER COLUMN state DROP NOT NULL;
      ALTER TABLE addresses ALTER COLUMN state SET DEFAULT '';
      ALTER TABLE addresses ALTER COLUMN postal_code DROP NOT NULL;
      ALTER TABLE addresses ALTER COLUMN postal_code SET DEFAULT '';
      ALTER TABLE addresses ALTER COLUMN country DROP NOT NULL;
      ALTER TABLE addresses ALTER COLUMN country SET DEFAULT 'India';
      ALTER TABLE addresses ALTER COLUMN type DROP NOT NULL;
      ALTER TABLE addresses ALTER COLUMN type SET DEFAULT 'home';
      ALTER TABLE addresses ALTER COLUMN is_default DROP NOT NULL;
      ALTER TABLE addresses ALTER COLUMN is_default SET DEFAULT false;
    `);

    // 4. Sync columns if one exists and the other is empty
    await query(`
      UPDATE addresses 
      SET street_address = COALESCE(NULLIF(street_address, ''), street, '') 
      WHERE street_address IS NULL OR street_address = '';

      UPDATE addresses 
      SET street = COALESCE(NULLIF(street, ''), street_address, '') 
      WHERE street IS NULL OR street = '';

      UPDATE addresses 
      SET name = COALESCE(NULLIF(name, ''), type, 'Home') 
      WHERE name IS NULL OR name = '';
    `);

    // 5. Fallback for legacy columns like 'label'
    await query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'addresses' AND column_name = 'label'
        ) THEN
          UPDATE addresses SET name = label WHERE (name IS NULL OR name = '') AND label IS NOT NULL;
        END IF;
      END $$;
    `);

    // 6. Ensure indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_addresses_default ON addresses(user_id, is_default) WHERE is_default = true;`);

    schemaEnsured = true;
  } catch (error) {
    console.warn('[milko-backend] ensureAddressSchema error:', error.message);
  }
};

/**
 * Get all addresses for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of addresses (camelCase format)
 */
const getAddressesByUserId = async (userId) => {
  await ensureAddressSchema();
  const result = await query(
    `SELECT * FROM addresses 
     WHERE user_id::text = $1::text 
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
  await ensureAddressSchema();
  const result = await query(
    `SELECT * FROM addresses 
     WHERE id::text = $1::text AND user_id::text = $2::text`,
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
  await ensureAddressSchema();
  const {
    name = 'Home',
    street = '',
    city = '',
    state = '',
    postalCode = '',
    country = 'India',
    phone,
    latitude,
    longitude,
    isDefault = false,
  } = addressData;

  const addrName = String(name || 'Home').trim() || 'Home';
  const addrStreet = String(street || '').trim();

  // If this is set as default, unset other defaults for this user
  if (isDefault) {
    await query(
      `UPDATE addresses 
       SET is_default = false 
       WHERE user_id::text = $1::text`,
      [userId]
    );
  }

  const result = await query(
    `INSERT INTO addresses (user_id, name, type, street, street_address, city, state, postal_code, country, phone, latitude, longitude, is_default, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
     RETURNING *`,
    [userId, addrName, addrName, addrStreet, addrStreet, city, state, postalCode, country, phone || null, latitude ?? null, longitude ?? null, isDefault]
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
  await ensureAddressSchema();
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
       WHERE user_id::text = $1::text AND id::text != $2::text`,
      [userId, String(addressId)]
    );
  }

  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (name !== undefined) {
    const val = String(name || 'Home').trim() || 'Home';
    updates.push(`name = $${paramIndex++}::varchar`);
    updates.push(`type = $${paramIndex++}::varchar`);
    values.push(val, val);
  }
  if (street !== undefined) {
    const val = String(street || '').trim();
    updates.push(`street = $${paramIndex++}::varchar`);
    updates.push(`street_address = $${paramIndex++}::text`);
    values.push(val, val);
  }
  if (city !== undefined) {
    updates.push(`city = $${paramIndex++}::varchar`);
    values.push(String(city || ''));
  }
  if (state !== undefined) {
    updates.push(`state = $${paramIndex++}::varchar`);
    values.push(String(state || ''));
  }
  if (postalCode !== undefined) {
    updates.push(`postal_code = $${paramIndex++}::varchar`);
    values.push(String(postalCode || ''));
  }
  if (country !== undefined) {
    updates.push(`country = $${paramIndex++}::varchar`);
    values.push(String(country || 'India'));
  }
  if (phone !== undefined) {
    updates.push(`phone = $${paramIndex++}::varchar`);
    values.push(phone ? String(phone) : null);
  }
  if (latitude !== undefined) {
    updates.push(`latitude = $${paramIndex++}::double precision`);
    values.push(latitude === null || latitude === undefined || latitude === '' ? null : Number(latitude));
  }
  if (longitude !== undefined) {
    updates.push(`longitude = $${paramIndex++}::double precision`);
    values.push(longitude === null || longitude === undefined || longitude === '' ? null : Number(longitude));
  }
  if (isDefault !== undefined) {
    updates.push(`is_default = $${paramIndex++}::boolean`);
    values.push(Boolean(isDefault));
  }

  if (updates.length === 0) {
    return getAddressById(addressId, userId);
  }

  values.push(String(addressId), String(userId));

  const result = await query(
    `UPDATE addresses 
     SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id::text = $${paramIndex++}::text AND user_id::text = $${paramIndex++}::text
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
  await ensureAddressSchema();
  const result = await query(
    `DELETE FROM addresses 
     WHERE id::text = $1::text AND user_id::text = $2::text
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
