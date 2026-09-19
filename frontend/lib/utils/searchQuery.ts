/**
 * Normalize admin list search so values like "#42" or "### 1001" match order/subscription numbers
 * stored without a hash prefix.
 */
export function normalizeAdminListSearchQuery(raw: string): string {
  let s = raw.trim().toLowerCase();
  while (s.startsWith('#')) {
    s = s.slice(1).trim();
  }
  return s;
}
