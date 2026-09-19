const { AuthorizationError } = require('../utils/errors');

/**
 * Admin Authorization Middleware
 * Requires user to be authenticated AND have admin role
 * Must be used after authenticate middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AuthorizationError('Authentication required'));
  }

  // Normalize role to lowercase for comparison
  const userRole = req.user.role ? req.user.role.toLowerCase() : 'customer';
  
  console.log('[AUTH] Admin check - User ID:', req.user.id, 'Email:', req.user.email, 'Role:', req.user.role, 'Normalized:', userRole);
  
  if (userRole !== 'admin') {
    console.log('[AUTH] ❌ Admin access denied. User role:', req.user.role, 'normalized:', userRole);
    return next(new AuthorizationError('Admin access required'));
  }

  console.log('[AUTH] ✅ Admin access granted');
  next();
};

module.exports = {
  requireAdmin,
};

