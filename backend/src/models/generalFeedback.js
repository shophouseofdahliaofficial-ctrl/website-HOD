const { query } = require('../config/database');

let schemaEnsured = false;

async function ensureSchema() {
  if (schemaEnsured) return;
  try {
    await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await query(`
      CREATE TABLE IF NOT EXISTS general_feedback (
        id SERIAL PRIMARY KEY,
        user_id UUID,
        email TEXT,
        feedback_type VARCHAR(100) DEFAULT 'contact_inquiry',
        message TEXT NOT NULL,
        rating INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await query(`ALTER TABLE general_feedback ADD COLUMN IF NOT EXISTS email TEXT;`);
    await query(`ALTER TABLE general_feedback ADD COLUMN IF NOT EXISTS message TEXT;`);
    await query(`ALTER TABLE general_feedback ADD COLUMN IF NOT EXISTS feedback_type VARCHAR(100) DEFAULT 'contact_inquiry';`);
    try {
      await query(`ALTER TABLE general_feedback ALTER COLUMN feedback_type DROP NOT NULL;`);
    } catch (_) {}
    await query(`ALTER TABLE general_feedback ADD COLUMN IF NOT EXISTS user_id UUID;`);
    await query(`ALTER TABLE general_feedback ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);

    await query(`
      CREATE TABLE IF NOT EXISTS photobook_editor_feedback (
        id SERIAL PRIMARY KEY,
        user_id UUID,
        email TEXT,
        message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await query(`ALTER TABLE photobook_editor_feedback ADD COLUMN IF NOT EXISTS email TEXT;`);
    await query(`ALTER TABLE photobook_editor_feedback ADD COLUMN IF NOT EXISTS message TEXT;`);
    await query(`ALTER TABLE photobook_editor_feedback ADD COLUMN IF NOT EXISTS user_id UUID;`);
    await query(`ALTER TABLE photobook_editor_feedback ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_general_feedback_created
      ON general_feedback(created_at DESC);
    `);
    schemaEnsured = true;
  } catch (err) {
    console.error('Error ensuring general_feedback schema:', err);
  }
}

async function submitFeedback({ userId, email, message, feedbackType = 'contact_inquiry' }) {
  await ensureSchema();
  if (!email || !message) {
    throw new Error('Email and message are required');
  }
  const res = await query(
    `
    INSERT INTO general_feedback (user_id, email, message, feedback_type)
    VALUES ($1, $2, $3, $4)
    RETURNING id, user_id, email, message, feedback_type, created_at
    `,
    [userId || null, email.trim(), message.trim(), feedbackType || 'contact_inquiry']
  );
  return res.rows[0];
}

async function getGeneralFeedbackList() {
  await ensureSchema();
  const res = await query(
    `
    SELECT f.id, f.user_id, f.email, f.message, f.feedback_type, f.created_at, u.name as user_name
    FROM general_feedback f
    LEFT JOIN users u ON u.id = f.user_id
    ORDER BY f.created_at DESC
    LIMIT 100
    `
  );
  return res.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    message: row.message,
    feedbackType: row.feedback_type,
    createdAt: row.created_at,
    userName: row.user_name
  }));
}

async function getLatestFeedbackTimestamp() {
  await ensureSchema();
  const res = await query(
    `
    SELECT MAX(created_at) AS latest FROM (
      SELECT created_at FROM general_feedback
      UNION ALL
      SELECT created_at FROM photobook_editor_feedback
    ) as combined_feedback
    `
  );
  return res.rows[0]?.latest || null;
}

module.exports = {
  submitFeedback,
  getGeneralFeedbackList,
  getLatestFeedbackTimestamp,
};
