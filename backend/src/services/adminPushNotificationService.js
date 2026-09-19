const fs = require('fs');
const admin = require('firebase-admin');
const { query } = require('../config/database');

let schemaEnsured = false;
let firebaseInitAttempted = false;
let firebaseInitError = null;
let firebaseApp = null;

function formatInr(amount) {
  const n = Number(amount || 0);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function buildProductLabel(productName, variationName) {
  const product = String(productName || '').trim() || 'Product';
  const variation = String(variationName || '').trim();
  return variation ? `${product} (${variation})` : product;
}

async function loadOrderNotificationDetails(order = {}) {
  const fallback = {
    customerName: String(order?.customerName || 'Customer'),
    productName: String(order?.productName || order?.orderNumber || order?.id || 'Order'),
    variationName: String(order?.variationName || ''),
    total: Number(order?.total || 0),
    containsSubscription: Boolean(order?.containsSubscription),
  };
  if (!order?.id) return fallback;

  try {
    const result = await query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(u.name), ''), 'Customer') AS customer_name,
        COALESCE(NULLIF(TRIM(oi.product_name), ''), o.order_number::text, o.id::text, 'Order') AS product_name,
        COALESCE(NULLIF(TRIM(oi.variation_size), ''), '') AS variation_name,
        COALESCE(o.total, 0) AS total,
        (COALESCE(NULLIF(TRIM(oi.product_name), ''), '') ILIKE 'Subscription for %') AS is_subscription_item
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN LATERAL (
        SELECT product_name, variation_size
        FROM order_items
        WHERE order_id = o.id
        ORDER BY id ASC
        LIMIT 1
      ) oi ON TRUE
      WHERE o.id = $1
      LIMIT 1
      `,
      [order.id]
    );
    const row = result.rows[0];
    if (!row) return fallback;
    return {
      customerName: row.customer_name,
      productName: row.product_name,
      variationName: row.variation_name,
      total: Number(row.total || 0),
      containsSubscription: Boolean(order?.containsSubscription || row.is_subscription_item),
    };
  } catch (error) {
    console.error('[admin-push] Failed to load order notification details:', error?.message || error);
    return fallback;
  }
}

async function loadSubscriptionNotificationDetails(subscription = {}) {
  const fallback = {
    customerName: String(subscription?.customerName || 'Customer'),
    productName: String(subscription?.productName || 'Subscription'),
    variationName: String(subscription?.variationName || subscription?.productVariationSize || ''),
    total: Number(subscription?.total || subscription?.totalAmountPaid || subscription?.totalAmount || 0),
  };
  if (!subscription?.id) return fallback;

  try {
    const result = await query(
      `
      SELECT
        COALESCE(NULLIF(TRIM(u.name), ''), 'Customer') AS customer_name,
        COALESCE(NULLIF(TRIM(p.name), ''), 'Subscription') AS product_name,
        COALESCE(NULLIF(TRIM(pv.size), ''), '') AS variation_name,
        COALESCE(s.total_amount_paid, s.total_amount, 0) AS total
      FROM subscriptions s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN products p ON p.id = s.product_id
      LEFT JOIN product_variations pv ON pv.id = s.product_variation_id
      WHERE s.id = $1
      LIMIT 1
      `,
      [subscription.id]
    );
    const row = result.rows[0];
    if (!row) return fallback;
    return {
      customerName: row.customer_name,
      productName: row.product_name,
      variationName: row.variation_name,
      total: Number(row.total || 0),
    };
  } catch (error) {
    console.error('[admin-push] Failed to load subscription notification details:', error?.message || error);
    return fallback;
  }
}

async function ensurePushSchema() {
  if (schemaEnsured) return;

  await query(`
    CREATE TABLE IF NOT EXISTS admin_push_tokens (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      token TEXT NOT NULL UNIQUE,
      platform VARCHAR(32) NOT NULL DEFAULT 'android',
      app_name VARCHAR(64),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      disabled_at TIMESTAMPTZ,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_notification_events (
      event_key TEXT PRIMARY KEY,
      kind VARCHAR(64) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(
    `CREATE INDEX IF NOT EXISTS idx_admin_push_tokens_active ON admin_push_tokens(disabled_at, last_seen_at DESC);`
  );

  schemaEnsured = true;
}

function parseServiceAccountFromEnv() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const raw = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    return JSON.parse(raw);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const raw = fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8');
    return JSON.parse(raw);
  }

  return null;
}

function getMessaging() {
  if (firebaseApp) {
    return admin.messaging(firebaseApp);
  }

  if (firebaseInitAttempted) {
    return null;
  }

  firebaseInitAttempted = true;

  try {
    const serviceAccount = parseServiceAccountFromEnv();
    if (!serviceAccount) {
      firebaseInitError =
        'Missing Firebase service account. Set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_BASE64, or FIREBASE_SERVICE_ACCOUNT_PATH.';
      return null;
    }

    firebaseApp = admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

    firebaseInitError = null;
    return admin.messaging(firebaseApp);
  } catch (error) {
    firebaseInitError = error.message || 'Failed to initialize Firebase Admin';
    console.error('[admin-push] Firebase init failed:', error);
    return null;
  }
}

function getFirebaseStatus() {
  const messaging = getMessaging();
  return {
    configured: Boolean(messaging),
    error: firebaseInitError,
  };
}

async function upsertAdminPushToken({ userId, token, platform = 'android', appName = 'admin-app' }) {
  await ensurePushSchema();
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    throw new Error('Push token is required');
  }

  const result = await query(
    `
    INSERT INTO admin_push_tokens (user_id, token, platform, app_name, last_seen_at, updated_at, disabled_at, last_error)
    VALUES ($1, $2, $3, $4, NOW(), NOW(), NULL, NULL)
    ON CONFLICT (token) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      platform = EXCLUDED.platform,
      app_name = EXCLUDED.app_name,
      last_seen_at = NOW(),
      updated_at = NOW(),
      disabled_at = NULL,
      last_error = NULL
    RETURNING id, user_id, token, platform, app_name, last_seen_at, disabled_at, created_at, updated_at
    `,
    [userId || null, normalizedToken, String(platform || 'android'), String(appName || 'admin-app')]
  );

  return result.rows[0];
}

async function listActiveAdminTokens() {
  await ensurePushSchema();
  const result = await query(
    `
    SELECT t.token
    FROM admin_push_tokens t
    INNER JOIN users u ON u.id = t.user_id
    WHERE t.disabled_at IS NULL
      AND LOWER(COALESCE(u.role, 'customer')) = 'admin'
    ORDER BY t.last_seen_at DESC, t.updated_at DESC
    `
  );

  return result.rows.map((row) => row.token).filter(Boolean);
}

async function disablePushToken(token, reason) {
  await ensurePushSchema();
  await query(
    `
    UPDATE admin_push_tokens
    SET disabled_at = NOW(), updated_at = NOW(), last_error = $2
    WHERE token = $1
    `,
    [token, reason || null]
  );
}

async function reserveEvent(eventKey, kind) {
  await ensurePushSchema();
  if (!eventKey) return true;

  const result = await query(
    `
    INSERT INTO admin_notification_events (event_key, kind)
    VALUES ($1, $2)
    ON CONFLICT (event_key) DO NOTHING
    RETURNING event_key
    `,
    [eventKey, kind]
  );

  return result.rows.length > 0;
}

async function sendPushToTokens(tokens, payload) {
  const uniqueTokens = Array.from(new Set((tokens || []).map((t) => String(t || '').trim()).filter(Boolean)));
  if (uniqueTokens.length === 0) {
    return {
      success: false,
      skipped: true,
      reason: 'no_tokens',
      successCount: 0,
      failureCount: 0,
    };
  }

  const messaging = getMessaging();
  if (!messaging) {
    return {
      success: false,
      skipped: true,
      reason: 'firebase_not_configured',
      error: firebaseInitError,
      successCount: 0,
      failureCount: 0,
    };
  }

  const response = await messaging.sendEachForMulticast({
    tokens: uniqueTokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: Object.fromEntries(
      Object.entries(payload.data || {}).map(([key, value]) => [key, value == null ? '' : String(value)])
    ),
    android: {
      priority: 'high',
      notification: {
        channelId: 'milko_notifications_admin',
        sound: 'default',
      },
    },
  });

  await Promise.all(
    response.responses.map(async (item, index) => {
      if (item.success) return;
      const code = item.error?.code || 'unknown';
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        await disablePushToken(uniqueTokens[index], code);
      }
    })
  );

  return {
    success: response.successCount > 0,
    successCount: response.successCount,
    failureCount: response.failureCount,
    responses: response.responses.map((item, index) => ({
      token: uniqueTokens[index],
      success: item.success,
      error: item.error ? { code: item.error.code, message: item.error.message } : null,
    })),
  };
}

async function notifyAdminsAboutOrder(order, options = {}) {
  const reserved = await reserveEvent(options.eventKey || null, 'order');
  if (!reserved) {
    return { success: true, deduped: true };
  }

  const tokens = await listActiveAdminTokens();
  const details = await loadOrderNotificationDetails(order);
  const title = 'New customer order';
  const entity = details.containsSubscription ? 'subscription' : 'order';
  const body = `${details.customerName} placed a ${entity} for ${buildProductLabel(details.productName, details.variationName)} for Rs. ${formatInr(details.total)}`;

  return sendPushToTokens(tokens, {
    title,
    body,
    data: {
      type: 'admin_new_order',
      orderId: order?.id || '',
      orderNumber: order?.orderNumber || '',
      paymentStatus: order?.paymentStatus || '',
      containsSubscription: order?.containsSubscription ? 'true' : 'false',
    },
  });
}

async function notifyAdminsAboutSubscription(subscription, options = {}) {
  const reserved = await reserveEvent(options.eventKey || null, 'subscription');
  if (!reserved) {
    return { success: true, deduped: true };
  }

  const tokens = await listActiveAdminTokens();
  const details = await loadSubscriptionNotificationDetails(subscription);
  const isTrial = Boolean(options.isTrial);
  const title = isTrial ? 'New trial subscription' : 'New subscription started';
  const verb = isTrial ? 'started a trial for' : 'placed a subscription for';
  return sendPushToTokens(tokens, {
    title,
    body: `${details.customerName} ${verb} ${buildProductLabel(details.productName, details.variationName)} for Rs. ${formatInr(details.total)}`,
    data: {
      type: 'admin_new_subscription',
      subscriptionId: subscription?.id || '',
      productId: subscription?.productId || '',
      productName: subscription?.productName || '',
      userId: subscription?.userId || '',
      status: subscription?.status || '',
      isTrial: isTrial ? 'true' : 'false',
    },
  });
}

async function sendTestPushToAdmins({ title, body, data = {} }) {
  const tokens = await listActiveAdminTokens();
  return sendPushToTokens(tokens, {
    title: title || 'Milko admin test notification',
    body: body || 'Test push from Milko backend',
    data: {
      type: 'admin_test',
      ...data,
    },
  });
}

module.exports = {
  ensurePushSchema,
  getFirebaseStatus,
  upsertAdminPushToken,
  listActiveAdminTokens,
  notifyAdminsAboutOrder,
  notifyAdminsAboutSubscription,
  sendTestPushToAdmins,
};
