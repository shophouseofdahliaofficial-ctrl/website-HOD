const { query } = require('../config/database');

let schemaEnsured = false;

const PHOTOBOOTH_PRICE_PER_UNIT = 14;
const PHOTOBOOTH_DELIVERY_FEE = 100;
const PHOTOBOOTH_POLAROID_PRODUCT_ID = parseInt(process.env.PHOTOBOOTH_POLAROID_PRODUCT_ID || '2', 10);
const PHOTOBOOTH_STRIP_PRODUCT_ID = parseInt(process.env.PHOTOBOOTH_STRIP_PRODUCT_ID || '4', 10);

async function ensurePhotoboothSchema() {
  if (schemaEnsured) return;
  await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

  await query(`
    CREATE TABLE IF NOT EXISTS photobooth_projects (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_type TEXT NOT NULL CHECK (project_type IN ('polaroid', 'strip')),
      project_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      preview_url TEXT,
      generated_pdf_url TEXT,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
      asset_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'cart', 'ordered')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_photobooth_projects_user_id ON photobooth_projects(user_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_photobooth_projects_created_at ON photobooth_projects(created_at DESC);`);

  await query(`
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS photobooth_project_id UUID REFERENCES photobooth_projects(id) ON DELETE SET NULL;
  `);

  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_photobooth_product BOOLEAN NOT NULL DEFAULT false;`);

  schemaEnsured = true;
}

async function createProject({
  id,
  userId,
  projectType,
  projectJson,
  previewUrl,
  generatedPdfUrl,
  quantity,
  price,
  assetPaths,
  status = 'cart',
}) {
  await ensurePhotoboothSchema();
  const res = await query(
    `
    INSERT INTO photobooth_projects (
      id, user_id, project_type, project_json, preview_url, generated_pdf_url,
      quantity, price, asset_paths, status, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    RETURNING *
    `,
    [
      id,
      userId,
      projectType,
      JSON.stringify(projectJson || {}),
      previewUrl || null,
      generatedPdfUrl || null,
      quantity,
      price,
      JSON.stringify(assetPaths || []),
      status,
    ],
  );
  return res.rows[0];
}

async function getProjectById(id, userId) {
  await ensurePhotoboothSchema();
  const res = await query(
    `SELECT * FROM photobooth_projects WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [id, userId],
  );
  return res.rows[0] || null;
}

async function getProjectsByUser(userId) {
  await ensurePhotoboothSchema();
  const res = await query(
    `SELECT * FROM photobooth_projects WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return res.rows;
}

async function deleteProject(id, userId) {
  await ensurePhotoboothSchema();
  const res = await query(
    `DELETE FROM photobooth_projects WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId],
  );
  return res.rows[0] || null;
}

async function markProjectOrdered(id, userId) {
  await ensurePhotoboothSchema();
  const res = await query(
    `
    UPDATE photobooth_projects
    SET status = 'ordered', updated_at = NOW()
    WHERE id = $1 AND user_id = $2
    RETURNING *
    `,
    [id, userId],
  );
  return res.rows[0] || null;
}

function resolvePhotoboothProductId(projectType = 'polaroid') {
  const id = projectType === 'strip'
    ? PHOTOBOOTH_STRIP_PRODUCT_ID
    : PHOTOBOOTH_POLAROID_PRODUCT_ID;
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function getPhotoboothProductId(projectType = 'polaroid') {
  await ensurePhotoboothSchema();
  const productId = resolvePhotoboothProductId(projectType);
  if (!productId) return null;
  const res = await query(
    `SELECT id FROM products WHERE id = $1 AND is_active = true LIMIT 1`,
    [productId],
  );
  return res.rows[0]?.id || null;
}

function calculatePhotoboothPrice(quantity) {
  const qty = Math.max(1, parseInt(String(quantity), 10) || 1);
  return PHOTOBOOTH_PRICE_PER_UNIT * qty + PHOTOBOOTH_DELIVERY_FEE;
}

module.exports = {
  ensurePhotoboothSchema,
  createProject,
  getProjectById,
  getProjectsByUser,
  deleteProject,
  markProjectOrdered,
  getPhotoboothProductId,
  resolvePhotoboothProductId,
  calculatePhotoboothPrice,
  PHOTOBOOTH_POLAROID_PRODUCT_ID,
  PHOTOBOOTH_STRIP_PRODUCT_ID,
  PHOTOBOOTH_PRICE_PER_UNIT,
  PHOTOBOOTH_DELIVERY_FEE,
};
