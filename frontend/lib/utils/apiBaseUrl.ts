/**
 * Resolves the backend API base URL for browser, SSR, and middleware.
 * Production sites must never use a localhost/LAN URL from env by mistake.
 */

const DEFAULT_PROD_API = 'https://website-hod.onrender.com';

function trimEnv(url: string | undefined): string {
  return (url || '').trim();
}

/** True if URL clearly points to a dev machine, not a public API. */
export function isLocalDevApiUrl(url: string): boolean {
  const t = url.trim().toLowerCase();
  if (!t) return false;
  try {
    const u = new URL(t);
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    return false;
  } catch {
    return /localhost|127\.0\.0\.1/.test(t);
  }
}

function isLanHostname(hostname: string): boolean {
  return /^(10|127|169\.254|172\.(1[6-9]|2\d|3[0-1])|192\.168)\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

type ResolveOpts = { hostname?: string | null };

/**
 * @param opts.hostname — from middleware `Host` header when `window` is unavailable
 */
export function resolveApiBaseUrl(opts?: ResolveOpts): string {
  const envRaw = trimEnv(process.env.NEXT_PUBLIC_API_BASE_URL);

  const hostFromWindow =
    typeof window !== 'undefined' ? window.location.hostname : '';
  const host = (opts?.hostname || hostFromWindow || '').split(':')[0].toLowerCase();

  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:3001';
  }

  if (host && (isLanHostname(host) || host.endsWith('.local'))) {
    return `http://${host}:3001`;
  }

  if (envRaw) {
    return envRaw;
  }

  return DEFAULT_PROD_API;
}
