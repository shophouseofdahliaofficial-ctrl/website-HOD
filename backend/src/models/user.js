const { query } = require('../config/database');
const { transformUser } = require('../utils/transform');

/**
 * User Model
 * Handles all database operations for user profiles
 * Note: Authentication is handled by Supabase Auth
 * This model only manages user profile data (name, role, etc.)
 */

let schemaEnsured = false;

const USER_SELECT =
  'id, name, email, role, phone, date_of_birth, wedding_date, telegram_id, avatar_url, created_at, updated_at, lifetime_savings';

async function ensureUsersSchema() {
  if (schemaEnsured) return;
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_savings DECIMAL(10, 2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS wedding_date DATE;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(50) UNIQUE;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;`);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));`);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users (telegram_id);`);
  schemaEnsured = true;
}

function normalizeDateOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

/**
 * Create a user profile
 * Note: This only creates a profile record. User must be created via Supabase Auth first.
 * @param {Object} userData - User data (id, name, email, role, telegram_id, avatar_url)
 * @returns {Promise<Object>} Created user profile (camelCase format)
 */
const createUser = async (userData) => {
  const { id, name, email, role = 'customer', telegram_id = null, avatar_url = null } = userData;
  const normalizedEmail = normalizeEmail(email);
  await ensureUsersSchema();

  // Note: id should be the UUID from Supabase auth.users
  const result = await query(
    `INSERT INTO users (id, name, email, role, telegram_id, avatar_url, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET name = $2, email = $3, telegram_id = COALESCE(users.telegram_id, $5), avatar_url = COALESCE($6, users.avatar_url), updated_at = NOW()
     RETURNING ${USER_SELECT}`,
    [id, name, normalizedEmail, role, telegram_id, avatar_url]
  );

  return transformUser(result.rows[0]);
};

/**
 * Find user by email
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User object or null (camelCase format)
 */
const findByEmail = async (email) => {
  await ensureUsersSchema();
  const normalizedEmail = normalizeEmail(email);
  const result = await query(
    `SELECT ${USER_SELECT} FROM users WHERE LOWER(email) = $1 ORDER BY created_at ASC LIMIT 1`,
    [normalizedEmail]
  );

  return result.rows.length > 0 ? transformUser(result.rows[0]) : null;
};

/**
 * Find user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User object or null (camelCase format)
 */
const findById = async (userId) => {
  await ensureUsersSchema();
  const result = await query(
    `SELECT ${USER_SELECT} FROM users WHERE id = $1`,
    [userId]
  );

  return transformUser(result.rows[0] || null);
};

/**
 * Get all users (for admin)
 * @param {Object} options - Query options (limit, offset)
 * @returns {Promise<Array>} Array of users (camelCase format)
 */
const getAllUsers = async (options = {}) => {
  await ensureUsersSchema();
  const { limit = 100, offset = 0 } = options;

  const result = await query(
    `SELECT ${USER_SELECT}
     FROM users 
     ORDER BY created_at DESC 
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return result.rows.map(transformUser);
};

/**
 * Verify password
 * Note: Password verification is now handled by Supabase Auth
 * This function is kept for backward compatibility but should not be used
 * @deprecated Use Supabase Auth for password verification
 */
const verifyPassword = async (password, hashedPassword) => {
  // This should not be used anymore - Supabase handles password verification
  throw new Error('Password verification is handled by Supabase Auth. Use supabase.auth.signInWithPassword() instead.');
};

/**
 * Update user profile
 * Note: Password updates should be done via Supabase Auth API
 * @param {string} userId - User ID (UUID from Supabase)
 * @param {Object} updates - Fields to update (name, email, role)
 * @returns {Promise<Object>} Updated user (camelCase format)
 */
const updateUser = async (userId, updates) => {
  await ensureUsersSchema();
  const normalizedUpdates = { ...updates };
  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'email')) {
    normalizedUpdates.email = normalizeEmail(normalizedUpdates.email);
  }
  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'phone')) {
    const p = String(normalizedUpdates.phone || '').trim();
    normalizedUpdates.phone = p || null;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'date_of_birth')) {
    normalizedUpdates.date_of_birth = normalizeDateOrNull(normalizedUpdates.date_of_birth);
  }
  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'wedding_date')) {
    normalizedUpdates.wedding_date = normalizeDateOrNull(normalizedUpdates.wedding_date);
  }
  const fields = [];
  const values = [];
  let paramCount = 1;

  const allowedFields = ['name', 'email', 'role', 'phone', 'date_of_birth', 'wedding_date'];
  Object.keys(normalizedUpdates).forEach((key) => {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = $${paramCount}`);
      values.push(normalizedUpdates[key]);
      paramCount++;
    }
  });

  // Password updates should be done via Supabase Auth
  if (updates.password) {
    throw new Error('Password updates must be done via Supabase Auth API. Use supabase.auth.updateUser() instead.');
  }

  if (fields.length === 0) {
    // No valid fields to update, just return current user
    return await findById(userId);
  }

  fields.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await query(
    `UPDATE users 
     SET ${fields.join(', ')} 
     WHERE id = $${paramCount}
     RETURNING ${USER_SELECT}`,
    values
  );

  return transformUser(result.rows[0]);
};

/**
 * Update user's lifetime savings
 * @param {string} userId - User ID
 * @param {number} amount - Amount to add to lifetime savings
 * @returns {Promise<void>}
 */
const updateLifetimeSavings = async (userId, amount) => {
  await ensureUsersSchema();
  await query(
    'UPDATE users SET lifetime_savings = lifetime_savings + $1, updated_at = NOW() WHERE id = $2',
    [amount, userId]
  );
};

/**
 * Find user by Telegram ID
 * @param {string} telegramId - Telegram ID
 * @returns {Promise<Object|null>} User object or null (camelCase format)
 */
const findByTelegramId = async (telegramId) => {
  await ensureUsersSchema();
  const result = await query(
    `SELECT ${USER_SELECT} FROM users WHERE telegram_id = $1`,
    [telegramId]
  );

  return result.rows.length > 0 ? transformUser(result.rows[0]) : null;
};

module.exports = {
  createUser,
  findByEmail,
  findById,
  findByTelegramId,
  getAllUsers,
  verifyPassword,
  updateUser,
  updateLifetimeSavings,
  ensureUsersSchema,
  normalizeEmail,
};
