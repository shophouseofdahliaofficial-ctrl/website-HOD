const { query } = require('../config/database');

let schemaEnsured = false;

async function ensureSchema() {
  if (schemaEnsured) return;
  await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  await query(`
    CREATE TABLE IF NOT EXISTS general_feedback (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS photobook_editor_feedback (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      email TEXT,
      message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_general_feedback_created
    ON general_feedback(created_at DESC);
  `);
  schemaEnsured = true;
}

async function submitFeedback({ userId, email, message }) {
  await ensureSchema();
  if (!email || !message) {
    throw new Error('Email and message are required');
  }
  const res = await query(
    `
    INSERT INTO general_feedback (user_id, email, message)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, email, message, created_at
    `,
    [userId || null, email.trim(), message.trim()]
  );
  return res.rows[0];
}

async function getGeneralFeedbackList() {
  await ensureSchema();
  const res = await query(
    `
    SELECT f.id, f.user_id, f.email, f.message, f.created_at, u.name as user_name
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
