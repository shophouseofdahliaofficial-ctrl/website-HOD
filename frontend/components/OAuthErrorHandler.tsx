'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * When Supabase OAuth fails with bad_oauth_state (or similar), it redirects to
 * the Site URL (often /) with ?error=...&error_code=bad_oauth_state. This
 * handler detects that and sends the user to the login page with a clear
 * error code so we can show a helpful message.
 */
export default function OAuthErrorHandler() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams?.toString() || '';
    if (!q || q.indexOf('bad_oauth_state') === -1) return;

    const isRoot = pathname === '/';
    const isCallback = pathname === '/auth/callback';
    if (!isRoot && !isCallback) return;

    router.replace('/auth/login?error=oauth_state');
  }, [pathname, router, searchParams]);

  return null;
}
