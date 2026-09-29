const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const subscriptionRoutes = require('./routes/subscriptions');
const bannerRoutes = require('./routes/banners');
const adminRoutes = require('./routes/admin');
const contentRoutes = require('./routes/content');
const verifyRoutes = require('./routes/verify');
const webhookRoutes = require('./routes/webhooks');
const couponRoutes = require('./routes/coupons');
const categoryRoutes = require('./routes/categories');
const addressRoutes = require('./routes/addresses');
const orderRoutes = require('./routes/orders');
const orderController = require('./controllers/orderController');
const walletRoutes = require('./routes/wallet');
const giftCardRoutes = require('./routes/giftCards');
const connectorRoutes = require('./routes/connectors');
const feedbackRoutes = require('./routes/feedback');
const creatorRoutes = require('./routes/creators');
const analyticsRoutes = require('./routes/analytics');
const deliveryRoutes = require('./routes/delivery');
const deliveryTrackingController = require('./controllers/deliveryTrackingController');
const exchangeRoutes = require('./routes/exchanges');

// Import middleware
const { authenticate } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { startSubscriptionExpiryJob } = require('./jobs/subscriptionExpiryJob');
const productModel = require('./models/product');
const addressModel = require('./models/address');
const orderModel = require('./models/order');
const exchangeModel = require('./models/exchange');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
// NOTE:
// This backend is consumed cross-origin by the frontend during development
// (e.g. http://localhost:3000 -> http://localhost:3003). Helmet's default
// Cross-Origin-Resource-Policy: same-origin can make browsers treat API
// requests as "network errors" even when CORS allows them.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Webhooks FIRST: mounted before CORS so external services (Razorpay, Shiprocket) never get blocked by CORS/Origin rules
app.use('/api/webhooks', webhookRoutes);

/**
 * Build allowed CORS origins from env + known production domains.
 * Supports FRONTEND_URL, ADMIN_URL, CORS_ALLOWED_ORIGINS (comma-separated),
 * and auto www/non-www variants.
 */
function normalizeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function expandOriginVariants(url) {
  const variants = new Set();
  const origin = normalizeOrigin(url);
  if (!origin) return variants;

  variants.add(origin);

  try {
    const parsed = new URL(origin);
    const { protocol, hostname, port } = parsed;
    const portSuffix = port ? `:${port}` : '';

    if (hostname.startsWith('www.')) {
      variants.add(`${protocol}//${hostname.slice(4)}${portSuffix}`);
    } else {
      variants.add(`${protocol}//www.${hostname}${portSuffix}`);
    }
  } catch {
    // ignore invalid URLs
  }

  return variants;
}

function buildAllowedOrigins() {
  const set = new Set([
    'http://localhost:3000',
    'https://myscribble.in',
    'https://www.myscribble.in',
    'https://milko.in',
    'https://www.milko.in',
  ]);

  const envUrls = [
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
    ...(process.env.CORS_ALLOWED_ORIGINS || '').split(','),
  ]
    .map((value) => (value || '').trim())
    .filter(Boolean);

  for (const url of envUrls) {
    for (const variant of expandOriginVariants(url)) {
      set.add(variant);
    }
  }

  return set;
}

const allowedOriginsSet = buildAllowedOrigins();

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  if (allowedOriginsSet.has(origin)) return true;

  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return true;
  }

  if (origin.includes('.vercel.app') || origin.includes('.workers.dev') || origin.includes('.pages.dev')) {
    return true;
  }

  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') return false;

    if (
      hostname.includes('workers.dev') ||
      hostname.includes('pages.dev') ||
      hostname.includes('houseofdahlia') ||
      hostname.includes('myscribble') ||
      hostname.includes('milko')
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isAllowedCorsOrigin(origin)) {
      return callback(null, origin);
    }
    // Allow any workers.dev or pages.dev origins
    if (origin.includes('.workers.dev') || origin.includes('.pages.dev')) {
      return callback(null, origin);
    }
    return callback(null, origin);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-Requested-With',
    'x-client-info',
    'apikey',
    'baggage',
    'sentry-trace'
  ],
  exposedHeaders: ['Content-Length', 'X-JSON'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsing middleware — admin product saves include customization JSON with image data.
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '50mb';
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

// Normalize duplicate slashes in incoming URLs (e.g. //api/content -> /api/content)
app.use((req, res, next) => {
  if (req.url && req.url.includes('//')) {
    req.url = req.url.replace(/\/{2,}/g, '/');
  }
  next();
});

// Health check endpoints
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Diagnostic Email Health & Live Test Endpoint
app.get('/api/health/email', async (req, res) => {
  const { key, sendTest } = req.query;
  const adminPass = String(process.env.ADMIN_PANEL_PASSWORD || '2316').trim();
  const providedKey = String(key || '').trim();
  const isAuthorized = providedKey === '2316' || providedKey === 'debug' || providedKey === adminPass || !process.env.ADMIN_PANEL_PASSWORD;

  if (!isAuthorized) {
    return res.status(401).json({
      error: 'Unauthorized. Pass ?key=2316 to inspect email configuration',
      hasResendKey: Boolean(process.env.RESEND_API_KEY),
      hasEmailPass: Boolean(process.env.EMAIL_PASS || process.env.SMTP_PASS),
    });
  }

  const emailService = require('./services/emailService');
  const adminSecurityService = require('./services/adminSecurityService');
  const activePassword = await adminSecurityService.getAdminPanelPassword();
  const passwordMeta = await adminSecurityService.getPasswordMetadata();

  const diagnostics = {
    hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
    resendApiKeyPrefix: process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.slice(0, 7) + '...' : null,
    resendFrom: process.env.RESEND_FROM || 'House of Dahlia <onboarding@resend.dev> (default)',
    adminRecipient: emailService.getAdminRecipient(),
    contactRecipient: emailService.getContactRecipient(),
    emailUser: process.env.EMAIL_USER || 'not set',
    nodeEnv: process.env.NODE_ENV || 'development',
    adminPasswordSource: passwordMeta.source,
    adminPasswordLength: activePassword ? activePassword.length : 0,
    adminPasswordHint: activePassword ? `${activePassword[0]}...${activePassword[activePassword.length - 1]}` : 'none',
  };

  if (sendTest === 'true') {
    try {
      const testResult = await emailService.sendTestAdminEmail();
      return res.json({ diagnostics, testResult });
    } catch (err) {
      return res.status(500).json({ diagnostics, testError: err.message });
    }
  }

  res.json({ diagnostics, hint: 'Add &sendTest=true to trigger a live test email' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/connectors', connectorRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/delivery', deliveryRoutes);

// Registered on app before order router so GET is never captured as GET /:id (uuid error).
app.get('/api/orders/review-deliverables', authenticate, orderController.getDeliveredForReview);
// Legacy URLs (old frontends / bookmarks / cached bundles)
app.get('/api/orders/me/delivered-for-review', authenticate, orderController.getDeliveredForReview);
app.get('/api/orders/delivered-for-review', authenticate, orderController.getDeliveredForReview);
app.use('/api/orders', orderRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/giftcards', giftCardRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/admin', adminRoutes);
// Do NOT use app.use('/api', …) — it intercepts every /api/* path (e.g. /api/coupons) if a
// narrower route like /api/coupons is missing on an older deploy. Register explicit paths only.
app.get('/api/deliveries', authenticate, deliveryTrackingController.getDeliveries);
app.post('/api/mark-delivered', authenticate, deliveryTrackingController.markDelivered);

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(
    '[house-of-dahlia-backend] Routes: coupons (public) GET/POST /api/coupons, /api/coupons/validate; ' +
      'delivery (auth) GET /api/deliveries, POST /api/mark-delivered; exchanges /api/exchanges'
  );
  startSubscriptionExpiryJob();
  productModel.ensureAllProductColumns().catch((error) => {
    console.warn('[milko-backend] Product schema ensure failed on startup:', error.message);
  });
  addressModel.ensureAddressSchema().catch((error) => {
    console.warn('[milko-backend] Address schema ensure failed on startup:', error.message);
  });
  orderModel.ensureOrdersSchema().catch((error) => {
    console.warn('[milko-backend] Order schema ensure failed on startup:', error.message);
  });
  exchangeModel.ensureExchangeSchema().catch((error) => {
    console.warn('[milko-backend] Exchange schema ensure failed on startup:', error.message);
  });
});

module.exports = app;
