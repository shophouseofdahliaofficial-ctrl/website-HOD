const photoboothProjectModel = require('../models/photoboothProject');
const photoboothProjectService = require('../services/photoboothProjectService');
const { ValidationError } = require('../utils/errors');

const getConfig = async (req, res, next) => {
  try {
    await photoboothProjectModel.ensurePhotoboothSchema();
    const polaroidProductId = await photoboothProjectModel.getPhotoboothProductId('polaroid');
    const stripProductId = await photoboothProjectModel.getPhotoboothProductId('strip');
    res.json({
      success: true,
      data: {
        productId: polaroidProductId,
        polaroidProductId,
        stripProductId,
        pricePerPolaroid: photoboothProjectModel.PHOTOBOOTH_PRICE_PER_UNIT,
        deliveryFee: photoboothProjectModel.PHOTOBOOTH_DELIVERY_FEE,
      },
    });
  } catch (error) {
    next(error);
  }
};

const createProject = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('Authentication required');

    const {
      projectId,
      projectType,
      projectJson,
      quantity,
    } = req.body || {};

    const pdfBuffer = req.file?.buffer;

    const project = await photoboothProjectService.createProjectFromPayload({
      userId,
      projectId,
      projectType,
      projectJson,
      quantity,
      pdfBuffer,
    });

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

const getMyProjects = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('Authentication required');
    const rows = await photoboothProjectModel.getProjectsByUser(userId);
    res.json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        projectType: row.project_type,
        previewUrl: row.preview_url,
        generatedPdfUrl: row.generated_pdf_url,
        quantity: row.quantity,
        price: parseFloat(row.price),
        status: row.status,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
};

const getProject = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const row = await photoboothProjectModel.getProjectById(id, userId);
    if (!row) throw new ValidationError('Project not found');
    res.json({
      success: true,
      data: {
        id: row.id,
        projectType: row.project_type,
        projectJson: row.project_json,
        previewUrl: row.preview_url,
        generatedPdfUrl: row.generated_pdf_url,
        quantity: row.quantity,
        price: parseFloat(row.price),
        status: row.status,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const deleted = await photoboothProjectModel.deleteProject(id, userId);
    if (!deleted) throw new ValidationError('Project not found');
    res.json({ success: true, data: { id: deleted.id } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConfig,
  createProject,
  getMyProjects,
  getProject,
  deleteProject,
};
