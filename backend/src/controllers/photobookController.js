const photobookProjectModel = require('../models/photobookProject');
const photobookProjectService = require('../services/photobookProjectService');
const photobookAssetCleanup = require('../services/photobookAssetCleanup');
const photobookEditorFeedbackModel = require('../models/photobookEditorFeedback');
const { query } = require('../config/database');
const { ValidationError } = require('../utils/errors');

const listProjects = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('Authentication required');

    const rows = await photobookProjectModel.getProjectsByUser(userId);
    const productIds = [...new Set(rows.map((r) => r.product_id))];
    let productNames = {};
    if (productIds.length > 0) {
      const prodRes = await query(
        `SELECT id, name FROM products WHERE id = ANY($1::int[])`,
        [productIds],
      );
      productNames = Object.fromEntries(prodRes.rows.map((p) => [p.id, p.name]));
    }

    res.json({
      success: true,
      data: rows.map((row) => photobookProjectService.mapRow(row, productNames[row.product_id])),
    });
  } catch (error) {
    next(error);
  }
};

const getProject = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const row = await photobookProjectModel.getProjectById(id, userId);
    if (!row) throw new ValidationError('Project not found');

    if (row.status !== 'purchased' && !row.is_locked) {
      const expiresAt = new Date(Date.now() + photobookProjectModel.DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      await query(
        `UPDATE photobook_projects 
         SET last_edited_at = NOW(), expires_at = $1, updated_at = NOW() 
         WHERE id = $2 AND user_id = $3`,
        [expiresAt, id, userId]
      );
      row.last_edited_at = new Date();
      row.expires_at = expiresAt;
    }

    const prodRes = await query(`SELECT name FROM products WHERE id = $1 LIMIT 1`, [row.product_id]);
    res.json({
      success: true,
      data: photobookProjectService.mapRow(row, prodRes.rows[0]?.name),
    });
  } catch (error) {
    next(error);
  }
};

const saveProject = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('Authentication required');

    const {
      projectId,
      productId,
      variationId,
      projectName,
      projectJson,
      quantity,
      price,
      pageCount,
      status,
    } = req.body || {};

    const previewBuffer = req.files?.preview?.[0]?.buffer || req.file?.buffer;
    const previewContentType = req.files?.preview?.[0]?.mimetype || req.file?.mimetype;

    let resolvedProductId = parseInt(String(productId), 10);
    if (projectId && !resolvedProductId) {
      const existing = await photobookProjectModel.getProjectById(projectId, userId);
      if (existing) resolvedProductId = existing.product_id;
    }

    const project = await photobookProjectService.saveProject({
      userId,
      projectId,
      productId: resolvedProductId,
      variationId: variationId ? parseInt(String(variationId), 10) : null,
      projectName,
      projectJson,
      quantity: quantity ? parseInt(String(quantity), 10) : 1,
      price: price != null ? parseFloat(String(price)) : null,
      pageCount: pageCount ? parseInt(String(pageCount), 10) : 0,
      status,
      previewBuffer,
      previewContentType,
    });

    res.status(projectId ? 200 : 201).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

const uploadImage = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id: projectId } = req.params;
    const { imageId } = req.body || {};
    const file = req.file;

    if (!userId) throw new ValidationError('Authentication required');
    if (!projectId) throw new ValidationError('Project is required');
    if (!imageId) throw new ValidationError('imageId is required');
    if (!file?.buffer) throw new ValidationError('Image file is required');

    const existing = await photobookProjectModel.getProjectById(projectId, userId);
    if (!existing) throw new ValidationError('Project not found');
    if (existing.is_locked) throw new ValidationError('This design has been purchased and can no longer be edited');

    const uploaded = await photobookProjectService.uploadCustomerImage({
      userId,
      projectId,
      imageId: String(imageId),
      buffer: file.buffer,
      contentType: file.mimetype || 'image/jpeg',
      originalName: file.originalname,
    });

    await photobookProjectService.addImageAssetToProject(userId, projectId, uploaded);

    res.json({ success: true, data: uploaded });
  } catch (error) {
    next(error);
  }
};

const addToCart = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const row = await photobookProjectModel.getProjectById(id, userId);
    if (!row) throw new ValidationError('Project not found');
    if (row.is_locked) throw new ValidationError('This design has been purchased and can no longer be edited');

    const updated = await photobookProjectModel.markProjectCart(id, userId);
    res.json({ success: true, data: photobookProjectService.mapRow(updated) });
  } catch (error) {
    next(error);
  }
};

const finalizeProject = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id: projectId } = req.params;
    const pdfBuffer = req.file?.buffer;

    const project = await photobookProjectService.finalizeWithPdf({
      userId,
      projectId,
      pdfBuffer,
    });

    res.json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const project = await photobookProjectModel.getProjectById(id, userId);
    if (!project || project.status === 'purchased') {
      throw new ValidationError('Project not found or cannot be deleted');
    }

    await photobookAssetCleanup.deleteProjectAssets(project);
    const deleted = await photobookProjectModel.deleteProject(id, userId);
    if (!deleted) throw new ValidationError('Project not found or cannot be deleted');
    res.json({ success: true, data: { id: deleted.id } });
  } catch (error) {
    next(error);
  }
};

const submitEditorFeedback = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const { productId, projectId, issueType, rating, message } = req.body || {};

    const row = await photobookEditorFeedbackModel.submitFeedback({
      userId,
      productId,
      projectId,
      issueType,
      rating,
      message,
    });

    res.status(201).json({
      success: true,
      data: row,
      message: 'Feedback submitted',
    });
  } catch (error) {
    if (error.message === 'Invalid issue type' || error.message === 'Rating must be between 1 and 5') {
      return next(new ValidationError(error.message));
    }
    next(error);
  }
};

module.exports = {
  listProjects,
  getProject,
  saveProject,
  uploadImage,
  addToCart,
  finalizeProject,
  deleteProject,
  submitEditorFeedback,
};
