import type { Subscription } from '@/types';
import { IST_TIMEZONE } from '@/lib/utils/datetime';

function coerceBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 't' || v === 1 || v === '1';
}

function isTrialSub(sub: Subscription): boolean {
  const r = sub as Subscription & { is_trial?: unknown };
  return coerceBool(sub.isTrial) || coerceBool(r.is_trial);
}

/**
 * Plan skips the first calendar day (start_date) for the first delivery — same as backend slot-shift.
 * Coerces API booleans; infers trial + extended duration when the flag is missing from list payloads.
 */
export function subscriptionSkipsFirstCalendarDelivery(sub: Subscription): boolean {
  const r = sub as Subscription & { first_day_shift_applied?: unknown; first_day_shift_reason?: unknown };
  if (coerceBool(sub.firstDayShiftApplied) || coerceBool(r.first_day_shift_applied)) return true;
  const reason = String(
    sub.firstDayShiftReason ?? r.first_day_shift_reason ?? '',
  ).trim();
  if (reason.length > 0) return true;
  if (!isTrialSub(sub)) return false;
  const raw = sub.durationDays ?? (r as { duration_days?: unknown }).duration_days;
  const dd = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  const startS = String(sub.startDate || '').trim().slice(0, 10);
  const endS = String(sub.endDate || '').trim().slice(0, 10);
  const multiCalendarDaySpan =
    /^\d{4}-\d{2}-\d{2}$/.test(startS) && /^\d{4}-\d{2}-\d{2}$/.test(endS) && endS > startS;
  if (Number.isFinite(dd) && dd >= 2) return true;
  if (Number.isFinite(dd) && dd <= 1) return false;
  // Trial with a multi-day calendar window but missing duration_days on some payloads → slot-shift trial
  return multiCalendarDaySpan;
}

/** Calendar YYYY-MM-DD in IST for “today” (matches admin / subscription business day). */
export function todayYmdIST(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !d) return '';
  return `${y}-${m}-${d}`;
}

/** Add whole calendar days to YYYY-MM-DD (UTC date math; stable for YMD-only). */
export function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const parts = String(ymd).slice(0, 10).split('-');
  const y = parseInt(parts[0], 10);
  const mo = parseInt(parts[1], 10) - 1;
  const da = parseInt(parts[2], 10);
  const ms = Date.UTC(y, mo, da) + deltaDays * 86400000;
  const u = new Date(ms);
  return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(u.getUTCDate()).padStart(2, '0')}`;
}

function dayDiffYmd(fromYmd: string, toYmd: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) return 0;
  const a = Date.UTC(
    parseInt(fromYmd.slice(0, 4), 10),
    parseInt(fromYmd.slice(5, 7), 10) - 1,
    parseInt(fromYmd.slice(8, 10), 10),
    12,
    0,
    0,
  );
  const b = Date.UTC(
    parseInt(toYmd.slice(0, 4), 10),
    parseInt(toYmd.slice(5, 7), 10) - 1,
    parseInt(toYmd.slice(8, 10), 10),
    12,
    0,
    0,
  );
  return Math.round((b - a) / 86400000);
}

function blockedYmdSet(sub: Subscription): Set<string> {
  const s = new Set<string>();
  (sub.pausedDates || []).forEach((p) => {
    const k = String(p).trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(k)) s.add(k);
  });
  (sub.deliverySchedules || []).forEach((d) => {
    if (d.status === 'cancelled' || d.status === 'skipped') {
      const k = String(d.deliveryDate).trim().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) s.add(k);
    }
  });
  return s;
}

/**
 * Next delivery calendar day (YYYY-MM-DD) in IST ordering, or null.
 * Honors `firstDayShiftApplied` when list payloads omit schedules or only partial rows.
 */
export function getNextDeliveryYmdIST(sub: Subscription): string | null {
  const todayIst = todayYmdIST();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayIst)) return null;

  const endYmd = String(sub.endDate || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) return null;
  if (endYmd < todayIst) return null;

  const blocked = blockedYmdSet(sub);
  const startYmdForShift = String(sub.startDate || '').trim().slice(0, 10);
  const skipStartDay = subscriptionSkipsFirstCalendarDelivery(sub);

  const pendingCandidates = (sub.deliverySchedules || [])
    .filter((d) => d.status === 'pending')
    .map((d) => String(d.deliveryDate).trim().slice(0, 10))
    .filter((ymd) => /^\d{4}-\d{2}-\d{2}$/.test(ymd))
    .filter((ymd) => !blocked.has(ymd))
    .filter(
      (ymd) =>
        !(
          skipStartDay &&
          /^\d{4}-\d{2}-\d{2}$/.test(startYmdForShift) &&
          ymd === startYmdForShift
        ),
    )
    .filter((ymd) => ymd >= todayIst)
    .sort((a, b) => a.localeCompare(b));

  if (pendingCandidates.length > 0) {
    const first = pendingCandidates[0];
    if (
      skipStartDay &&
      /^\d{4}-\d{2}-\d{2}$/.test(startYmdForShift) &&
      first === startYmdForShift
    ) {
      const afterStart = pendingCandidates.find((ymd) => ymd > startYmdForShift);
      if (afterStart) return afterStart;
    } else {
      return first;
    }
    // skipStartDay + only a pending row on start_date — fall through to calendar walk
  }

  const startYmdRaw = String(sub.startDate || '').trim().slice(0, 10);
  let cursor = /^\d{4}-\d{2}-\d{2}$/.test(startYmdRaw) ? startYmdRaw : todayIst;
  if (skipStartDay && /^\d{4}-\d{2}-\d{2}$/.test(startYmdRaw)) {
    cursor = addCalendarDaysYmd(startYmdRaw, 1);
  }
  if (cursor < todayIst) {
    cursor = todayIst;
  }

  while (cursor <= endYmd) {
    if (!blocked.has(cursor)) {
      return cursor;
    }
    cursor = addCalendarDaysYmd(cursor, 1);
  }

  return null;
}

/** e.g. `Next Delivery: today` — for My Plans cards. */
export function formatNextDeliveryCustomerLine(sub: Subscription): string {
  if (sub.status === 'cancelled' || sub.status === 'expired') {
    return 'Next Delivery: —';
  }
  const nextYmd = getNextDeliveryYmdIST(sub);
  if (!nextYmd) return 'Next Delivery: —';
  const todayIst = todayYmdIST();
  const diff = dayDiffYmd(todayIst, nextYmd);
  if (diff <= 0) return 'Next Delivery: today';
  if (diff === 1) return 'Next Delivery: tomorrow';
  return `Next Delivery: ${diff} days later`;
}

/** Short fragment for dashboard: `today` | `tomorrow` | `N day(s) later` | `—`. */
export function nextDeliveryShortLabelIST(sub: Subscription): string {
  if (sub.status === 'cancelled' || sub.status === 'expired') {
    return '—';
  }
  const nextYmd = getNextDeliveryYmdIST(sub);
  if (!nextYmd) return '—';
  const todayIst = todayYmdIST();
  const diff = dayDiffYmd(todayIst, nextYmd);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return `${diff} day(s) later`;
}
