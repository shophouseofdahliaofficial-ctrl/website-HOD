const { NotFoundError } = require('../utils/errors');

/**
 * 404 Not Found Middleware
 * Handles routes that don't exist
 */
const notFound = (req, res, next) => {
  const url = req.originalUrl || req.url || '';
  // NotFoundError already suffixes " not found" — pass only the resource label.
  const debugApi =
    process.env.MILKO_DEBUG_API === '1' || process.env.MILKO_DEBUG_API === 'true';
  if (debugApi && url.startsWith('/api')) {
    console.warn('[NOT_FOUND]', { method: req.method, path: url });
  } else if (url.includes('coupon')) {
    console.warn('[NOT_FOUND]', {
      method: req.method,
      path: url,
      hint: 'coupon URL missed all routers; confirm deploy has /api/coupons and delivery is not mounted on blanket /api',
    });
  }
  next(new NotFoundError(`Route ${url}`));
};

module.exports = notFound;

