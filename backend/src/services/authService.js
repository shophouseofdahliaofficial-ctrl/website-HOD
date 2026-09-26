const { supabase, supabaseAdmin } = require('../config/supabase');
const { query } = require('../config/database');
const { ValidationError, AuthenticationError } = require('../utils/errors');
const { transformUser } = require('../utils/transform');
const { generateToken } = require('../utils/jwt');
const userModel = require('../models/user');
const normalizeEmail = userModel.normalizeEmail;

/**
 * Auth Service - SIMPLIFIED
 * Use Supabase Auth + database role, with proper fallback
 */

/**
 * Register a new customer
 */
const findAuthAccountsByEmail = async (rawEmail) => {
  const email = normalizeEmail(rawEmail);
  if (!email) return [];

  const result = await query(
    `
    SELECT
      u.id,
      LOWER(u.email) AS email,
      u.created_at,
      COALESCE(NULLIF(u.encrypted_password, ''), '') <> '' AS has_password,
      COALESCE(array_remove(array_agg(DISTINCT i.provider), NULL), ARRAY[]::text[]) AS providers
    FROM auth.users u
    LEFT JOIN auth.identities i ON i.user_id = u.id
    WHERE LOWER(u.email) = $1
    GROUP BY u.id, u.email, u.created_at, u.encrypted_password
    ORDER BY u.created_at ASC
    `,
    [email]
  );

  return result.rows.map((row) => {
    const providers = Array.isArray(row.providers)
      ? row.providers.map((provider) => String(provider || '').toLowerCase()).filter(Boolean)
      : [];

    return {
      id: row.id,
      email: row.email,
      createdAt: row.created_at,
      providers,
      hasPassword: Boolean(row.has_password),
      hasEmailProvider: Boolean(row.has_password) || providers.includes('email'),
      hasGoogleProvider: providers.includes('google'),
    };
  });
};

const getEmailAccountState = async (rawEmail) => {
  const email = normalizeEmail(rawEmail);
  const [authAccounts, publicUser] = await Promise.all([
    findAuthAccountsByEmail(email).catch(() => []),
    userModel.findByEmail(email).catch(() => null),
  ]);

  const preferredEmailAccount = authAccounts.find((account) => account.hasEmailProvider) || null;
  const preferredGoogleAccount = authAccounts.find((account) => account.hasGoogleProvider) || null;

  return {
    email,
    authAccounts,
    publicUser,
    preferredEmailAccount,
    preferredGoogleAccount,
    hasEmailAccount: Boolean(preferredEmailAccount),
    hasGoogleOnlyAccount: authAccounts.length > 0 && !preferredEmailAccount && Boolean(preferredGoogleAccount),
  };
};

const register = async (userData) => {
  const { name, email, password } = userData;
  const normalizedEmail = normalizeEmail(email);

  console.log('[AUTH] Signup for:', normalizedEmail);

  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const accountState = await getEmailAccountState(normalizedEmail);
  if (accountState.hasGoogleOnlyAccount) {
    throw new ValidationError('Account is associated with Google login, login with Google.');
  }
  if (accountState.hasEmailAccount || accountState.publicUser) {
    throw new ValidationError('Email already registered. Please login instead.');
  }

  // Sign up with Supabase Auth (use admin client if available to bypass email rate limits & auto-confirm)
  let authData = null;
  let authError = null;

  if (supabaseAdmin) {
    const adminRes = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'customer',
      },
    });
    authData = adminRes.data;
    authError = adminRes.error;
  } else {
    const res = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          name,
          role: 'customer',
        },
      },
    });
    authData = res.data;
    authError = res.error;
  }

  if (authError) {
    console.error('[AUTH] Signup error:', authError.message);
    
    if (authError.message?.includes('already registered') || 
        authError.message?.includes('already exists') ||
        authError.message?.includes('User already registered')) {
      throw new ValidationError('Email already registered. Please login instead.');
    }
    
    throw new ValidationError(authError.message || 'Registration failed');
  }

  if (!authData.user) {
    throw new ValidationError('Failed to create user');
  }

  // Try to create database profile (non-blocking)
  const userId = authData.user.id;
  try {
    await query(
      `INSERT INTO users (id, name, email, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [userId, name, normalizedEmail, 'customer']
    );
    console.log('[AUTH] User profile created in database');
  } catch (dbError) {
    console.warn('[AUTH] Database profile creation failed (non-critical):', dbError.message);
  }

  const user = {
    id: userId,
    name,
    email: normalizedEmail,
    role: 'customer',
    lifetimeSavings: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Generate our own JWT token with 700-day expiration for production
  const jwtToken = generateToken({
    id: userId,
    email: normalizedEmail,
    role: 'customer',
  });

  return {
    user,
    token: jwtToken,
  };
};

/**
 * Login user - SIMPLE VERSION
 * 1. Authenticate with Supabase
 * 2. Try to get role from database
 * 3. If database fails, use Supabase metadata (but log warning)
 */
const login = async (email, password) => {
  const normalizedEmail = normalizeEmail(email);
  console.log('[AUTH] Login for:', normalizedEmail);

  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const accountState = await getEmailAccountState(normalizedEmail);
  if (accountState.hasGoogleOnlyAccount) {
    throw new AuthenticationError('Account is associated with Google login, login with Google.');
  }

  // 1. Authenticate with Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (authError) {
    console.error('[AUTH] Login error:', authError.message);
    throw new AuthenticationError('Invalid email or password');
  }

  if (!authData.user) {
    throw new AuthenticationError('Invalid email or password');
  }

  if (!authData.session || !authData.session.access_token) {
    console.error('[AUTH] Login error: No session or access token received from Supabase');
    throw new AuthenticationError('Authentication failed. Please try again.');
  }

  const userId = authData.user.id;
  const canonicalUserId = accountState.preferredEmailAccount?.id || accountState.publicUser?.id || userId;
  const name = authData.user.user_metadata?.name || authData.user.user_metadata?.full_name || normalizedEmail.split('@')[0] || 'User';
  
  // 2. Try to get role from database FIRST (with timeout)
  // Database is the source of truth - if it's available, use it
  let role = 'customer'; // Default
  let roleSource = 'default';
  let lifetimeSavings = 0;
  let resolvedName = name;
  let resolvedEmail = normalizedEmail;
  let resolvedAvatarUrl = authData.user.user_metadata?.avatar_url || authData.user.user_metadata?.picture || undefined;
  
  try {
    console.log('[AUTH] Attempting to fetch role from database (source of truth)...');
    const profileResult = await Promise.race([
      query('SELECT id, name, email, role, lifetime_savings, avatar_url FROM users WHERE id::text = $1::text OR LOWER(email) = LOWER($2::text) ORDER BY CASE WHEN id::text = $1::text THEN 0 ELSE 1 END LIMIT 1', [canonicalUserId, normalizedEmail]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 5000) // 5 second timeout
      )
    ]);

    if (profileResult && profileResult.rows && profileResult.rows.length > 0) {
      const row = profileResult.rows[0];
      role = row.role || 'customer';
      lifetimeSavings = row.lifetime_savings || 0;
      resolvedName = row.name || resolvedName;
      resolvedEmail = normalizeEmail(row.email || resolvedEmail);
      resolvedAvatarUrl = row.avatar_url || resolvedAvatarUrl;
      roleSource = 'database';
      console.log('[AUTH] ✅ Role from database (source of truth):', role);
      
      // IMPORTANT: Sync role to Supabase Auth metadata so it's available as fallback
      if (supabaseAdmin && role !== authData.user.user_metadata?.role) {
        setImmediate(async () => {
          try {
            await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
              user_metadata: {
                ...authData.user.user_metadata,
                role: role,
              },
            });
            console.log('[AUTH] ✅ Synced role to Supabase Auth metadata');
          } catch (syncError) {
            console.warn('[AUTH] Failed to sync role to metadata:', syncError.message);
          }
        });
      }
    } else {
      console.warn('[AUTH] ⚠️  User not found in database, using Supabase metadata');
      role = authData.user.user_metadata?.role || 'customer';
      roleSource = 'supabase-metadata';
    }
  } catch (dbError) {
    console.warn('[AUTH] ⚠️  Database query failed/timed out, using Supabase metadata as fallback');
    console.warn('[AUTH] Error:', dbError.message);
    role = authData.user.user_metadata?.role || 'customer';
    roleSource = 'supabase-metadata-fallback';
    
    // Try to sync database in background (non-blocking)
    setImmediate(async () => {
      try {
        await query(
          `INSERT INTO users (id, name, email, role, avatar_url, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role, avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url), updated_at = NOW()`,
          [canonicalUserId, name, normalizedEmail, role, resolvedAvatarUrl || null]
        );
        console.log('[AUTH] Background profile sync completed');
      } catch (bgError) {
        console.error('[AUTH] Background profile sync failed:', bgError.message);
      }
    });
  }

  // Normalize role to lowercase
  role = role.toLowerCase();
  
  console.log('[AUTH] ✅ Login successful');
  console.log('[AUTH] User ID:', canonicalUserId);
  console.log('[AUTH] Email:', normalizedEmail);
  console.log('[AUTH] Role:', role, '(source:', roleSource, ')');
  console.log('[AUTH] Token received:', authData.session.access_token ? 'Yes' : 'No');

  const user = {
    id: canonicalUserId,
    name: resolvedName,
    email: resolvedEmail,
    role,
    lifetimeSavings: Number(lifetimeSavings || 0),
    avatarUrl: resolvedAvatarUrl,
    createdAt: authData.user.created_at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Generate our own JWT token with 700-day expiration for production
  // This ensures users stay logged in for 700 days on milko.in
  const jwtToken = generateToken({
    id: canonicalUserId,
    email: resolvedEmail,
    role,
  });

  return {
    user,
    token: jwtToken,
  };
};

/**
 * Get current user — always prefer public.users (includes lifetime_savings for Bachat Meter).
 * If the row is missing, upsert from Supabase Auth admin API (never use supabase.auth.getUser()
 * server-side without the caller JWT — it is not tied to the request user).
 */
const getCurrentUser = async (userId) => {
  console.log('[AUTH] getCurrentUser for:', userId);

  const selectSql =
    'SELECT id, name, email, role, phone, date_of_birth, wedding_date, created_at, updated_at, lifetime_savings, avatar_url FROM users WHERE id = $1';

  const readUserRow = async () => {
    const result = await query(selectSql, [userId]);
    return result.rows?.[0] || null;
  };

  let row = null;
  try {
    row = await Promise.race([
      readUserRow(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000)),
    ]);
  } catch (error) {
    console.warn('[AUTH] getCurrentUser primary read failed:', error.message);
    row = await readUserRow().catch(() => null);
  }

  if (row) {
    const user = transformUser(row);
    console.log('[AUTH] getCurrentUser from DB', {
      role: user.role,
      lifetimeSavings: user.lifetimeSavings,
    });
    return user;
  }

  console.warn('[AUTH] getCurrentUser: no public.users row for id', userId);

  if (supabaseAdmin) {
    const { data, error: adminErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!adminErr && data?.user) {
      const au = data.user;
      const email = au.email;
      const name =
        au.user_metadata?.name ||
        au.user_metadata?.full_name ||
        (typeof email === 'string' ? email.split('@')[0] : null) ||
        'User';
      const role = (au.user_metadata?.role || 'customer').toLowerCase();
      const avatar_url = au.user_metadata?.avatar_url || au.user_metadata?.picture || null;
      try {
        await userModel.createUser({ id: userId, name, email: normalizeEmail(email), role, avatar_url });
      } catch (e) {
        console.warn('[AUTH] getCurrentUser profile upsert failed:', e.message);
      }
      row = await readUserRow().catch(() => null);
      if (row) {
        const user = transformUser(row);
        console.log('[AUTH] getCurrentUser after profile sync', {
          role: user.role,
          lifetimeSavings: user.lifetimeSavings,
        });
        return user;
      }
    } else if (adminErr) {
      console.warn('[AUTH] getCurrentUser admin.getUserById failed:', adminErr.message);
    }
  } else {
    console.warn(
      '[AUTH] getCurrentUser: SUPABASE_SERVICE_ROLE_KEY missing — cannot sync Auth user into public.users'
    );
  }

  // Last resort: synthetic profile (Bachat stays 0; avoids breaking the app shell)
  console.warn('[AUTH] getCurrentUser: returning synthetic profile (no DB row)');
  return {
    id: String(userId),
    name: 'User',
    email: '',
    role: 'customer',
    lifetimeSavings: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Update profile in public.users and sync Supabase Auth user_metadata (no image storage).
 */
const updateProfile = async (userId, { name, email, phone, dateOfBirth, weddingDate }) => {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('Name is required');
  }
  const trimmed = name.trim();
  const dbUpdates = { name: trimmed };

  if (email !== undefined) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw new ValidationError('Email is required');
    }
    dbUpdates.email = normalizedEmail;
  }
  if (phone !== undefined) {
    dbUpdates.phone = typeof phone === 'string' ? phone.trim() || null : null;
  }
  if (dateOfBirth !== undefined) {
    dbUpdates.date_of_birth = dateOfBirth ? String(dateOfBirth).trim().slice(0, 10) || null : null;
  }
  if (weddingDate !== undefined) {
    dbUpdates.wedding_date = weddingDate ? String(weddingDate).trim().slice(0, 10) || null : null;
  }

  const updatedRow = await userModel.updateUser(userId, dbUpdates);
  if (!updatedRow) {
    throw new ValidationError('Profile could not be updated');
  }

  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (!error && data?.user) {
        const meta = data.user.user_metadata || {};
        const authUpdates = {
          user_metadata: {
            ...meta,
            name: trimmed,
            full_name: trimmed,
            phone: dbUpdates.phone ?? meta.phone,
            date_of_birth: dbUpdates.date_of_birth ?? meta.date_of_birth,
            wedding_date: dbUpdates.wedding_date ?? meta.wedding_date,
          },
        };
        if (dbUpdates.email) {
          authUpdates.email = dbUpdates.email;
          authUpdates.email_confirm = true;
        }
        await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
      }
    } catch (e) {
      console.warn('[AUTH] updateProfile Supabase metadata sync:', e.message);
    }
  }

  return getCurrentUser(userId);
};

/**
 * Change password: verify current password with Supabase, then set new password via admin API.
 */
const changePassword = async (userId, email, currentPassword, newPassword) => {
  if (!currentPassword || !newPassword) {
    throw new ValidationError('Current password and new password are required');
  }
  if (newPassword.length < 6) {
    throw new ValidationError('New password must be at least 6 characters');
  }
  if (!supabase) {
    throw new ValidationError('Password change is not available');
  }
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new ValidationError('Email is required');
  }

  const accountState = await getEmailAccountState(normalizedEmail);
  if (!accountState.preferredEmailAccount) {
    throw new ValidationError(
      'No password is set for this account. If you use Google sign-in, manage your password in your Google account.'
    );
  }

  const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: currentPassword,
  });

  if (signErr || !signData?.user) {
    throw new AuthenticationError('Current password is incorrect');
  }

  if (String(signData.user.id) !== String(userId)) {
    throw new AuthenticationError('Could not verify credentials for this profile');
  }

  if (!supabaseAdmin) {
    throw new ValidationError('Password change is temporarily unavailable');
  }

  const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (upErr) {
    console.error('[AUTH] changePassword admin error:', upErr.message);
    throw new ValidationError(upErr.message || 'Could not update password');
  }
};

/**
 * Authenticate or register a user with Telegram authentication data
 */
const loginWithTelegram = async (telegramData) => {
  const { id, first_name, last_name, username, photo_url, auth_date, hash } = telegramData;

  if (!id || !hash || !auth_date) {
    throw new ValidationError('Missing required Telegram authentication parameters');
  }

  // Verify Telegram signature
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('Telegram Bot Token is not configured on the server');
  }

  const crypto = require('crypto');
  
  // Reconstruct check string
  const hashData = { ...telegramData };
  delete hashData.hash;

  // Filter out any undefined or null fields, convert values to strings
  const checkString = Object.keys(hashData)
    .sort()
    .map(key => {
      const val = hashData[key];
      return val !== undefined && val !== null ? `${key}=${val}` : null;
    })
    .filter(Boolean)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  if (computedHash !== hash) {
    console.error('[AUTH] Telegram hash verification failed', { computedHash, hash });
    throw new AuthenticationError('Invalid Telegram login signature');
  }

  // Check timestamp (must be within 24 hours to prevent replays)
  const now = Math.floor(Date.now() / 1000);
  if (now - parseInt(auth_date, 10) > 86400) {
    throw new AuthenticationError('Telegram login request expired');
  }

  const telegramIdStr = String(id);
  const name = [first_name, last_name].filter(Boolean).join(' ') || username || 'Telegram User';

  // Check if user exists in database
  let user;
  
  // Make sure schemas are ready
  await userModel.ensureUsersSchema();

  const userResult = await query(
    'SELECT id, name, email, role, created_at, avatar_url FROM users WHERE telegram_id = $1',
    [telegramIdStr]
  );

  if (userResult.rows.length > 0) {
    user = userResult.rows[0];
    if (photo_url && user.avatar_url !== photo_url) {
      await query('UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2', [photo_url, user.id]);
      user.avatar_url = photo_url;
    }
  } else {
    // Check if there is an existing user with a matching generated email just in case,
    // though the telegram_id is the primary lookup.
    const generatedEmail = `telegram_${telegramIdStr}@telegram.milko.in`;
    const emailResult = await query(
      'SELECT id, name, email, role, created_at, avatar_url FROM users WHERE LOWER(email) = $1',
      [generatedEmail]
    );

    if (emailResult.rows.length > 0) {
      // If we find user by generated email but telegram_id is missing, update the telegram_id and avatar
      user = emailResult.rows[0];
      await query('UPDATE users SET telegram_id = $1, avatar_url = $2, updated_at = NOW() WHERE id = $3', [telegramIdStr, photo_url, user.id]);
      user.avatar_url = photo_url;
    } else {
      // Create new user!
      const newUserId = crypto.randomUUID();
      const insertResult = await query(
        `INSERT INTO users (id, name, email, role, telegram_id, avatar_url, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id, name, email, role, avatar_url, created_at`,
        [newUserId, name, generatedEmail, 'customer', telegramIdStr, photo_url]
      );
      user = insertResult.rows[0];
      console.log('[AUTH] Created new user for Telegram login:', user.id);
    }
  }

  // Generate JWT token
  const jwtToken = generateToken({
    id: user.id,
    email: user.email,
    role: user.role.toLowerCase(),
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.toLowerCase(),
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
    },
    token: jwtToken,
  };
};

module.exports = {
  register,
  login,
  getCurrentUser,
  getEmailAccountState,
  updateProfile,
  changePassword,
  loginWithTelegram,
};
