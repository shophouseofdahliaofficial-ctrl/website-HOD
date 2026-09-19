const { query } = require('../config/database');

let ensured = false;

async function ensureCartAnalyticsSchema() {
  if (ensured) return;
  ensured = true;

  await query(
    `
    CREATE TABLE IF NOT EXISTS cart_analytics_events (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id UUID NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('add', 'remove', 'clear', 'order_placed')),
      product_id TEXT NULL,
      variation_id TEXT NULL,
      cart_item_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    `
  );

  await query(`CREATE INDEX IF NOT EXISTS idx_cart_analytics_events_session ON cart_analytics_events(session_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_cart_analytics_events_created_at ON cart_analytics_events(created_at);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_cart_analytics_events_user_id ON cart_analytics_events(user_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_cart_analytics_events_event_type ON cart_analytics_events(event_type);`);
}

async function insertCartEvent({
  sessionId,
  userId,
  eventType,
  productId,
  variationId,
  cartItemCount,
}) {
  await ensureCartAnalyticsSchema();
  await query(
    `
    INSERT INTO cart_analytics_events (session_id, user_id, event_type, product_id, variation_id, cart_item_count)
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      String(sessionId),
      userId || null,
      String(eventType),
      productId != null ? String(productId) : null,
      variationId != null ? String(variationId) : null,
      Number.isFinite(cartItemCount) ? Math.max(0, Math.min(999, Math.floor(cartItemCount))) : 0,
    ]
  );
}

/**
 * Computes cart abandonment rate for a window (default last 30 days):
 * - Denominator: sessions that have at least one `add` event.
 * - Numerator: sessions with at least one `add`, no `order_placed`,
 *   and whose last event within the window results in cart_item_count = 0
 *   AND last event is `remove` or `clear`.
 */
async function getCartAbandonment({ sinceIso } = {}) {
  await ensureCartAnalyticsSchema();

  const since = sinceIso ? new Date(sinceIso) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sinceParam = Number.isNaN(since.getTime()) ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : since;

  const res = await query(
    `
    WITH window_events AS (
      SELECT *
      FROM cart_analytics_events
      WHERE created_at >= $1
    ),
    sessions_with_add AS (
      SELECT DISTINCT session_id
      FROM window_events
      WHERE event_type = 'add'
    ),
    sessions_with_order AS (
      SELECT DISTINCT session_id
      FROM window_events
      WHERE event_type = 'order_placed'
    ),
    last_event AS (
      SELECT DISTINCT ON (session_id)
        session_id,
        event_type,
        cart_item_count,
        created_at
      FROM window_events
      ORDER BY session_id, created_at DESC, id DESC
    ),
    abandoned_sessions AS (
      SELECT a.session_id
      FROM sessions_with_add a
      LEFT JOIN sessions_with_order o ON o.session_id = a.session_id
      JOIN last_event le ON le.session_id = a.session_id
      WHERE o.session_id IS NULL
        AND le.cart_item_count = 0
        AND le.event_type IN ('remove', 'clear')
    )
    SELECT
      (SELECT COUNT(*)::int FROM sessions_with_add) AS sessions_with_add,
      (SELECT COUNT(*)::int FROM abandoned_sessions) AS abandoned_sessions
    `,
    [sinceParam.toISOString()]
  );

  const sessionsWithAdd = res.rows[0]?.sessions_with_add ?? 0;
  const abandonedSessions = res.rows[0]?.abandoned_sessions ?? 0;
  const rate = sessionsWithAdd > 0 ? (abandonedSessions / sessionsWithAdd) * 100 : 0;

  return {
    since: sinceParam.toISOString(),
    sessionsWithAdd,
    abandonedSessions,
    abandonmentRatePercent: Math.round(rate * 10) / 10, // 1 decimal
  };
}

module.exports = {
  ensureCartAnalyticsSchema,
  insertCartEvent,
  getCartAbandonment,
};

