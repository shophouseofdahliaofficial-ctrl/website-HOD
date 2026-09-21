const authService = require('../services/authService');
const { ValidationError, AuthenticationError } = require('../utils/errors');

/**
 * Auth Controller
 * Handles authentication HTTP requests
 */

/**
 * Register new customer
 * POST /api/auth/signup
 */
const signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Basic validation
    if (!name || !email || !password) {
      throw new ValidationError('Name, email, and password are required');
    }

    if (password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }

    const result = await authService.register({ name, email, password });

    res.status(201).json({
      success: true,
      data: result,
      message: 'User registered successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const result = await authService.login(email, password);

    res.json({
      success: true,
      data: result,
      message: 'Login successful',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 * GET /api/auth/me
 */
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    res.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.json({
      success: true,
      data: user, // Return user directly, not wrapped in { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Exchange Supabase token for our JWT token (for OAuth users)
 * POST /api/auth/exchange-token
 * Body: { token: string } - Supabase access token
 * Returns: { token: string } - Our JWT token with 700-day expiration
 */
const exchangeToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new ValidationError('Token is required');
    }

    // Verify Supabase token and get user
    const { supabase } = require('../config/supabase');
    if (!supabase) {
      throw new AuthenticationError('Supabase is not configured');
    }
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      throw new AuthenticationError('Invalid or expired token');
    }

    const accountState = await authService.getEmailAccountState(authUser.email || '');
    const normalizedEmail = accountState.email || String(authUser.email || '').trim().toLowerCase();
    const targetUserId =
      accountState.preferredEmailAccount?.id ||
      accountState.publicUser?.id ||
      authUser.id;

    // Get role and avatar from database
    const { query } = require('../config/database');
    let role = 'customer';
    try {
      const result = await query(
        'SELECT id, role, avatar_url FROM users WHERE id::text = $1::text OR LOWER(email) = LOWER($2::text) ORDER BY CASE WHEN id::text = $1::text THEN 0 ELSE 1 END LIMIT 1',
        [targetUserId, normalizedEmail]
      );
      const avatar_url = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null;
      if (result.rows.length > 0) {
        const row = result.rows[0];
        role = row.role || 'customer';
        if (avatar_url && row.avatar_url !== avatar_url) {
          await query('UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2', [avatar_url, row.id]);
        }
      } else {
        role = authUser.user_metadata?.role || 'customer';
        try {
          const userModel = require('../models/user');
          await userModel.createUser({
            id: targetUserId,
            name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
            email: normalizedEmail,
            role,
            avatar_url
          });
        } catch (dbError) {
          console.warn('[AUTH] Database profile creation failed in exchangeToken:', dbError.message);
        }
      }
    } catch (err) {
      console.warn('[AUTH] Database read/write failed in exchangeToken:', err.message);
      role = authUser.user_metadata?.role || 'customer';
    }

    // Generate our JWT token with 700-day expiration
    const { generateToken } = require('../utils/jwt');
    const jwtToken = generateToken({
      id: targetUserId,
      email: normalizedEmail,
      role: role.toLowerCase(),
    });

    res.json({
      success: true,
      data: { token: jwtToken },
      message: 'Token exchanged successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 * Note: Since we're using JWT, logout is handled client-side by removing token
 * This endpoint exists for consistency and future session-based auth
 */
const logout = async (req, res, next) => {
  try {
    // In a JWT system, logout is handled client-side
    // This endpoint can be used for logging/logging out events
    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/auth/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, email, phone, dateOfBirth, weddingDate } = req.body;
    const user = await authService.updateProfile(req.user.id, {
      name,
      email,
      phone,
      dateOfBirth,
      weddingDate,
    });
    res.json({
      success: true,
      data: user,
      message: 'Profile updated',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user.id, req.user.email, currentPassword, newPassword);
    res.json({
      success: true,
      data: { ok: true },
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if email is registered
 * POST /api/auth/check-email
 */
const checkEmail = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new ValidationError('Email is required');
    }

    const accountState = await authService.getEmailAccountState(email);
    
    if (accountState.hasGoogleOnlyAccount) {
      return res.json({
        success: true,
        data: { registered: true, googleOnly: true },
        message: 'Email is registered via Google Sign-In',
      });
    }

    const isRegistered = accountState.hasEmailAccount || !!accountState.publicUser;

    res.json({
      success: true,
      data: { registered: isRegistered, googleOnly: false },
      message: isRegistered ? 'Email is registered' : 'Email is not registered',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Telegram login and registration
 * POST /api/auth/telegram
 */
const telegramLogin = async (req, res, next) => {
  try {
    const telegramData = req.body;
    const result = await authService.loginWithTelegram(telegramData);
    res.json({
      success: true,
      data: result,
      message: 'Telegram login successful',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  login,
  getCurrentUser,
  exchangeToken,
  logout,
  updateProfile,
  changePassword,
  checkEmail,
  telegramLogin,
};
