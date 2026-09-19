const { query } = require('../config/database');

let schemaEnsured = false;

const ISSUE_TYPES = [
  'cant_upload_images',
  'cant_add_stickers',
  'canvas_error',
  'cant_save_project',
  'pages_layout_issue',
  'text_typography_issue',
  'other',
];

const ISSUE_LABELS = {
  cant_upload_images: "Can't upload images",
  cant_add_stickers: "Can't add stickers",
  canvas_error: 'Error in canvas',
  cant_save_project: "Can't save project",
  pages_layout_issue: 'Pages / layout issue',
  text_typography_issue: 'Text / typography issue',
  other: 'Other',
};

async function ensureSchema() {
  if (schemaEnsured) return;
  await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  await query(`
    CREATE TABLE IF NOT EXISTS photobook_editor_feedback (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      project_id UUID REFERENCES photobook_projects(id) ON DELETE SET NULL,
      issue_type TEXT NOT NULL,
      rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
      message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_photobook_editor_feedback_created
    ON photobook_editor_feedback(created_at DESC);
  `);
  schemaEnsured = true;
}

async function submitFeedback({ userId, productId, projectId, issueType, rating, message }) {
  await ensureSchema();
  const normalizedIssue = String(issueType || '').trim();
  if (!ISSUE_TYPES.includes(normalizedIssue)) {
    throw new Error('Invalid issue type');
  }
  const stars = parseInt(String(rating), 10);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const res = await query(
    `
    INSERT INTO photobook_editor_feedback (
      user_id, product_id, project_id, issue_type, rating, message
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, issue_type, rating, message, created_at
    `,
    [
      userId || null,
      productId ? parseInt(String(productId), 10) : null,
      projectId || null,
      normalizedIssue,
      stars,
      message ? String(message).trim().slice(0, 4000) : null,
    ],
  );
  return res.rows[0];
}

async function getAdminFeedbackData() {
  await ensureSchema();

  const countRes = await query(`SELECT COUNT(*)::int AS total FROM photobook_editor_feedback`);
  const total = countRes.rows[0]?.total || 0;

  const avgRes = await query(
    `SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating FROM photobook_editor_feedback WHERE rating IS NOT NULL`,
  );
  const avgRating = avgRes.rows[0]?.avg_rating != null ? parseFloat(avgRes.rows[0].avg_rating) : null;

  const byIssueRes = await query(
    `SELECT issue_type, COUNT(*)::int AS c FROM photobook_editor_feedback GROUP BY issue_type`,
  );
  const byIssueType = {};
  for (const row of byIssueRes.rows) {
    byIssueType[row.issue_type] = row.c;
  }

  const recentRes = await query(
    `
    SELECT
      f.id,
      f.issue_type,
      f.rating,
      f.message,
      f.created_at,
      u.email AS user_email,
      u.name AS user_name,
      p.name AS product_name
    FROM photobook_editor_feedback f
    LEFT JOIN users u ON u.id = f.user_id
    LEFT JOIN products p ON p.id = f.product_id
    ORDER BY f.created_at DESC
    LIMIT 100
    `,
  );

  return {
    total,
    avgRating,
    byIssueType,
    issueLabels: ISSUE_LABELS,
    recent: recentRes.rows.map((row) => ({
      id: row.id,
      issueType: row.issue_type,
      issueLabel: ISSUE_LABELS[row.issue_type] || row.issue_type,
      rating: row.rating,
      message: row.message,
      userEmail: row.user_email,
      userName: row.user_name,
      productName: row.product_name,
      createdAt: row.created_at,
    })),
  };
}

module.exports = {
  ISSUE_TYPES,
  ISSUE_LABELS,
  submitFeedback,
  getAdminFeedbackData,
};
