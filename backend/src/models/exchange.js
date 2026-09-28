const { query, getClient } = require('../config/database');

let schemaEnsured = false;

async function ensureExchangeSchema() {
  if (schemaEnsured) return;

  await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

  // Detect orders.id and users.id data types to prevent incompatible foreign key constraint error (UUID vs INTEGER)
  let orderIdType = 'TEXT';
  try {
    const colRes = await query(`
      SELECT udt_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'id'
      LIMIT 1
    `);
    if (colRes.rows && colRes.rows.length > 0) {
      const udt = (colRes.rows[0].udt_name || '').toLowerCase();
      if (udt === 'int4' || udt === 'int8' || udt === 'integer' || udt === 'bigint') {
        orderIdType = 'INTEGER';
      } else if (udt === 'uuid') {
        orderIdType = 'UUID';
      } else {
        orderIdType = 'TEXT';
      }
    }
  } catch (err) {
    console.warn('[exchange.js] Failed to query orders.id type:', err.message);
  }

  let userIdType = 'TEXT';
  try {
    const colRes = await query(`
      SELECT udt_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'id'
      LIMIT 1
    `);
    if (colRes.rows && colRes.rows.length > 0) {
      const udt = (colRes.rows[0].udt_name || '').toLowerCase();
      if (udt === 'int4' || udt === 'int8' || udt === 'integer' || udt === 'bigint') {
        userIdType = 'INTEGER';
      } else if (udt === 'uuid') {
        userIdType = 'UUID';
      } else {
        userIdType = 'TEXT';
      }
    }
  } catch (err) {
    console.warn('[exchange.js] Failed to query users.id type:', err.message);
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS order_exchanges (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id ${orderIdType} NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        user_id ${userIdType} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_number TEXT NOT NULL,
        item_id TEXT,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        original_variation TEXT,
        original_unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 1,
        requested_item_name TEXT,
        requested_variation TEXT,
        requested_unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        price_difference DECIMAL(10, 2) NOT NULL DEFAULT 0,
        reason TEXT NOT NULL,
        customer_message TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
        rejection_reason TEXT,
        admin_note TEXT,
        payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'waived', 'not_required')),
        payment_method TEXT CHECK (payment_method IN ('wallet', 'online', 'free', 'wallet_refund')),
        payment_reference TEXT,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        approved_at TIMESTAMPTZ,
        rejected_at TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } catch (schemaErr) {
    console.warn('[exchange.js] FK creation failed for order_exchanges, creating without inline constraint:', schemaErr.message);
    await query(`
      CREATE TABLE IF NOT EXISTS order_exchanges (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id ${orderIdType} NOT NULL,
        user_id ${userIdType} NOT NULL,
        order_number TEXT NOT NULL,
        item_id TEXT,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        original_variation TEXT,
        original_unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 1,
        requested_item_name TEXT,
        requested_variation TEXT,
        requested_unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        price_difference DECIMAL(10, 2) NOT NULL DEFAULT 0,
        reason TEXT NOT NULL,
        customer_message TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
        rejection_reason TEXT,
        admin_note TEXT,
        payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'waived', 'not_required')),
        payment_method TEXT CHECK (payment_method IN ('wallet', 'online', 'free', 'wallet_refund')),
        payment_reference TEXT,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        approved_at TIMESTAMPTZ,
        rejected_at TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `).catch(() => {});
  }

  // Ensure schema migrations for reverse logistics, manual replacement dispatch, and multi-item exchanges
  await query(`ALTER TABLE order_exchanges ADD COLUMN IF NOT EXISTS exchange_items JSONB;`).catch(() => {});
  await query(`ALTER TABLE order_exchanges ADD COLUMN IF NOT EXISTS return_received_at TIMESTAMPTZ;`).catch(() => {});
  await query(`ALTER TABLE order_exchanges ADD COLUMN IF NOT EXISTS return_verified_at TIMESTAMPTZ;`).catch(() => {});
  await query(`ALTER TABLE order_exchanges ADD COLUMN IF NOT EXISTS replacement_waybill TEXT;`).catch(() => {});
  await query(`ALTER TABLE order_exchanges ADD COLUMN IF NOT EXISTS replacement_status TEXT;`).catch(() => {});
  await query(`ALTER TABLE order_exchanges ADD COLUMN IF NOT EXISTS replacement_tracking_url TEXT;`).catch(() => {});
  await query(`ALTER TABLE order_exchanges ADD COLUMN IF NOT EXISTS replacement_dispatched_at TIMESTAMPTZ;`).catch(() => {});
  await query(`ALTER TABLE order_exchanges ADD COLUMN IF NOT EXISTS replacement_delivered_at TIMESTAMPTZ;`).catch(() => {});

  // Ensure any necessary indexes exist
  await query(`CREATE INDEX IF NOT EXISTS idx_order_exchanges_order_id ON order_exchanges(order_id);`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_order_exchanges_user_id ON order_exchanges(user_id);`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_order_exchanges_status ON order_exchanges(status);`).catch(() => {});

  schemaEnsured = true;
}

function transformExchange(row) {
  if (!row) return null;
  let parsedExchangeItems = null;
  if (row.exchange_items) {
    parsedExchangeItems = typeof row.exchange_items === 'string' ? JSON.parse(row.exchange_items) : row.exchange_items;
  }

  return {
    id: row.id,
    orderId: row.order_id,
    userId: row.user_id,
    orderNumber: row.order_number,
    itemId: row.item_id,
    productId: row.product_id,
    productName: row.product_name,
    originalVariation: row.original_variation,
    originalUnitPrice: row.original_unit_price != null ? parseFloat(row.original_unit_price) : 0,
    quantity: row.quantity || 1,
    requestedItemName: row.requested_item_name || row.product_name,
    requestedVariation: row.requested_variation,
    requestedUnitPrice: row.requested_unit_price != null ? parseFloat(row.requested_unit_price) : 0,
    priceDifference: row.price_difference != null ? parseFloat(row.price_difference) : 0,
    exchangeItems: parsedExchangeItems,
    reason: row.reason,
    customerMessage: row.customer_message,
    status: row.status,
    rejectionReason: row.rejection_reason,
    approvalMessage: row.approval_message,
    adminNote: row.admin_note,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    requestedAt: row.requested_at ? new Date(row.requested_at).toISOString() : null,
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at).toISOString() : null,
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    reverseWaybill: row.reverse_waybill || null,
    reverseStatus: row.reverse_status || null,
    reverseTrackingUrl: row.reverse_tracking_url || (row.reverse_waybill ? `https://www.delhivery.com/track/package/${row.reverse_waybill}` : null),
    reversePickupScheduledAt: row.reverse_pickup_scheduled_at ? new Date(row.reverse_pickup_scheduled_at).toISOString() : null,
    returnReceivedAt: row.return_received_at ? new Date(row.return_received_at).toISOString() : null,
    returnVerifiedAt: row.return_verified_at ? new Date(row.return_verified_at).toISOString() : null,
    replacementWaybill: row.replacement_waybill || null,
    replacementStatus: row.replacement_status || null,
    replacementTrackingUrl: row.replacement_tracking_url || (row.replacement_waybill ? `https://www.delhivery.com/track/package/${row.replacement_waybill}` : null),
    replacementDispatchedAt: row.replacement_dispatched_at ? new Date(row.replacement_dispatched_at).toISOString() : null,
    replacementDeliveredAt: row.replacement_delivered_at ? new Date(row.replacement_delivered_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    // Joined customer/order data if present
    customerName: row.customer_name || null,
    customerEmail: row.customer_email || null,
    customerPhone: row.customer_phone || null,
    orderCreatedAt: row.order_created_at ? new Date(row.order_created_at).toISOString() : null,
    orderDeliveredAt: row.order_delivered_at ? new Date(row.order_delivered_at).toISOString() : null,
  };
}

const exchangeModel = {
  ensureExchangeSchema,

  async createExchange(data) {
    await ensureExchangeSchema();
    const {
      orderId,
      userId,
      orderNumber,
      itemId,
      productId,
      productName,
      originalVariation,
      originalUnitPrice = 0,
      quantity = 1,
      requestedItemName,
      requestedVariation,
      requestedUnitPrice = 0,
      priceDifference = 0,
      exchangeItems = null,
      reason,
      customerMessage,
    } = data;

    const res = await query(
      `
      INSERT INTO order_exchanges (
        order_id, user_id, order_number, item_id, product_id,
        product_name, original_variation, original_unit_price, quantity,
        requested_item_name, requested_variation, requested_unit_price, price_difference,
        exchange_items, reason, customer_message, status, payment_status, requested_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'pending', 'pending', NOW(), NOW())
      RETURNING *
      `,
      [
        orderId,
        userId,
        orderNumber,
        itemId || null,
        productId || null,
        productName || 'Product',
        originalVariation || null,
        originalUnitPrice,
        quantity,
        requestedItemName || productName,
        requestedVariation || null,
        requestedUnitPrice,
        priceDifference,
        exchangeItems ? JSON.stringify(exchangeItems) : null,
        reason,
        customerMessage || null,
      ]
    );

    return transformExchange(res.rows[0]);
  },

  async getExchangeByOrderId(orderId, userId = null) {
    await ensureExchangeSchema();
    let q = `SELECT * FROM order_exchanges WHERE order_id::text = $1::text`;
    const params = [String(orderId)];
    if (userId) {
      q += ` AND user_id::text = $2::text`;
      params.push(String(userId));
    }
    q += ` ORDER BY created_at DESC LIMIT 1`;
    const res = await query(q, params);
    return transformExchange(res.rows[0]);
  },

  async getExchangeById(id) {
    await ensureExchangeSchema();
    const res = await query(
      `
      SELECT e.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
             o.created_at as order_created_at, o.delivered_at as order_delivered_at
      FROM order_exchanges e
      LEFT JOIN users u ON e.user_id::text = u.id::text
      LEFT JOIN orders o ON e.order_id::text = o.id::text
      WHERE e.id::text = $1::text
      `,
      [String(id)]
    );
    return transformExchange(res.rows[0]);
  },

  async getAllExchanges({ status, search, limit = 50, offset = 0 } = {}) {
    await ensureExchangeSchema();
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (status && status !== 'all') {
      if (status === 'pending') {
        conditions.push(`(e.status NOT IN ('completed', 'rejected', 'cancelled') AND COALESCE(e.replacement_status, '') != 'Delivered' AND e.replacement_delivered_at IS NULL)`);
      } else if (status === 'approved') {
        conditions.push(`(e.status = 'approved' AND COALESCE(e.replacement_status, '') != 'Delivered' AND e.replacement_delivered_at IS NULL)`);
      } else if (status === 'completed') {
        conditions.push(`(e.status = 'completed' OR e.replacement_status = 'Delivered' OR e.replacement_delivered_at IS NOT NULL)`);
      } else if (status === 'rejected') {
        conditions.push(`e.status IN ('rejected', 'cancelled')`);
      } else {
        conditions.push(`e.status = $${paramIdx++}`);
        params.push(status);
      }
    }

    if (search && String(search).trim()) {
      let rawTerm = String(search).trim().toLowerCase();
      let strippedTerm = rawTerm;
      while (strippedTerm.startsWith('#')) {
        strippedTerm = strippedTerm.slice(1).trim();
      }

      const termPattern = `%${rawTerm}%`;
      const strippedPattern = `%${strippedTerm}%`;

      conditions.push(
        `(
          LOWER(e.order_number) LIKE $${paramIdx} 
          OR ('#' || LOWER(e.order_number)) LIKE $${paramIdx}
          OR LOWER(e.order_number) LIKE $${paramIdx + 1}
          OR LOWER(u.name) LIKE $${paramIdx}
          OR LOWER(u.name) LIKE $${paramIdx + 1}
          OR LOWER(u.email) LIKE $${paramIdx}
          OR LOWER(e.product_name) LIKE $${paramIdx}
          OR LOWER(e.product_name) LIKE $${paramIdx + 1}
          OR LOWER(COALESCE(e.exchange_items::text, '')) LIKE $${paramIdx}
          OR LOWER(COALESCE(e.exchange_items::text, '')) LIKE $${paramIdx + 1}
          OR LOWER(COALESCE(e.replacement_waybill, '')) LIKE $${paramIdx}
          OR LOWER(COALESCE(e.replacement_waybill, '')) LIKE $${paramIdx + 1}
          OR LOWER(COALESCE(e.reverse_waybill, '')) LIKE $${paramIdx}
          OR LOWER(COALESCE(e.reverse_waybill, '')) LIKE $${paramIdx + 1}
        )`
      );
      params.push(termPattern, strippedPattern);
      paramIdx += 2;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(
      `
      SELECT COUNT(*) as total
      FROM order_exchanges e
      LEFT JOIN users u ON e.user_id::text = u.id::text
      ${whereClause}
      `,
      params
    );

    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const listRes = await query(
      `
      SELECT e.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
             o.created_at as order_created_at, o.delivered_at as order_delivered_at
      FROM order_exchanges e
      LEFT JOIN users u ON e.user_id::text = u.id::text
      LEFT JOIN orders o ON e.order_id::text = o.id::text
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
      `,
      [...params, limit, offset]
    );

    return {
      total,
      exchanges: listRes.rows.map(transformExchange),
    };
  },

  async getPendingCount() {
    await ensureExchangeSchema();
    const res = await query(
      `SELECT COUNT(*) as count FROM order_exchanges WHERE status NOT IN ('completed', 'rejected', 'cancelled') AND COALESCE(replacement_status, '') != 'Delivered' AND replacement_delivered_at IS NULL`
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  },

  async approveExchange(id, { priceDifference, requestedVariation, requestedUnitPrice, approvalMessage, adminNote, reverseWaybill, reverseStatus, reverseTrackingUrl, reversePickupScheduledAt } = {}) {
    await ensureExchangeSchema();
    const updates = [`status = 'approved'`, `approved_at = NOW()`, `updated_at = NOW()`];
    const params = [id];
    let paramIdx = 2;

    if (priceDifference !== undefined) {
      updates.push(`price_difference = $${paramIdx++}`);
      params.push(priceDifference);
      if (Number(priceDifference) === 0) {
        updates.push(`payment_status = 'not_required'`);
      }
    }
    if (requestedVariation !== undefined) {
      updates.push(`requested_variation = $${paramIdx++}`);
      params.push(requestedVariation);
    }
    if (requestedUnitPrice !== undefined) {
      updates.push(`requested_unit_price = $${paramIdx++}`);
      params.push(requestedUnitPrice);
    }
    if (approvalMessage !== undefined) {
      updates.push(`approval_message = $${paramIdx++}`);
      params.push(approvalMessage);
    }
    if (adminNote !== undefined) {
      updates.push(`admin_note = $${paramIdx++}`);
      params.push(adminNote);
    }
    if (reverseWaybill !== undefined) {
      updates.push(`reverse_waybill = $${paramIdx++}`);
      params.push(reverseWaybill);
    }
    if (reverseStatus !== undefined) {
      updates.push(`reverse_status = $${paramIdx++}`);
      params.push(reverseStatus);
    }
    if (reverseTrackingUrl !== undefined) {
      updates.push(`reverse_tracking_url = $${paramIdx++}`);
      params.push(reverseTrackingUrl);
    }
    if (reversePickupScheduledAt !== undefined) {
      updates.push(`reverse_pickup_scheduled_at = $${paramIdx++}`);
      params.push(reversePickupScheduledAt);
    }

    const res = await query(
      `UPDATE order_exchanges SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return transformExchange(res.rows[0]);
  },

  async rejectExchange(id, { rejectionReason, adminNote }) {
    await ensureExchangeSchema();
    const res = await query(
      `
      UPDATE order_exchanges
      SET status = 'rejected',
          rejection_reason = $2,
          admin_note = COALESCE($3, admin_note),
          rejected_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id, rejectionReason || 'Exchange request rejected by administrator', adminNote || null]
    );
    return transformExchange(res.rows[0]);
  },

  async completeExchangePayment(id, { paymentStatus, paymentMethod, paymentReference, reverseWaybill, reverseStatus, reverseTrackingUrl, reversePickupScheduledAt } = {}) {
    await ensureExchangeSchema();
    const updates = [
      `status = 'approved'`,
      `payment_status = $2`,
      `payment_method = $3`,
      `payment_reference = $4`,
      `paid_at = NOW()`,
      `updated_at = NOW()`,
    ];
    const params = [id, paymentStatus || 'paid', paymentMethod || 'wallet', paymentReference || null];
    let paramIdx = 5;

    if (reverseWaybill !== undefined) {
      updates.push(`reverse_waybill = $${paramIdx++}`);
      params.push(reverseWaybill);
    }
    if (reverseStatus !== undefined) {
      updates.push(`reverse_status = $${paramIdx++}`);
      params.push(reverseStatus);
    }
    if (reverseTrackingUrl !== undefined) {
      updates.push(`reverse_tracking_url = $${paramIdx++}`);
      params.push(reverseTrackingUrl);
    }
    if (reversePickupScheduledAt !== undefined) {
      updates.push(`reverse_pickup_scheduled_at = $${paramIdx++}`);
      params.push(reversePickupScheduledAt);
    }

    const res = await query(
      `UPDATE order_exchanges SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return transformExchange(res.rows[0]);
  },

  async markReturnReceived(id, { adminNote } = {}) {
    await ensureExchangeSchema();
    const updates = [
      `return_received_at = NOW()`,
      `reverse_status = 'Received at Origin Warehouse'`,
      `updated_at = NOW()`
    ];
    const params = [id];
    let paramIdx = 2;

    if (adminNote !== undefined) {
      updates.push(`admin_note = $${paramIdx++}`);
      params.push(adminNote);
    }

    const res = await query(
      `UPDATE order_exchanges SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return transformExchange(res.rows[0]);
  },

  async markReturnVerified(id, { adminNote } = {}) {
    await ensureExchangeSchema();
    const updates = [
      `return_verified_at = NOW()`,
      `reverse_status = 'Quality Check & Verification Passed'`,
      `updated_at = NOW()`
    ];
    const params = [id];
    let paramIdx = 2;

    if (adminNote !== undefined) {
      updates.push(`admin_note = $${paramIdx++}`);
      params.push(adminNote);
    }

    const res = await query(
      `UPDATE order_exchanges SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return transformExchange(res.rows[0]);
  },

  async dispatchReplacement(id, { replacementWaybill, replacementStatus, replacementTrackingUrl, adminNote } = {}) {
    await ensureExchangeSchema();
    const updates = [
      `replacement_dispatched_at = NOW()`,
      `replacement_status = $2`,
      `replacement_waybill = $3`,
      `replacement_tracking_url = $4`,
      `updated_at = NOW()`
    ];
    const params = [
      id,
      replacementStatus || 'Dispatched',
      replacementWaybill,
      replacementTrackingUrl || (replacementWaybill ? `https://www.delhivery.com/track/package/${replacementWaybill}` : null)
    ];
    let paramIdx = 5;

    if (adminNote !== undefined) {
      updates.push(`admin_note = $${paramIdx++}`);
      params.push(adminNote);
    }

    const res = await query(
      `UPDATE order_exchanges SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return transformExchange(res.rows[0]);
  },

  async markReplacementDelivered(id, { deliveredAt, adminNote } = {}) {
    await ensureExchangeSchema();
    const updates = [
      `status = 'completed'`,
      `replacement_delivered_at = COALESCE($2, NOW())`,
      `replacement_status = 'Delivered'`,
      `updated_at = NOW()`
    ];
    const params = [id, deliveredAt || null];
    let paramIdx = 3;

    if (adminNote !== undefined) {
      updates.push(`admin_note = $${paramIdx++}`);
      params.push(adminNote);
    }

    const res = await query(
      `UPDATE order_exchanges SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return transformExchange(res.rows[0]);
  },
};

module.exports = exchangeModel;
