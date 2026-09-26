import type { User } from '@/types';

/** Normalize API / cached user so Bachat Meter always gets a numeric lifetimeSavings and avatarUrl is consistently populated. */
export function normalizeUserProfile(input: unknown): User | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const raw = o.lifetimeSavings ?? o.lifetime_savings;
  const n = typeof raw === 'number' ? raw : Number(raw);
  const lifetimeSavings = Number.isFinite(n) ? n : 0;
  const avatarUrl = (o.avatarUrl || o.avatar_url || o.picture || o.photo_url) as string | undefined;
  return { ...(o as unknown as User), avatarUrl, lifetimeSavings };
}
