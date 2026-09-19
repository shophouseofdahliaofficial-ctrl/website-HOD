const { query } = require('../config/database');

/** Subscriptions use UUID user_id (Supabase); legacy deliveries.user_id was INTEGER. */
async function migrateDeliveriesUserIdToUuidIfNeeded() {
  const result = await query(
    `SELECT data_type, udt_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'user_id'`,
  );
  const row = result.rows[0];
  if (!row) return;
  const isLegacyInt = row.data_type === 'integer' || row.udt_name === 'int4';
  if (!isLegacyInt) return;
  await query(`ALTER TABLE deliveries ALTER COLUMN user_id TYPE uuid USING (NULL::uuid)`);
}

async function ensureDeliveriesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS deliveries (
      id SERIAL PRIMARY KEY,
      delivery_schedule_id INTEGER NOT NULL REFERENCES delivery_schedules(id) ON DELETE CASCADE,
      user_id UUID,
      date DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered')),
      delivered_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (delivery_schedule_id, date)
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_deliveries_date_status ON deliveries(date, status);`);
  await migrateDeliveriesUserIdToUuidIfNeeded();
}

async function getDeliveriesForDate(date, slot) {
  const slotClause = slot === 'morning'
    ? `AND COALESCE(s.delivery_time, '00:00')::time < TIME '14:00'`
    : slot === 'evening'
      ? `AND COALESCE(s.delivery_time, '23:59')::time >= TIME '14:00'`
      : '';

  const result = await query(
    `
      SELECT
        ds.id,
        ds.subscription_id,
        ds.delivery_date,
        ds.status AS base_status,
        ds.delivered_at AS base_delivered_at,
        s.user_id,
        s.delivery_time,
        s.litres_per_day,
        s.is_trial,
        s.first_day_shift_applied AS sub_first_day_shift_applied,
        u.name AS user_name,
        u.email AS user_email,
        p.name AS product_name,
        pv.size AS product_variation_size,
        COALESCE(
          a.latitude::double precision,
          NULLIF(TRIM(co.delivery_address->>'latitude'), '')::double precision,
          NULLIF(TRIM(co_trial.delivery_address->>'latitude'), '')::double precision
        ) AS latitude,
        COALESCE(
          a.longitude::double precision,
          NULLIF(TRIM(co.delivery_address->>'longitude'), '')::double precision,
          NULLIF(TRIM(co_trial.delivery_address->>'longitude'), '')::double precision
        ) AS longitude,
        COALESCE(
          a.name,
          NULLIF(TRIM(co.delivery_address->>'name'), ''),
          NULLIF(TRIM(co_trial.delivery_address->>'name'), '')
        ) AS address_name,
        COALESCE(
          a.street,
          NULLIF(TRIM(co.delivery_address->>'street'), ''),
          NULLIF(TRIM(co_trial.delivery_address->>'street'), '')
        ) AS street,
        COALESCE(
          a.city,
          NULLIF(TRIM(co.delivery_address->>'city'), ''),
          NULLIF(TRIM(co_trial.delivery_address->>'city'), '')
        ) AS city,
        COALESCE(
          a.state,
          NULLIF(TRIM(co.delivery_address->>'state'), ''),
          NULLIF(TRIM(co_trial.delivery_address->>'state'), '')
        ) AS state,
        COALESCE(
          a.postal_code,
          NULLIF(TRIM(co.delivery_address->>'postalCode'), ''),
          NULLIF(TRIM(co.delivery_address->>'postal_code'), ''),
          NULLIF(TRIM(co_trial.delivery_address->>'postalCode'), ''),
          NULLIF(TRIM(co_trial.delivery_address->>'postal_code'), '')
        ) AS postal_code,
        COALESCE(
          a.country,
          NULLIF(TRIM(co.delivery_address->>'country'), ''),
          NULLIF(TRIM(co_trial.delivery_address->>'country'), '')
        ) AS country,
        COALESCE(
          a.phone,
          NULLIF(TRIM(co.delivery_address->>'phone'), ''),
          NULLIF(TRIM(co_trial.delivery_address->>'phone'), '')
        ) AS address_phone,
        s.trial_shifted,
        COALESCE(d.status, ds.status) AS status,
        COALESCE(d.delivered_at, ds.delivered_at) AS delivered_at
      FROM delivery_schedules ds
      JOIN subscriptions s ON s.id = ds.subscription_id
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN products p ON p.id = s.product_id
      LEFT JOIN product_variations pv ON pv.id = s.product_variation_id
      LEFT JOIN addresses a ON a.id = s.address_id
      LEFT JOIN orders co ON co.id = s.checkout_order_id AND co.user_id = s.user_id
      LEFT JOIN orders co_trial ON co_trial.id = s.trial_checkout_order_id AND co_trial.user_id = s.user_id
      LEFT JOIN deliveries d ON d.delivery_schedule_id = ds.id AND d.date = ds.delivery_date
      WHERE ds.delivery_date = $1
        AND (
          s.status = 'active'
          OR (s.status = 'pending' AND s.is_trial IS TRUE)
          OR (s.status = 'pending' AND s.checkout_order_id IS NOT NULL)
        )
        AND COALESCE(
          a.latitude::double precision,
          NULLIF(TRIM(co.delivery_address->>'latitude'), '')::double precision,
          NULLIF(TRIM(co_trial.delivery_address->>'latitude'), '')::double precision
        ) IS NOT NULL
        AND COALESCE(
          a.longitude::double precision,
          NULLIF(TRIM(co.delivery_address->>'longitude'), '')::double precision,
          NULLIF(TRIM(co_trial.delivery_address->>'longitude'), '')::double precision
        ) IS NOT NULL
        AND NOT (
          s.first_day_shift_applied IS TRUE
          AND ds.delivery_date = s.start_date
        )
        ${slotClause}
      ORDER BY COALESCE(s.delivery_time, '23:59')::time, ds.id
    `,
    [date]
  );

  return result.rows.map((row) => {
    return {
      id: row.id,
      subscriptionId: row.subscription_id,
      userId: row.user_id,
      userName: row.user_name || null,
      userEmail: row.user_email || null,
      date: row.delivery_date,
      deliveryTime: row.delivery_time || null,
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      status: row.status,
      deliveredAt: row.delivered_at || null,
      litresPerDay: row.litres_per_day != null ? Number(row.litres_per_day) : null,
      productName: row.product_name || null,
      productVariationSize: row.product_variation_size || null,
      addressName: row.address_name || null,
      street: row.street || null,
      city: row.city || null,
      state: row.state || null,
      postalCode: row.postal_code || null,
      country: row.country || null,
      userPhone: row.address_phone || null,
      trialShifted: Boolean(row.trial_shifted),
    };
  });
}

async function markDelivered({ deliveryId, date }) {
  await query(
    `
      INSERT INTO deliveries (delivery_schedule_id, user_id, date, status, delivered_at)
      SELECT ds.id, s.user_id, $2::date, 'delivered', NOW()
      FROM delivery_schedules ds
      JOIN subscriptions s ON s.id = ds.subscription_id
      WHERE ds.id = $1
      ON CONFLICT (delivery_schedule_id, date)
      DO UPDATE SET status = 'delivered', delivered_at = NOW(), updated_at = NOW()
    `,
    [deliveryId, date]
  );

  await query(
    `
      UPDATE delivery_schedules
      SET status = 'delivered',
          delivered_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `,
    [deliveryId]
  );
}

module.exports = {
  ensureDeliveriesTable,
  getDeliveriesForDate,
  markDelivered,
};

