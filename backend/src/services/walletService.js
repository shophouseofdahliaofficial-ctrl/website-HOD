const { getClient, query } = require('../config/database');
const { ValidationError } = require('../utils/errors');

let schemaEnsured = false;

async function ensureWalletSchema() {
  if (schemaEnsured) return;

  await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0;`);

  await query(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
      amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      source TEXT NOT NULL CHECK (source IN ('razorpay', 'refund', 'purchase', 'subscription')),
      reference_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id_created_at ON wallet_transactions(user_id, created_at DESC);`);
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_transactions_ref ON wallet_transactions(user_id, type, source, reference_id) WHERE reference_id IS NOT NULL;`
  );

  schemaEnsured = true;
}

function normalizeAmount(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  return rounded > 0 ? rounded : null;
}

async function getWalletSummary(userId, limit = 20) {
  await ensureWalletSchema();
  const balanceRes = await query(`SELECT wallet_balance FROM users WHERE id = $1`, [userId]);
  const balance = balanceRes.rows.length > 0 ? parseFloat(balanceRes.rows[0].wallet_balance) : 0;

  const txRes = await query(
    `
    SELECT id, type, amount, source, reference_id, created_at
    FROM wallet_transactions
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [userId, Math.max(0, Math.min(100, Number(limit) || 20))]
  );

  return {
    balance,
    transactions: txRes.rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: parseFloat(r.amount),
      source: r.source,
      referenceId: r.reference_id,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    })),
  };
}

async function creditWallet({ userId, amount, source, referenceId }) {
  await ensureWalletSchema();
  const amt = normalizeAmount(amount);
  if (!amt) throw new ValidationError('Invalid amount');

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE`, [userId]);

    const insertTx = await client.query(
      `
      INSERT INTO wallet_transactions (user_id, type, amount, source, reference_id)
      VALUES ($1, 'credit', $2, $3, $4)
      ON CONFLICT DO NOTHING
      RETURNING id
      `,
      [userId, amt, source, referenceId || null]
    );

    if (insertTx.rows.length === 0) {
      const balRes = await client.query(`SELECT wallet_balance FROM users WHERE id = $1`, [userId]);
      await client.query('COMMIT');
      return { credited: false, balance: parseFloat(balRes.rows[0]?.wallet_balance || 0) };
    }

    const upd = await client.query(
      `UPDATE users SET wallet_balance = wallet_balance + $1, updated_at = NOW() WHERE id = $2 RETURNING wallet_balance`,
      [amt, userId]
    );
    await client.query('COMMIT');

    return { credited: true, balance: parseFloat(upd.rows[0].wallet_balance) };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function debitWallet({ userId, amount, source, referenceId }) {
  await ensureWalletSchema();
  const amt = normalizeAmount(amount);
  if (!amt) throw new ValidationError('Invalid amount');

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const balRes = await client.query(`SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    if (balRes.rows.length === 0) throw new ValidationError('User not found');
    const current = parseFloat(balRes.rows[0].wallet_balance || 0);

    if (current + 1e-9 < amt) {
      throw new ValidationError('Insufficient wallet balance');
    }

    const insertTx = await client.query(
      `
      INSERT INTO wallet_transactions (user_id, type, amount, source, reference_id)
      VALUES ($1, 'debit', $2, $3, $4)
      ON CONFLICT DO NOTHING
      RETURNING id
      `,
      [userId, amt, source, referenceId || null]
    );

    if (insertTx.rows.length === 0) {
      const bal2 = await client.query(`SELECT wallet_balance FROM users WHERE id = $1`, [userId]);
      await client.query('COMMIT');
      return { debited: false, balance: parseFloat(bal2.rows[0]?.wallet_balance || 0) };
    }

    const upd = await client.query(
      `UPDATE users SET wallet_balance = wallet_balance - $1, updated_at = NOW() WHERE id = $2 RETURNING wallet_balance`,
      [amt, userId]
    );
    await client.query('COMMIT');
    return { debited: true, balance: parseFloat(upd.rows[0].wallet_balance) };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  ensureWalletSchema,
  getWalletSummary,
  creditWallet,
  debitWallet,
};
