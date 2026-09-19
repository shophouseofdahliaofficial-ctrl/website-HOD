const creatorModel = require('../models/creator');
const { ValidationError, NotFoundError } = require('../utils/errors');

const createCreator = async (req, res, next) => {
  try {
    const { name, slug, productIds, productsTitle } = req.body;
    if (!name || !slug) {
      throw new ValidationError('Name and slug are required');
    }
    const creator = await creatorModel.createCreator({
      name,
      slug,
      productIds: Array.isArray(productIds) ? productIds : [],
      productsTitle: productsTitle || 'Our Products'
    });
    res.json({ success: true, data: creator });
  } catch (error) {
    next(error);
  }
};

const getAllCreators = async (req, res, next) => {
  try {
    const creators = await creatorModel.getAllCreators();
    res.json({ success: true, data: creators });
  } catch (error) {
    next(error);
  }
};

const getCreatorBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const creator = await creatorModel.getCreatorBySlug(slug);
    if (!creator) {
      throw new NotFoundError('Creator');
    }
    res.json({ success: true, data: creator });
  } catch (error) {
    next(error);
  }
};

const updateCreator = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, slug, productIds, productsTitle } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (productIds !== undefined) updates.product_ids = Array.isArray(productIds) ? JSON.stringify(productIds) : '[]';
    if (productsTitle !== undefined) updates.products_title = productsTitle;

    const creator = await creatorModel.updateCreator(id, updates);
    if (!creator) {
      throw new NotFoundError('Creator');
    }
    res.json({ success: true, data: creator });
  } catch (error) {
    next(error);
  }
};

const deleteCreator = async (req, res, next) => {
  try {
    const { id } = req.params;
    const creator = await creatorModel.deleteCreator(id);
    if (!creator) {
      throw new NotFoundError('Creator');
    }
    res.json({ success: true, data: creator });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCreator,
  getAllCreators,
  getCreatorBySlug,
  updateCreator,
  deleteCreator
};
