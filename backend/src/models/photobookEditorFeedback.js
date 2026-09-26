const { query } = require('../config/database');

let schemaEnsured = false;

async function ensureSchema() {
  if (schemaEnsured) return;
  try {
    await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await query(`
      CREATE TABLE IF NOT EXISTS photobook_editor_feedback (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        email TEXT,
        issue_type TEXT,
        issue_label TEXT,
        rating NUMERIC,
        message TEXT,
        product_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await query(`ALTER TABLE photobook_editor_feedback ADD COLUMN IF NOT EXISTS email TEXT;`);
    await query(`ALTER TABLE photobook_editor_feedback ADD COLUMN IF NOT EXISTS message TEXT;`);
    await query(`ALTER TABLE photobook_editor_feedback ADD COLUMN IF NOT EXISTS issue_type TEXT;`);
    await query(`ALTER TABLE photobook_editor_feedback ADD COLUMN IF NOT EXISTS issue_label TEXT;`);
    await query(`ALTER TABLE photobook_editor_feedback ADD COLUMN IF NOT EXISTS rating NUMERIC;`);
    await query(`ALTER TABLE photobook_editor_feedback ADD COLUMN IF NOT EXISTS product_name TEXT;`);
    await query(`ALTER TABLE photobook_editor_feedback ADD COLUMN IF NOT EXISTS user_id UUID;`);
    await query(`ALTER TABLE photobook_editor_feedback ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
    schemaEnsured = true;
  } catch (err) {
    console.error('Error ensuring photobook_editor_feedback schema:', err);
  }
}

async function submitFeedback(data) {
  await ensureSchema();
  const { userId, email, issueType, issueLabel, rating, message, productName } = data || {};
  const res = await query(
    `
    INSERT INTO photobook_editor_feedback (user_id, email, issue_type, issue_label, rating, message, product_name)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, user_id, email, issue_type, issue_label, rating, message, product_name, created_at
    `,
    [userId || null, email || null, issueType || null, issueLabel || null, rating || null, message || null, productName || null]
  );
  return res.rows[0];
}

async function getAdminFeedbackData() {
  await ensureSchema();
  try {
    const res = await query(
      `
      SELECT f.id, f.user_id, f.email, f.issue_type, f.issue_label, f.rating, f.message, f.product_name, f.created_at, u.name as user_name
      FROM photobook_editor_feedback f
      LEFT JOIN users u ON u.id = f.user_id
      ORDER BY f.created_at DESC
      LIMIT 100
      `
    );

    const recent = (res.rows || []).map(row => ({
      id: row.id,
      issueType: row.issue_type || 'General',
      issueLabel: row.issue_label || row.issue_type || 'General',
      rating: Number(row.rating) || 0,
      message: row.message,
      userEmail: row.email,
      userName: row.user_name,
      productName: row.product_name,
      createdAt: row.created_at
    }));

    const total = recent.length;
    const ratings = recent.filter(r => r.rating > 0).map(r => r.rating);
    const avgRating = ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : null;

    const byIssueType = {};
    recent.forEach(r => {
      const type = r.issueType || 'General';
      byIssueType[type] = (byIssueType[type] || 0) + 1;
    });

    return {
      total,
      avgRating,
      byIssueType,
      recent
    };
  } catch (error) {
    console.error('Error in photobookEditorFeedback.getAdminFeedbackData:', error);
    return {
      total: 0,
      avgRating: null,
      byIssueType: {},
      recent: []
    };
  }
}

module.exports = {
  submitFeedback,
  getAdminFeedbackData,
};
