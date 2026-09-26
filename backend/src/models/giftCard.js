const { query, getClient } = require('../config/database');
const { ValidationError } = require('../utils/errors');
const walletService = require('../services/walletService');

let schemaEnsured = false;

async function ensureGiftCardSchema() {
  if (schemaEnsured) return;

  await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

  await query(`
    CREATE TABLE IF NOT EXISTS gift_cards (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      code VARCHAR(50) UNIQUE NOT NULL,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired', 'cancelled')),
      created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      redeemed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      redeemed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_gift_cards_created_by ON gift_cards(created_by_user_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_gift_cards_redeemed_by ON gift_cards(redeemed_by_user_id);`);

  // Seed default demo cards if not exist
  await query(`
    INSERT INTO gift_cards (code, amount, status)
    VALUES 
      ('HOD-WNJ8-92L2', 1000.00, 'active'),
      ('HOD-78KL-M90P', 500.00, 'redeemed')
    ON CONFLICT (code) DO NOTHING;
  `);

  schemaEnsured = true;
}

function generateCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const genPart = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `HOD-${genPart()}-${genPart()}-${genPart()}`;
}

async function createGiftCard({ amount, userId }) {
  await ensureGiftCardSchema();
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new ValidationError('Invalid gift card amount');
  }

  let attempts = 0;
  while (attempts < 10) {
    attempts++;
    const code = generateCode();
    try {
      const res = await query(
        `
        INSERT INTO gift_cards (code, amount, status, created_by_user_id)
        VALUES ($1, $2, 'active', $3)
        RETURNING id, code, amount, status, created_at
        `,
        [code, amt, userId || null]
      );
      return res.rows[0];
    } catch (err) {
      if (err.code === '23505' && attempts < 10) {
        continue; // duplicate code collision, retry
      }
      throw err;
    }
  }
  throw new Error('Failed to generate unique gift card code. Please try again.');
}

async function redeemGiftCard({ code, userId }) {
  await ensureGiftCardSchema();
  if (!userId) throw new ValidationError('Authentication required to redeem gift card');
  if (!code || typeof code !== 'string') throw new ValidationError('Please enter a valid gift card code');

  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) throw new ValidationError('Please enter a valid gift card code');

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Row-level lock on the gift card to prevent race conditions & double redemption
    const cardRes = await client.query(
      `SELECT id, code, amount, status, redeemed_at FROM gift_cards WHERE UPPER(code) = $1 FOR UPDATE`,
      [normalizedCode]
    );

    if (cardRes.rows.length === 0) {
      throw new ValidationError('Invalid gift card code. Please check the code and try again.');
    }

    const card = cardRes.rows[0];
    if (card.status === 'redeemed' || card.redeemed_at) {
      throw new ValidationError('This gift card has already been redeemed and cannot be used again.');
    }

    if (card.status !== 'active') {
      throw new ValidationError(`This gift card is ${card.status} and cannot be redeemed.`);
    }

    const amountNum = parseFloat(card.amount);

    // Mark card as redeemed
    await client.query(
      `
      UPDATE gift_cards
      SET status = 'redeemed', redeemed_by_user_id = $1, redeemed_at = NOW(), updated_at = NOW()
      WHERE id = $2
      `,
      [userId, card.id]
    );

    await client.query('COMMIT');

    // Credit user's wallet
    const creditResult = await walletService.creditWallet({
      userId,
      amount: amountNum,
      source: 'gift_card',
      referenceId: `giftcard_redeem_${card.id}`,
    });

    return {
      success: true,
      card: {
        id: card.id,
        code: card.code,
        amount: amountNum,
      },
      balance: creditResult.balance,
      message: `Gift card successfully redeemed! ₹${amountNum} credited to your wallet.`,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getGiftCardHistory(userId) {
  await ensureGiftCardSchema();
  if (!userId) return [];

  const res = await query(
    `
    SELECT id, code, amount, status, created_by_user_id, redeemed_by_user_id, created_at, redeemed_at
    FROM gift_cards
    WHERE created_by_user_id = $1 OR redeemed_by_user_id = $1
    ORDER BY created_at DESC
    LIMIT 100
    `,
    [userId]
  );

  return res.rows.map((row) => {
    const isRedeemedByMe = row.redeemed_by_user_id === userId;
    return {
      id: row.id,
      code: row.code,
      amount: parseFloat(row.amount),
      type: isRedeemedByMe ? 'redeemed' : 'created',
      status: row.status === 'redeemed' ? 'Redeemed' : 'Created',
      date: new Date(isRedeemedByMe && row.redeemed_at ? row.redeemed_at : row.created_at).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  });
}

module.exports = {
  ensureGiftCardSchema,
  createGiftCard,
  redeemGiftCard,
  getGiftCardHistory,
};
