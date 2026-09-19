const categoryModel = require('../models/category');
const { ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Category Service
 * Handles category business logic
 */

/**
 * Get all categories
 * @returns {Promise<Array>} Array of categories
 */
const getAllCategories = async () => {
  return await categoryModel.getAllCategories();
};

/**
 * Get category by ID
 * @param {string} categoryId - Category ID
 * @returns {Promise<Object>} Category object
 */
const getCategoryById = async (categoryId) => {
  const category = await categoryModel.getCategoryById(categoryId);
  if (!category) {
    throw new NotFoundError('Category');
  }
  return category;
};

/**
 * Create new category (admin only)
 * @param {Object} categoryData - Category data
 * @returns {Promise<Object>} Created category
 */
const createCategory = async (categoryData) => {
  const { name, description } = categoryData;

  // Validate required fields
  if (!name || !name.trim()) {
    throw new ValidationError('Category name is required');
  }

  return await categoryModel.createCategory({
    name: name.trim(),
    description: description?.trim() || null,
  });
};

/**
 * Update category (admin only)
 * @param {string} categoryId - Category ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated category
 */
const updateCategory = async (categoryId, updates) => {
  const category = await categoryModel.getCategoryById(categoryId);
  if (!category) {
    throw new NotFoundError('Category');
  }

  // Validate name if provided
  if (updates.name !== undefined && (!updates.name || !updates.name.trim())) {
    throw new ValidationError('Category name cannot be empty');
  }

  const updateData = {};
  if (updates.name !== undefined) {
    updateData.name = updates.name.trim();
  }
  if (updates.description !== undefined) {
    updateData.description = updates.description?.trim() || null;
  }

  return await categoryModel.updateCategory(categoryId, updateData);
};

/**
 * Delete category (admin only)
 * @param {string} categoryId - Category ID
 * @returns {Promise<Object>} Deleted category
 */
const deleteCategory = async (categoryId) => {
  const category = await categoryModel.getCategoryById(categoryId);
  if (!category) {
    throw new NotFoundError('Category');
  }

  return await categoryModel.deleteCategory(categoryId);
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
