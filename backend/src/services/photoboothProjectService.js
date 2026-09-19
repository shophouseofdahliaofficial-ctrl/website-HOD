const crypto = require('crypto');
const photoboothProjectModel = require('../models/photoboothProject');
const bunnyStorage = require('./bunnyStorage');
const { ValidationError } = require('../utils/errors');

function parseProjectJson(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    throw new ValidationError('Invalid project JSON');
  }
}

/**
 * Create a photobooth project: upload print PDF to Bunny, persist metadata in Postgres.
 */
async function createProjectFromPayload({
  userId,
  projectId,
  projectType,
  projectJson,
  quantity,
  pdfBuffer,
}) {
  if (!userId) throw new ValidationError('User is required');
  if (!projectType || !['polaroid', 'strip'].includes(projectType)) {
    throw new ValidationError('Invalid project type');
  }
  const qty = parseInt(String(quantity), 10);
  if (!qty || qty < 1) throw new ValidationError('Invalid quantity');

  if (!bunnyStorage.isBunnyConfigured()) {
    throw new ValidationError('File storage is not configured. Please contact support.');
  }

  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new ValidationError('Print PDF is required');
  }

  const id = projectId || crypto.randomUUID();
  const basePath = `users/${userId}/projects/${id}`;
  const assetPaths = [];

  const pdfPath = `${basePath}/print.pdf`;
  const pdfUploaded = await bunnyStorage.uploadBufferIfMissing(pdfPath, pdfBuffer, 'application/pdf');
  const generatedPdfUrl = pdfUploaded.url;
  assetPaths.push({ type: 'pdf', path: pdfUploaded.path, url: pdfUploaded.url, skipped: pdfUploaded.skipped });

  const price = photoboothProjectModel.calculatePhotoboothPrice(qty);
  const parsedJson = parseProjectJson(projectJson);
  parsedJson.generatedPdfUrl = generatedPdfUrl;

  const row = await photoboothProjectModel.createProject({
    id,
    userId,
    projectType,
    projectJson: parsedJson,
    previewUrl: null,
    generatedPdfUrl,
    quantity: qty,
    price,
    assetPaths,
    status: 'cart',
  });

  return {
    id: row.id,
    userId: row.user_id,
    projectType: row.project_type,
    projectJson: row.project_json,
    previewUrl: row.preview_url,
    generatedPdfUrl: row.generated_pdf_url,
    quantity: row.quantity,
    price: parseFloat(row.price),
    createdAt: row.created_at,
    productId: await photoboothProjectModel.getPhotoboothProductId(projectType),
  };
}

module.exports = {
  createProjectFromPayload,
  parseProjectJson,
};
