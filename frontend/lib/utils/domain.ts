/**
 * Domain Detection Utilities
 * Detects if we're on admin.milko.in or milko.in
 */

/**
 * Get the current hostname
 */
export const getHostname = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.hostname;
  }
  return '';
};

/**
 * Check if we're on the admin subdomain
 */
export const isAdminDomain = (): boolean => {
  const hostname = getHostname();
  return hostname.startsWith('admin.') || hostname === 'admin.milko.in';
};

/**
 * Check if we're on the customer domain
 */
export const isCustomerDomain = (): boolean => {
  const hostname = getHostname();
  return !isAdminDomain() && (hostname === 'milko.in' || hostname === 'localhost' || hostname.includes('localhost'));
};

/**
 * Get the base URL for API calls based on domain
 */
export const getApiBaseUrl = (): string => {
  // Use environment variable if set, otherwise use Render backend URL
  // Development: Can override with http://localhost:3001
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://scribble-backend-94wn.onrender.com';
};

/**
 * Get the appropriate redirect path after login based on domain and role
 * SECURITY: Always verify role is actually 'admin' before redirecting to /admin
 */
export const getPostLoginRedirect = (role: 'admin' | 'customer' | string): string => {
  const hostname = getHostname();
  const isLocalhost = hostname === 'localhost' || hostname.includes('localhost');
  
  // Normalize role to lowercase for comparison
  const normalizedRole = role?.toLowerCase() || 'customer';
  
  // SECURITY: Only allow admin redirect if role is explicitly 'admin'
  // Default to 'customer' if role is undefined, null, or anything else
  const isAdmin = normalizedRole === 'admin';
  
  if (isAdminDomain()) {
    // On admin domain, only allow admin users
    return isAdmin ? '/admin' : '/dashboard';
  }
  
  if (isAdmin && !isAdminDomain()) {
    // Admin logged in on customer domain - redirect to /admin on same domain
    // No subdomain redirect needed, use same domain
    return '/admin';
  }
  
  // Default: redirect customers to dashboard
  return '/dashboard';
};

/**
 * Get the appropriate redirect path for logout
 */
export const getPostLogoutRedirect = (): string => {
  if (isAdminDomain()) {
    return '/auth/login';
  }
  return '/auth/login';
};



