import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COMING_SOON_BYPASS_COOKIE, MILKO_ADMIN_COOKIE } from '@/lib/utils/constants';
import { resolveApiBaseUrl } from '@/lib/utils/apiBaseUrl';

/**
 * Middleware for route protection and subdomain routing
 * Handles:
 * - Coming Soon mode: redirect customers to /coming-soon unless bypass cookie or /admin, /auth
 * - Subdomain detection (admin.milko.in vs milko.in)
 * - Admin route protection (client-side verifies role)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  const hostOnly = hostname.split(':')[0];

  const isAdminSubdomain =
    hostname.startsWith('admin.') || hostname === 'admin.milko.in';
  const isLocalDevelopment =
    hostname.includes('localhost') || hostname.startsWith('127.0.0.1');

  // Always allow these paths (admin, auth, coming-soon page itself)
  const alwaysAllowed = ['/admin', '/auth', '/coming-soon'];
  const isAlwaysAllowed = alwaysAllowed.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
  if (isAlwaysAllowed) {
    return NextResponse.next();
  }

  // Never block customer routes on localhost during development.
  if (!isAdminSubdomain && isLocalDevelopment) {
    return NextResponse.next();
  }

  // Check Coming Soon mode: fetch status from backend
  let comingSoonEnabled = false;
  try {
    const res = await fetch(`${resolveApiBaseUrl({ hostname: hostOnly })}/api/content/coming_soon`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return NextResponse.next();

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return NextResponse.next();

    const json = (await res.json()) as {
      data?: { enabled?: boolean; isActive?: boolean };
    };
    comingSoonEnabled = !!json?.data?.enabled || !!json?.data?.isActive;
  } catch {
    // Fetch failure or invalid JSON/HTML body — don't block the site
  }

  if (!comingSoonEnabled) {
    return NextResponse.next();
  }

  // Coming soon is ON: allow if bypass cookie (access through password) OR logged-in admin cookie
  const bypass = request.cookies.get(COMING_SOON_BYPASS_COOKIE);
  const adminAccess = request.cookies.get(MILKO_ADMIN_COOKIE);
  if (bypass?.value || adminAccess?.value) {
    return NextResponse.next();
  }

  // Redirect to coming-soon (customers: logged out or logged in)
  const url = request.nextUrl.clone();
  url.pathname = '/coming-soon';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Exclude static assets in /public (including .lottie) from middleware.
    // Otherwise, when coming-soon is ON, the animation file request (e.g. /animations/*.lottie)
    // gets redirected to /coming-soon and the Lottie won't load for customers.
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|lottie|json|wasm|mp4|webm|mp3|wav)$).*)',
  ],
};
