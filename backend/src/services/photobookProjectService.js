const crypto = require('crypto');
const path = require('path');
const photobookProjectModel = require('../models/photobookProject');
const bunnyStorage = require('./bunnyStorage');
const { ValidationError } = require('../utils/errors');

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 120 * 1024 * 1024;

function parseProjectJson(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    throw new ValidationError('Invalid project JSON');
  }
}

function assertNoBase64InJson(obj, pathPrefix = '') {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => assertNoBase64InJson(item, `${pathPrefix}[${i}]`));
    return;
  }
  for (const [key, value] of Object.entries(obj)) {
    const p = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (typeof value === 'string' && value.startsWith('data:')) {
      throw new ValidationError(`Project JSON must not contain base64 images (${p})`);
    }
    if (value && typeof value === 'object') assertNoBase64InJson(value, p);
  }
}

function projectBasePath(userId, projectId) {
  return `users/${userId}/projects/${projectId}`;
}

function sanitizeImageFilename(name, fallbackExt = '.jpg') {
  const base = path.basename(String(name || 'image')).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (/\.(jpe?g|png|webp|gif)$/i.test(base)) return base.slice(0, 120);
  return `${base || 'image'}${fallbackExt}`.slice(0, 120);
}

function mapRow(row, productName) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    variationId: row.variation_id,
    projectName: row.project_name,
    projectJson: row.project_json,
    previewUrl: row.preview_url,
    generatedPdfUrl: row.generated_pdf_url,
    quantity: row.quantity,
    price: row.price != null ? parseFloat(row.price) : null,
    status: row.status,
    isLocked: row.is_locked,
    pageCount: row.page_count,
    lastEditedAt: row.last_edited_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    productName: productName || null,
  };
}

async function uploadCustomerImage({ userId, projectId, imageId, buffer, contentType, originalName }) {
  if (!bunnyStorage.isBunnyConfigured()) {
    throw new ValidationError('File storage is not configured. Please contact support.');
  }
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ValidationError('Image file is required');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ValidationError('Image file is too large');
  }

  const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
  const filename = sanitizeImageFilename(originalName, ext);
  const relativePath = `${projectBasePath(userId, projectId)}/${imageId}_${filename}`;

  const uploaded = await bunnyStorage.uploadBufferIfMissing(relativePath, buffer, contentType);
  return {
    path: uploaded.path,
    url: uploaded.url,
    skipped: uploaded.skipped,
    imageId,
  };
}

async function saveProject({
  userId,
  projectId,
  productId,
  variationId,
  projectName,
  projectJson,
  quantity,
  price,
  pageCount,
  status,
  previewBuffer,
  previewContentType,
}) {
  if (!userId) throw new ValidationError('User is required');
  if (!productId) throw new ValidationError('Product is required');

  const parsedJson = parseProjectJson(projectJson);
  assertNoBase64InJson(parsedJson);

  const id = projectId || crypto.randomUUID();
  const existing = projectId ? await photobookProjectModel.getProjectById(id, userId) : null;

  if (existing?.is_locked) {
    throw new ValidationError('This design has been purchased and can no longer be edited');
  }

  let assetPaths = [];
  if (existing?.asset_paths) {
    assetPaths = Array.isArray(existing.asset_paths)
      ? [...existing.asset_paths]
      : (typeof existing.asset_paths === 'string' ? JSON.parse(existing.asset_paths) : []);
  }

  let previewUrl = existing?.preview_url || null;

  if (previewBuffer && Buffer.isBuffer(previewBuffer) && previewBuffer.length > 0) {
    if (previewBuffer.length > MAX_PREVIEW_BYTES) {
      throw new ValidationError('Preview image is too large');
    }
    if (!bunnyStorage.isBunnyConfigured()) {
      throw new ValidationError('File storage is not configured. Please contact support.');
    }
    const previewPath = `${projectBasePath(userId, id)}/preview.jpg`;
    const uploaded = await bunnyStorage.uploadBuffer(previewPath, previewBuffer, previewContentType || 'image/jpeg');
    previewUrl = uploaded.url;
    assetPaths = assetPaths.filter((a) => a.type !== 'preview');
    assetPaths.push({ type: 'preview', path: uploaded.path, url: uploaded.url });
  }

  const payload = {
    projectName: projectName || existing?.project_name || 'My Project',
    projectJson: parsedJson,
    previewUrl,
    quantity: quantity || existing?.quantity || 1,
    price,
    assetPaths,
    status: status || existing?.status || 'draft',
    pageCount: pageCount || 0,
  };

  const row = existing
    ? await photobookProjectModel.updateProject(id, userId, payload)
    : await photobookProjectModel.createProject({
      id,
      userId,
      productId,
      variationId,
      ...payload,
    });

  return mapRow(row);
}

async function finalizeWithPdf({ userId, projectId, pdfBuffer }) {
  if (!userId || !projectId) throw new ValidationError('Project is required');
  const existing = await photobookProjectModel.getProjectById(projectId, userId);
  if (!existing) throw new ValidationError('Project not found');
  if (existing.generated_pdf_url) {
    return mapRow(existing);
  }
  if (!existing.is_locked && existing.status !== 'purchased') {
    throw new ValidationError('Project must be purchased before generating print PDF');
  }

  if (!bunnyStorage.isBunnyConfigured()) {
    throw new ValidationError('File storage is not configured. Please contact support.');
  }
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new ValidationError('Print PDF is required');
  }
  if (pdfBuffer.length > MAX_PDF_BYTES) {
    throw new ValidationError('Print PDF is too large');
  }

  const pdfPath = `${projectBasePath(userId, projectId)}/print.pdf`;
  const uploaded = await bunnyStorage.uploadBufferIfMissing(pdfPath, pdfBuffer, 'application/pdf');

  let assetPaths = Array.isArray(existing.asset_paths)
    ? [...existing.asset_paths]
    : (typeof existing.asset_paths === 'string' ? JSON.parse(existing.asset_paths) : []);
  assetPaths = assetPaths.filter((a) => a.type !== 'pdf');
  assetPaths.push({ type: 'pdf', path: uploaded.path, url: uploaded.url, skipped: uploaded.skipped });

  const parsedJson = typeof existing.project_json === 'object'
    ? { ...existing.project_json }
    : parseProjectJson(existing.project_json);
  parsedJson.generatedPdfUrl = uploaded.url;

  const row = await photobookProjectModel.updateProject(projectId, userId, {
    projectJson: parsedJson,
    generatedPdfUrl: uploaded.url,
    assetPaths,
  });

  return mapRow(row);
}

async function addImageAssetToProject(userId, projectId, assetEntry) {
  const existing = await photobookProjectModel.getProjectById(projectId, userId);
  if (!existing) throw new ValidationError('Project not found');
  if (existing.is_locked) throw new ValidationError('This design has been purchased and can no longer be edited');

  let assetPaths = Array.isArray(existing.asset_paths)
    ? [...existing.asset_paths]
    : (typeof existing.asset_paths === 'string' ? JSON.parse(existing.asset_paths) : []);

  const dupIdx = assetPaths.findIndex((a) => a.imageId === assetEntry.imageId);
  if (dupIdx >= 0) {
    assetPaths[dupIdx] = { type: 'image', ...assetEntry };
  } else {
    assetPaths.push({ type: 'image', ...assetEntry });
  }

  await photobookProjectModel.updateProject(projectId, userId, { assetPaths });
}

module.exports = {
  parseProjectJson,
  saveProject,
  uploadCustomerImage,
  addImageAssetToProject,
  finalizeWithPdf,
  mapRow,
};
