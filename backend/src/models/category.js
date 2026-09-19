const { query } = require('../config/database');

/**
 * Category Model
 * Handles all database operations for product categories
 */

/**
 * Create a new category
 * @param {Object} categoryData - Category data
 * @returns {Promise<Object>} Created category
 */
const createCategory = async (categoryData) => {
  const { name, description } = categoryData;

  const result = await query(
    `INSERT INTO categories (name, description, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     RETURNING *`,
    [name, description || null]
  );

  return {
    id: result.rows[0].id.toString(),
    name: result.rows[0].name,
    description: result.rows[0].description,
    createdAt: result.rows[0].created_at.toISOString(),
    updatedAt: result.rows[0].updated_at.toISOString(),
  };
};

/**
 * Get all categories
 * @returns {Promise<Array>} Array of categories
 */
const getAllCategories = async () => {
  const result = await query(
    'SELECT * FROM categories ORDER BY name ASC'
  );

  return result.rows.map(row => ({
    id: row.id.toString(),
    name: row.name,
    description: row.description,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
};

/**
 * Get category by ID
 * @param {string} categoryId - Category ID
 * @returns {Promise<Object|null>} Category object or null
 */
const getCategoryById = async (categoryId) => {
  const result = await query(
    'SELECT * FROM categories WHERE id = $1',
    [categoryId]
  );

  if (!result.rows[0]) return null;

  const row = result.rows[0];
  return {
    id: row.id.toString(),
    name: row.name,
    description: row.description,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
};

/**
 * Update category
 * @param {string} categoryId - Category ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated category
 */
const updateCategory = async (categoryId, updates) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(updates).forEach((key) => {
    fields.push(`${key} = $${paramCount}`);
    values.push(updates[key]);
    paramCount++;
  });

  fields.push(`updated_at = NOW()`);
  values.push(categoryId);

  const result = await query(
    `UPDATE categories 
     SET ${fields.join(', ')} 
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );

  if (!result.rows[0]) return null;

  const row = result.rows[0];
  return {
    id: row.id.toString(),
    name: row.name,
    description: row.description,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
};

/**
 * Delete category
 * @param {string} categoryId - Category ID
 * @returns {Promise<Object>} Deleted category
 */
const deleteCategory = async (categoryId) => {
  const result = await query(
    'DELETE FROM categories WHERE id = $1 RETURNING *',
    [categoryId]
  );

  if (!result.rows[0]) return null;

  const row = result.rows[0];
  return {
    id: row.id.toString(),
    name: row.name,
    description: row.description,
  };
};

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
