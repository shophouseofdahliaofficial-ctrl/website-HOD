const { query } = require('../config/database');

let schemaEnsured = false;

const DRAFT_EXPIRY_DAYS = 30;
const DELIVERED_PURCHASED_CLEANUP_DAYS = 7;

async function ensurePhotobookSchema() {
  if (schemaEnsured) return;
  await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

  await query(`
    CREATE TABLE IF NOT EXISTS photobook_projects (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      variation_id INTEGER,
      project_name TEXT NOT NULL DEFAULT 'My Project',
      project_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      preview_url TEXT,
      generated_pdf_url TEXT,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      price DECIMAL(10, 2),
      asset_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'cart', 'purchased')),
      is_locked BOOLEAN NOT NULL DEFAULT false,
      page_count INTEGER NOT NULL DEFAULT 0,
      last_edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_photobook_projects_user_id ON photobook_projects(user_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_photobook_projects_last_edited ON photobook_projects(last_edited_at DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_photobook_projects_expires_at ON photobook_projects(expires_at);`);

  await query(`
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS photobook_project_id UUID REFERENCES photobook_projects(id) ON DELETE SET NULL;
  `);

  schemaEnsured = true;
}

function computeExpiresAt() {
  return new Date(Date.now() + DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

async function createProject({
  id,
  userId,
  productId,
  variationId,
  projectName,
  projectJson,
  previewUrl,
  quantity,
  price,
  assetPaths,
  status = 'draft',
  pageCount = 0,
}) {
  await ensurePhotobookSchema();
  const expiresAt = status === 'purchased' ? null : computeExpiresAt();
  const res = await query(
    `
    INSERT INTO photobook_projects (
      id, user_id, product_id, variation_id, project_name, project_json, preview_url,
      quantity, price, asset_paths, status, is_locked, page_count,
      last_edited_at, expires_at, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, $12, NOW(), $13, NOW(), NOW())
    RETURNING *
    `,
    [
      id,
      userId,
      productId,
      variationId || null,
      projectName || 'My Project',
      JSON.stringify(projectJson || {}),
      previewUrl || null,
      quantity || 1,
      price != null ? price : null,
      JSON.stringify(assetPaths || []),
      status,
      pageCount || 0,
      expiresAt,
    ],
  );
  return res.rows[0];
}

async function updateProject(id, userId, patch) {
  await ensurePhotobookSchema();
  const fields = [];
  const values = [];
  let idx = 1;

  const allowed = {
    project_name: 'projectName',
    project_json: 'projectJson',
    preview_url: 'previewUrl',
    quantity: 'quantity',
    price: 'price',
    asset_paths: 'assetPaths',
    status: 'status',
    page_count: 'pageCount',
    generated_pdf_url: 'generatedPdfUrl',
    is_locked: 'isLocked',
  };

  for (const [col, key] of Object.entries(allowed)) {
    if (patch[key] !== undefined) {
      let val = patch[key];
      if (col === 'project_json' || col === 'asset_paths') val = JSON.stringify(val || (col === 'asset_paths' ? [] : {}));
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    }
  }

  if (fields.length === 0) {
    return getProjectById(id, userId);
  }

  const status = patch.status;
  const isLocked = patch.isLocked;
  if (status === 'purchased' || isLocked === true) {
    fields.push(`expires_at = NULL`);
  } else if (status === 'draft' || status === 'cart') {
    fields.push(`expires_at = $${idx++}`);
    values.push(computeExpiresAt());
  }

  fields.push('last_edited_at = NOW()');
  fields.push('updated_at = NOW()');

  values.push(id, userId);
  const res = await query(
    `
    UPDATE photobook_projects
    SET ${fields.join(', ')}
    WHERE id = $${idx++} AND user_id = $${idx}
    RETURNING *
    `,
    values,
  );
  return res.rows[0] || null;
}

async function getProjectById(id, userId) {
  await ensurePhotobookSchema();
  const res = await query(
    `SELECT * FROM photobook_projects WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [id, userId],
  );
  return res.rows[0] || null;
}

async function getProjectsByUser(userId) {
  await ensurePhotobookSchema();
  const res = await query(
    `SELECT * FROM photobook_projects WHERE user_id = $1 ORDER BY last_edited_at DESC`,
    [userId],
  );
  return res.rows;
}

async function deleteProject(id, userId) {
  await ensurePhotobookSchema();
  const res = await query(
    `DELETE FROM photobook_projects WHERE id = $1 AND user_id = $2 AND status != 'purchased' RETURNING *`,
    [id, userId],
  );
  return res.rows[0] || null;
}

async function markProjectCart(id, userId) {
  return updateProject(id, userId, { status: 'cart' });
}

async function markProjectPurchased(id, userId) {
  await ensurePhotobookSchema();
  const res = await query(
    `
    UPDATE photobook_projects
    SET status = 'purchased', is_locked = true, expires_at = NULL, updated_at = NOW()
    WHERE id = $1 AND user_id = $2
    RETURNING *
    `,
    [id, userId],
  );
  return res.rows[0] || null;
}

async function getExpiredDraftProjects() {
  await ensurePhotobookSchema();
  const res = await query(
    `
    SELECT id, user_id, asset_paths, preview_url, generated_pdf_url
    FROM photobook_projects
    WHERE status IN ('draft', 'cart')
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    `,
  );
  return res.rows;
}

async function getDeliveredPurchasedProjectsForCleanup() {
  await ensurePhotobookSchema();
  const res = await query(
    `
    SELECT DISTINCT p.id, p.user_id, p.asset_paths, p.preview_url, p.generated_pdf_url
    FROM photobook_projects p
    WHERE p.status = 'purchased'
      AND p.id IN (
        SELECT DISTINCT oi.photobook_project_id
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.photobook_project_id IS NOT NULL
          AND o.status = 'delivered'
          AND o.delivered_at IS NOT NULL
          AND o.delivered_at < NOW() - ($1::int * INTERVAL '1 day')
      )
    `,
    [DELIVERED_PURCHASED_CLEANUP_DAYS],
  );
  return res.rows;
}

module.exports = {
  ensurePhotobookSchema,
  createProject,
  updateProject,
  getProjectById,
  getProjectsByUser,
  deleteProject,
  markProjectCart,
  markProjectPurchased,
  getExpiredDraftProjects,
  getDeliveredPurchasedProjectsForCleanup,
  DRAFT_EXPIRY_DAYS,
  DELIVERED_PURCHASED_CLEANUP_DAYS,
};
