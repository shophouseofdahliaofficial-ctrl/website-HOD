import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local for Google Sign-In. See GOOGLE_AUTH_SETUP.md.'
    );
  }
  _client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}

/**
 * Supabase client for the browser. Lazy-initialized so the app still runs
 * without these env vars if you don't use Google Sign-In. Used only for
 * OAuth (e.g. Google). The rest of the app uses the Milko backend API.
 */
export const supabase = {
  get auth() {
    return getSupabase().auth;
  },
};
