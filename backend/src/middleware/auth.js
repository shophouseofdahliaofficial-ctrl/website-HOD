const { supabase } = require('../config/supabase');
const { AuthenticationError } = require('../utils/errors');
const { query } = require('../config/database');
const { verifyToken } = require('../utils/jwt');

/**
 * Authentication Middleware
 * Verifies JWT token (our own tokens with 700-day expiration) and attaches user to request object
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const path = req.originalUrl || req.url || '';
      const debugAuth =
        process.env.MILKO_DEBUG_AUTH === '1' || process.env.MILKO_DEBUG_AUTH === 'true';
      if (debugAuth || path.startsWith('/api/coupons')) {
        console.warn('[AUTH] Missing Bearer token', { method: req.method, path });
      }
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7);

    // Verify our JWT token (with 700-day expiration for production)
    let decodedToken;
    try {
      decodedToken = verifyToken(token);
    } catch (error) {
      // If our JWT verification fails, try Supabase as fallback (for backward compatibility)
      if (!supabase) {
        throw new AuthenticationError('Invalid or expired token');
      }
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !authUser) {
        throw new AuthenticationError('Invalid or expired token');
      }
      // Use Supabase user ID for backward compatibility
      decodedToken = { id: authUser.id, email: authUser.email, role: authUser.user_metadata?.role || 'customer' };
    }

    const userId = decodedToken.id;
    const userEmail = decodedToken.email;
    const userRole = decodedToken.role;

    // Get user profile from database
    const result = await query(
      'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Profile should exist (created by trigger), but create if missing
      const name = userEmail?.split('@')[0] || 'User';
      const defaultRole = userRole || 'customer';

      try {
        // Try to insert new user profile with conflict handling on both id and email
        await query(
          `INSERT INTO users (id, name, email, role, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, updated_at = NOW()`,
          [userId, name, userEmail, defaultRole]
        );
      } catch (insertError) {
        // If email conflict or any other error, try to find existing user
        console.warn('[AUTH] User insert failed, checking for existing user:', insertError.message);
        
        // Try to find user by email (in case email exists but ID is different)
        const emailResult = await query(
          'SELECT id, email, name, role, created_at FROM users WHERE email = $1',
          [userEmail]
        );
        
        if (emailResult.rows.length > 0) {
          // User exists with this email, use that user
          const normalizedRole = emailResult.rows[0].role ? emailResult.rows[0].role.toLowerCase() : 'customer';
          req.user = {
            id: emailResult.rows[0].id,
            email: emailResult.rows[0].email,
            name: emailResult.rows[0].name,
            role: normalizedRole,
          };
          return next();
        }
        
        // If no user found and it's not an email conflict, re-throw the error
        if (!insertError.message?.includes('email') && !insertError.message?.includes('users_email_key')) {
          throw insertError;
        }
        
        // For email conflicts, just use the auth user data without database profile
        // This allows the request to continue even if user profile creation fails
        console.warn('[AUTH] Using auth user data without database profile due to conflict');
        req.user = {
          id: userId,
          email: userEmail,
          name: name,
          role: defaultRole.toLowerCase(),
        };
        return next();
      }

      // Fetch the profile after successful insert
      const newResult = await query(
        'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
        [userId]
      );

      if (newResult.rows.length === 0) {
        // Fallback: use token user data
        req.user = {
          id: userId,
          email: userEmail,
          name: name,
          role: defaultRole.toLowerCase(),
        };
        return next();
      }

      const normalizedRole = newResult.rows[0].role ? newResult.rows[0].role.toLowerCase() : 'customer';
      req.user = {
        id: newResult.rows[0].id,
        email: newResult.rows[0].email,
        name: newResult.rows[0].name,
        role: normalizedRole,
      };
    } else {
      // Attach user to request object (normalize role to lowercase)
      const role = result.rows[0].role ? result.rows[0].role.toLowerCase() : 'customer';
      req.user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        name: result.rows[0].name,
        role: role,
      };
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional Authentication Middleware
 * Attaches user if token is present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Try to verify our JWT token first
      let decodedToken;
      try {
        decodedToken = verifyToken(token);
        const result = await query(
          'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
          [decodedToken.id]
        );

        if (result.rows.length > 0) {
          const role = result.rows[0].role ? result.rows[0].role.toLowerCase() : 'customer';
          req.user = {
            id: result.rows[0].id,
            email: result.rows[0].email,
            name: result.rows[0].name,
            role: role,
          };
        } else {
          // Use token data if user not in database
          req.user = {
            id: decodedToken.id,
            email: decodedToken.email,
            name: decodedToken.email?.split('@')[0] || 'User',
            role: (decodedToken.role || 'customer').toLowerCase(),
          };
        }
      } catch (jwtError) {
        // Fallback to Supabase verification for backward compatibility
        if (!supabase) {
          return next();
        }
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && authUser) {
          const result = await query(
            'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
            [authUser.id]
          );
          if (result.rows.length > 0) {
            const role = result.rows[0].role ? result.rows[0].role.toLowerCase() : 'customer';
            req.user = {
              id: result.rows[0].id,
              email: result.rows[0].email,
              name: result.rows[0].name,
              role: role,
            };
          }
        }
      }
    }

    next();
  } catch (error) {
    // Continue without user if token is invalid
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth,
};
