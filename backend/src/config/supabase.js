const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * Supabase Client Configuration
 * Used for authentication and database operations
 */

const hasSupabaseConfig = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

if (!hasSupabaseConfig) {
  console.error(
    '[milko-backend] ❌ SUPABASE_URL and SUPABASE_ANON_KEY are not set. Supabase features will not work.'
  );
} else {
  console.log('[milko-backend] ✅ Supabase configured:', {
    url: process.env.SUPABASE_URL,
    hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

// Create Supabase client for Auth operations
const supabase = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
    })
  : null;

// Create Supabase Admin client for server-side operations (if needed)
// Note: This requires SUPABASE_SERVICE_ROLE_KEY (keep this secret!)
const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
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
