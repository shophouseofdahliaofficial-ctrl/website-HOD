const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * Supabase Client Configuration
 * Used for authentication and database operations
 */

const supabaseUrl = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/^['"]|['"]$/g, '');
const supabaseAnonKey = String(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim().replace(/^['"]|['"]$/g, '');
const supabaseServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim().replace(/^['"]|['"]$/g, '');

const hasSupabaseConfig = !!(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  console.error(
    '[milko-backend] ❌ SUPABASE_URL and SUPABASE_ANON_KEY are not set. Supabase features will not work.'
  );
} else {
  console.log('[milko-backend] ✅ Supabase configured:', {
    url: supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    hasServiceKey: !!supabaseServiceRoleKey,
  });
}

// Create Supabase client for Auth operations
const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
    })
  : null;

// Create Supabase Admin client for server-side operations (if needed)
const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

module.exports = {
  supabase,
  supabaseAdmin,
};
