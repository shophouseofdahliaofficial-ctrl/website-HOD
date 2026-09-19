import type { User } from '@/types';

/** Normalize API / cached user so Bachat Meter always gets a numeric lifetimeSavings. */
export function normalizeUserProfile(input: unknown): User | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const raw = o.lifetimeSavings ?? o.lifetime_savings;
  const n = typeof raw === 'number' ? raw : Number(raw);
  const lifetimeSavings = Number.isFinite(n) ? n : 0;
  return { ...(o as unknown as User), lifetimeSavings };
}
