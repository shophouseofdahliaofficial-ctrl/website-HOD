'use client';

export const runtime = 'edge';


import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { contentApi, subscriptionsApi } from '@/lib/api';
import { SITE_NAME } from '@/lib/seo';
import { Subscription } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { parseLocalDateFromYmd } from '@/lib/utils/datetime';
import { nextDeliveryShortLabelIST } from '@/lib/utils/subscriptionNextDelivery';
import styles from './page.module.css';

type CalendarCell = {
  date: Date;
  inMonth: boolean;
  inSubscriptionRange: boolean;
  isToday: boolean;
};

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTodayDateKeyInIST(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function normalizeScheduleDateKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = String(raw).trim();
  // Plain calendar date — already IST-safe.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // Postgres serializes DATE columns as "YYYY-MM-DDT00:00:00.000Z". Treat that as the
  // calendar date directly (do NOT shift it through IST or it goes one day forward).
  if (/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.\d+)?Z$/.test(value)) return value.slice(0, 10);
  // For real timestamps we must convert through IST so e.g. "2026-04-30T20:30:00Z" → "2026-05-01".
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const fallback = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(fallback) ? fallback : null;
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function buildNormalizedDateKeySet(values: Array<string | null | undefined>): Set<string> {
  const set = new Set<string>();
  values.forEach((value) => {
    const key = normalizeScheduleDateKey(value);
    if (key) set.add(key);
  });
  return set;
}

/**
 * Show the delivery slot exactly as chosen. When deliveryTimeSlots are available,
 * match the raw HH:MM value to the configured slot's full label (e.g. "06:00 AM - 09:00 AM").
 * Falls back to converting bare 24h clock to 12h AM/PM format.
 */
function formatSubscriptionDeliveryTimeDisplay(
  raw: string | null | undefined,
  slots: Array<{ value: string; label: string }> = [],
): string {
  if (raw == null || String(raw).trim() === '') return '—';
  const s = String(raw).trim();

  // If it already looks like a range label, show as-is.
  if (/[-–]/.test(s)) return s;

  // Strip trailing seconds to get HH:MM for slot lookup.
  const slotKey = s.replace(/^(\d{1,2}:\d{2}):\d{2}$/, '$1').padStart(5, '0');

  // Try to match against configured slot values (e.g. "06:00" → "06:00 AM - 09:00 AM").
  if (slots.length > 0) {
    const matched = slots.find((slot) => {
      const slotVal = String(slot.value || '').trim().replace(/^(\d{1,2}:\d{2}):\d{2}$/, '$1').padStart(5, '0');
      return slotVal === slotKey;
    });
    if (matched?.label) return matched.label.trim();
  }

  // Fallback: convert bare 24h time to 12h AM/PM.
  const match = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return s;

  const h = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return s;

  const period = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(min).padStart(2, '0')} ${period}`;
}

const CANCELLED_DATES_LOCAL_STORAGE_PREFIX = 'milko_cancelled_dates_';
// Older builds wrote a single-date string under "milko_cancel_today_<id>" — read it for backward compat.
const LEGACY_CANCEL_TODAY_LOCAL_STORAGE_PREFIX = 'milko_cancel_today_';

function readLocalCancelledDates(subscriptionId: string): Set<string> {
  const set = new Set<string>();
  if (typeof window === 'undefined') return set;
  try {
    const raw = window.localStorage.getItem(`${CANCELLED_DATES_LOCAL_STORAGE_PREFIX}${subscriptionId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item)) set.add(item);
        }
      }
    }
    const legacy = window.localStorage.getItem(`${LEGACY_CANCEL_TODAY_LOCAL_STORAGE_PREFIX}${subscriptionId}`);
    if (legacy && /^\d{4}-\d{2}-\d{2}$/.test(legacy)) {
      set.add(legacy);
    }
  } catch {
    // ignore
  }
  return set;
}

function writeLocalCancelledDates(subscriptionId: string, dates: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    const arr = [...dates].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    window.localStorage.setItem(
      `${CANCELLED_DATES_LOCAL_STORAGE_PREFIX}${subscriptionId}`,
      JSON.stringify(arr),
    );
    // Drop the legacy single-date entry once we've migrated to the array form.
    window.localStorage.removeItem(`${LEGACY_CANCEL_TODAY_LOCAL_STORAGE_PREFIX}${subscriptionId}`);
  } catch {
    // ignore
  }
}

function getDayOffset(startStr: string, currentStr: string): number {
  const d1 = new Date(startStr + 'T00:00:00Z');
  const d2 = new Date(currentStr + 'T00:00:00Z');
  const diffMs = d2.getTime() - d1.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function getCalendarDayClassName(
  cell: CalendarCell,
  dateRange: { start: Date; end: Date },
  scheduleByDate: Map<string, 'pending' | 'delivered' | 'skipped' | 'cancelled'>,
  pausedDateSet: Set<string>,
  css: {
    dayCell: string;
    dayMuted: string;
    dayOutOfRange: string;
    dayDelivered: string;
    dayPending: string;
    dayCancelled: string;
    dayPaused: string;
    dayToday: string;
    dayShifted: string;
  },
  shiftHighlight: { applied: boolean; shiftedDayKey: string | null },
  frequency: string,
  startDateYmd: string,
  durationDays: number,
): string {
  const parts: string[] = [css.dayCell];
  if (!cell.inMonth) {
    parts.push(css.dayMuted);
    return parts.join(' ');
  }

  const currentOnly = dateOnly(cell.date);
  const key = formatDateKey(cell.date);
  const inRange = currentOnly >= dateRange.start && currentOnly <= dateRange.end;

  if (!inRange) {
    parts.push(css.dayOutOfRange);
    if (cell.isToday) parts.push(css.dayToday);
    return parts.join(' ');
  }

  const st = scheduleByDate.get(key);
  if (st === 'delivered') {
    parts.push(css.dayDelivered);
  } else if (st === 'cancelled' || st === 'skipped') {
    parts.push(css.dayCancelled);
  } else if (st === 'pending') {
    parts.push(css.dayPending);
  } else if (pausedDateSet.has(key)) {
    parts.push(css.dayPaused);
  } else {
    const offset = getDayOffset(startDateYmd, key);
    let step = 1;
    if (frequency === 'alternate') step = 2;
    else if (frequency === 'weekly') step = 7;
    else if (frequency === 'monthly') step = 30;

    const N = Math.max(1, Math.floor((durationDays - 1) / step) + 1);
    const isScheduled = (offset % step === 0) && (offset / step >= 0) && (offset / step < N);

    if (isScheduled) {
      parts.push(css.dayPending);
    }
  }

  if (shiftHighlight.applied && shiftHighlight.shiftedDayKey && key === shiftHighlight.shiftedDayKey) {
    parts.push(css.dayShifted);
  }

  if (cell.isToday) parts.push(css.dayToday);
  return parts.join(' ');
}

function fmtFullDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const localDay = parseLocalDateFromYmd(iso);
  const d = localDay ?? new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month}, ${year}`;
}

function startOfMonth(input: Date) {
  return new Date(input.getFullYear(), input.getMonth(), 1);
}

function dateOnly(input: Date) {
  return new Date(input.getFullYear(), input.getMonth(), input.getDate());
}

function addDays(input: Date, days: number) {
  const next = new Date(input);
  next.setDate(next.getDate() + days);
  return next;
}

/** IST midnight on the calendar day after subscription `end_date` (same rule as backend AutoPay charge). */
function formatNextAutopayAtIst(endDateIso: string): string {
  const endStr = (endDateIso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endStr)) return '—';
  const endStartIst = new Date(`${endStr}T00:00:00+05:30`);
  const chargeAt = new Date(endStartIst.getTime() + 24 * 60 * 60 * 1000);
  const timePart = chargeAt.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const datePart = chargeAt.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${timePart}, ${datePart}`;
}

function getRenewedAtValue(sub: Subscription): string | null {
  const anySub = sub as Subscription & {
    renewedAt?: string;
    renewalDate?: string;
    lastRenewedAt?: string;
    renewedOn?: string;
  };
  const candidate =
    anySub.renewedAt
    || anySub.renewalDate
    || anySub.lastRenewedAt
    || anySub.renewedOn
    || null;
  if (!candidate) return null;
  const purchased = sub.purchasedAt || sub.createdAt;
  if (purchased && formatDateKey(new Date(candidate)) === formatDateKey(new Date(purchased))) {
    return null;
  }
  return candidate;
}

function buildCalendarCells(month: Date, rangeStart: Date, rangeEnd: Date): CalendarCell[] {
  const firstDay = startOfMonth(month);
  const weekStartsOn = 0;
  const gridStart = addDays(firstDay, -(firstDay.getDay() - weekStartsOn + 7) % 7);
  const today = dateOnly(new Date());
  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i += 1) {
    const current = addDays(gridStart, i);
    const currentOnly = dateOnly(current);
    cells.push({
      date: current,
      inMonth: current.getMonth() === month.getMonth(),
      inSubscriptionRange: currentOnly >= rangeStart && currentOnly <= rangeEnd,
      isToday: currentOnly.getTime() === today.getTime(),
    });
  }

  return cells;
}

type BadgeVariant =
  | 'active'
  | 'paused'
  | 'pending'
  | 'expired'
  | 'cancelled'
  | 'failed'
  /** Trial row: DB may be `active` after delivery/payment; customer never sees plain “Active” until `isTrial` is false. */
  | 'trialOngoing';

function getStatusPresentation(
  sub: Subscription,
): { label: string; variant: BadgeVariant; showTick: boolean } {
  if (sub.isTrial) {
    if (sub.status === 'expired') return { label: 'Trial expired', variant: 'expired', showTick: false };
    if (sub.status === 'cancelled') return { label: 'Trial cancelled', variant: 'cancelled', showTick: false };
    if (sub.status === 'pending') return { label: 'Trial · Pending', variant: 'pending', showTick: false };
    if (sub.status === 'paused') return { label: 'Trial · Paused', variant: 'paused', showTick: false };
    if (sub.status === 'active') return { label: 'Trial · Ongoing', variant: 'trialOngoing', showTick: false };
    if (sub.status === 'failed') return { label: 'Trial · Failed', variant: 'failed', showTick: false };
    return { label: 'Trial', variant: 'trialOngoing', showTick: false };
  }
  if (sub.status === 'cancelled') return { label: 'Cancelled', variant: 'cancelled', showTick: false };
  if (sub.status === 'expired') return { label: 'Expired', variant: 'expired', showTick: false };
  if (sub.status === 'paused') return { label: 'Paused', variant: 'paused', showTick: false };
  if (sub.status === 'pending') return { label: 'Pending', variant: 'pending', showTick: false };
  if (sub.status === 'failed') return { label: 'Failed', variant: 'failed', showTick: false };
  return { label: 'Active', variant: 'active', showTick: true };
}

function getStatusBadgeClass(variant: BadgeVariant): string {
  if (variant === 'active') return styles.statusBadgeActive;
  if (variant === 'trialOngoing') return styles.statusBadgeTrialOngoing;
  if (variant === 'paused') return styles.statusBadgePaused;
  if (variant === 'pending') return styles.statusBadgePending;
  if (variant === 'cancelled') return styles.statusBadgeCancelled;
  if (variant === 'failed') return styles.statusBadgeFailed;
  return styles.statusBadgeExpired;
}

export default function SubscriptionDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const subscriptionId = params?.id as string;
  const { showToast } = useToast();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [autopayBusy, setAutopayBusy] = useState(false);
  const [deleteAutopayBusy, setDeleteAutopayBusy] = useState(false);
  const [renewBusy, setRenewBusy] = useState(false);
  const [error, setError] = useState('');
  const [showCancelTodayModal, setShowCancelTodayModal] = useState(false);
  const [showCancelSubscriptionModal, setShowCancelSubscriptionModal] = useState(false);
  const [showRefundBreakup, setShowRefundBreakup] = useState(false);
  const [helpSupportNumber, setHelpSupportNumber] = useState<string>('');
  const [todayIstKey, setTodayIstKey] = useState(() => getTodayDateKeyInIST());
  /** Delivery time slot labels fetched from subscription_delivery content config. */
  const [deliveryTimeSlots, setDeliveryTimeSlots] = useState<Array<{ value: string; label: string }>>([]);
  /** Locally-tracked cancelled YYYY-MM-DD keys per subscription so the customer's calendar/buttons
   *  reflect their own cancellations across reloads even if the backend response shape is stale. */
  const [localCancelledDates, setLocalCancelledDates] = useState<Set<string>>(() => new Set());

  const fetchSubscription = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    setError('');
    try {
      const data = await subscriptionsApi.getById(subscriptionId);
      setSubscription(data);
    } catch (e) {
      const message = (e as { message?: string })?.message || 'Failed to load subscription details';
      // Some backend detail routes reject trial subscriptions (especially expired ones) while
      // the user's subscription list still contains them. Fall back to the list endpoint so
      // customers can open their own trial subscription detail page regardless of status.
      try {
        const allSubscriptions = await subscriptionsApi.getAll();
        const found = allSubscriptions.find((sub) => String(sub.id) === String(subscriptionId));
        if (found) {
          setSubscription(found);
          setError('');
          return;
        }
      } catch {
        // keep original detail error below
      }
      setSubscription(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  useEffect(() => {
    const tick = () => setTodayIstKey(getTodayDateKeyInIST());
    tick();
    const id = setInterval(tick, 30 * 1000);
    return () => clearInterval(id);
  }, []);

  // Hydrate the historical set of locally-cancelled days for this subscription. These persist
  // for the whole subscription period (auto-purged only when the subscription is gone) so the
  // calendar can keep showing the red marker for any day the customer has cancelled.
  useEffect(() => {
    if (!subscriptionId) {
      setLocalCancelledDates(new Set());
      return;
    }
    setLocalCancelledDates(readLocalCancelledDates(subscriptionId));
  }, [subscriptionId]);

  useEffect(() => {
    contentApi.getByType('help_support').then((c) => {
      setHelpSupportNumber((c?.metadata as { helpSupportNumber?: string })?.helpSupportNumber || '');
    }).catch(() => setHelpSupportNumber(''));
  }, []);

  // Load delivery time slot labels so we can show the full range (e.g. "06:00 AM - 09:00 AM").
  useEffect(() => {
    contentApi.getByType('subscription_delivery').then((c) => {
      const meta = (c?.metadata || {}) as { deliveryTimeSlots?: Array<{ value: string; label: string }> };
      const slots = Array.isArray(meta.deliveryTimeSlots)
        ? meta.deliveryTimeSlots
            .map((s) => ({ value: String(s?.value || '').trim(), label: String(s?.label || '').trim() }))
            .filter((s) => s.value && s.label)
        : [];
      setDeliveryTimeSlots(slots);
    }).catch(() => setDeliveryTimeSlots([]));
  }, []);

  const dateRange = useMemo(() => {
    if (!subscription) return null;
    // Always use API start/end (purchase day = day 1). Do not clamp start to `purchasedAt`:
    // `new Date(purchasedAt)` in the browser TZ can fall on the *next* calendar day vs IST
    // while `start_date` stays the correct subscription day — then the first day looks "missing" on the calendar.
    return {
      start: dateOnly(parseLocalDateFromYmd(subscription.startDate) ?? new Date(subscription.startDate)),
      end: dateOnly(parseLocalDateFromYmd(subscription.endDate) ?? new Date(subscription.endDate)),
    };
  }, [subscription]);

  const calendarMonths = useMemo(() => {
    if (!dateRange) return [];
    const months: Date[] = [];
    const cursor = startOfMonth(dateRange.start);
    const endMonth = startOfMonth(dateRange.end);
    while (cursor <= endMonth) {
      months.push(new Date(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }, [dateRange]);

  // Shift UI follows API `firstDayShiftApplied` / `firstDayShiftReason`.
  // - Trial packs: set at purchase in `createTrialPack` (same slot rules as full subs); activation does not double-count.
  // - Set on activate or manual renew when payment is after the slot end (IST).
  // - Stays visible for the full current period even if AutoPay is linked mid-period; cleared when a new period
  //   starts from successful AutoPay renewal (`applyAutopaySubscriptionRenewalFromPayment`).
  // - After expiry, manual renew evaluates slot-shift again at payment time.
  const shiftCalendarHighlight = useMemo(
    () => ({
      applied: !!subscription?.firstDayShiftApplied,
      /** Calendar day that missed the slot (start_date); bonus day at end_date stays normal “scheduled” styling. */
      shiftedDayKey:
        subscription?.firstDayShiftApplied && dateRange ? formatDateKey(dateRange.start) : null,
    }),
    [subscription?.firstDayShiftApplied, dateRange],
  );

  const scheduleByDate = useMemo(() => {
    const m = new Map<string, 'pending' | 'delivered' | 'skipped' | 'cancelled'>();
    subscription?.deliverySchedules?.forEach((s) => {
      const key = normalizeScheduleDateKey(s.deliveryDate);
      if (key) m.set(key, s.status);
    });
    // Overlay every locally-cancelled day so the calendar keeps showing the red cell for the
    // customer's own cancellations, regardless of what the backend currently returns.
    localCancelledDates.forEach((dateKey) => {
      const existing = m.get(dateKey);
      if (existing !== 'delivered') {
        m.set(dateKey, 'cancelled');
      }
    });
    return m;
  }, [subscription, localCancelledDates]);

  const pausedDateSet = useMemo(() => {
    const set = buildNormalizedDateKeySet(subscription?.pausedDates ?? []);
    localCancelledDates.forEach((dateKey) => set.add(dateKey));
    return set;
  }, [subscription?.pausedDates, localCancelledDates]);

  const todayStatus = useMemo(() => scheduleByDate.get(todayIstKey), [scheduleByDate, todayIstKey]);

  const isTodayCancellationLocked = useMemo(() => {
    if (localCancelledDates.has(todayIstKey)) return true;
    if (todayStatus === 'delivered') return true;
    if (todayStatus === 'cancelled' || todayStatus === 'skipped') return true;
    if (pausedDateSet.has(todayIstKey)) return true;
    // Lock if today has no scheduled delivery entry at all.
    // This covers: (1) the shifted first day for all frequencies, and
    // (2) gap days between deliveries for alternate/weekly/monthly subscriptions.
    if (!scheduleByDate.has(todayIstKey)) return true;
    return false;
  }, [localCancelledDates, pausedDateSet, scheduleByDate, todayIstKey, todayStatus]);

  const cancelTodayLabel = useMemo(() => {
    if (localCancelledDates.has(todayIstKey)) return 'Today already cancelled';
    if (todayStatus === 'delivered') return 'Today already delivered';
    if (todayStatus === 'cancelled' || todayStatus === 'skipped' || pausedDateSet.has(todayIstKey)) {
      return 'Today already cancelled';
    }
    // No delivery entry for today — either a shifted first day or a gap day between deliveries.
    if (!scheduleByDate.has(todayIstKey)) {
      return 'No delivery scheduled today';
    }
    return "Cancel Today's Delivery";
  }, [localCancelledDates, pausedDateSet, scheduleByDate, todayIstKey, todayStatus]);

  const firstDayShiftSlotLabel =
    subscription?.firstDayShiftReason === 'evening_slot_passed'
      ? 'evening'
      : subscription?.firstDayShiftReason === 'morning_slot_passed'
        ? 'morning'
        : 'delivery';

  const shiftedFirstDayCalendarTitle = useMemo(() => {
    if (!subscription?.firstDayShiftApplied) return 'Shifted first delivery day';
    if (subscription.firstDayShiftReason === 'purchased_within_delivery_window') {
      return 'Shifted first calendar day — ordered during your delivery window; first day skipped in the schedule with an extra day at the end';
    }
    return 'Shifted first delivery day — purchase was after your delivery window ended (an extra day was added at the end of your plan)';
  }, [subscription?.firstDayShiftApplied, subscription?.firstDayShiftReason]);

  const extensionText = useMemo(() => {
    const freq = (subscription?.frequency || 'daily').toLowerCase();
    if (freq === 'alternate') return 'two days';
    if (freq === 'weekly') return 'seven days';
    if (freq === 'monthly') return '30 days';
    return 'one day';
  }, [subscription?.frequency]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.loading}>Loading subscription details...</div>
        </div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className={styles.container} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '1.5rem 2rem 2rem 2rem',
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 1px 1px #0003',
          border: '1px solid #ddd',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <svg 
            viewBox="0 0 400 400" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: '150px', height: '150px', marginBottom: '20px' }}
          >
            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
            <g id="SVGRepo_iconCarrier"> 
              <path d="M165.422 118C143.491 123.058 126.618 136.955 111.006 152.01" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path> 
              <path d="M253.848 119.7C272.72 119.749 287.787 143.995 292.959 150.309" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path> 
              <path d="M146.715 192.716C166.576 207.398 186.752 202.825 199.43 182.619" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path> 
              <path d="M247.044 186.02C259.746 201.095 271.399 201.577 284.455 189.018" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path> 
              <path d="M179.026 261.873C206.732 247.414 225.946 248.579 245.345 271.044" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path> 
              <path d="M117.967 216.629C158.934 302.598 57.9977 313.358 108.496 224.768" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path> 
            </g>
          </svg>
          <div className={styles.error} style={{ padding: 0, marginBottom: '20px', fontWeight: 700, fontSize: '1.3rem', color: 'rgb(26 26 26)' }}>
            {error || 'Subscription not found'}
          </div>
          <div style={{ 
            marginTop: '8px', 
            marginBottom: '24px', 
            padding: '16px', 
            background: 'rgb(242 241 246)', 
            borderRadius: '12px', 
            border: '1px solid rgb(242 241 246)',
            width: '100%' 
          }}>
            <p style={{ 
              margin: '0 0 16px 0', 
              fontSize: '0.9rem', 
              color: '#4b5563', 
              lineHeight: '1.5' 
            }}>
              If you are facing any issues or errors, please contact us on WhatsApp for quick support.
            </p>
            <button
              type="button"
              onClick={() => {
                const raw = (helpSupportNumber || '').trim();
                if (!raw) {
                  showToast('Help number not configured', 'error');
                  return;
                }
                if (/^https?:\/\//i.test(raw)) {
                  window.open(raw, '_blank');
                } else {
                  const digits = raw.replace(/\D/g, '');
                  window.open(`https://wa.me/${digits || '919999999999'}`, '_blank');
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'rgb(0 173 65)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0s ease',
                width: '100%'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#20ba5a';
                e.currentTarget.style.transform = 'translateY(0px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#25D366';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <svg 
                viewBox="0 0 24 24" 
                width="20" 
                height="20" 
                fill="currentColor"
              >
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.968C16.59 2.007 14.12 1.002 11.488 1c-5.442 0-9.87 4.372-9.874 9.802-.001 1.73.469 3.414 1.36 4.916l-.993 3.629 3.734-.972l.932.525zm11.396-7.39c-.27-.135-1.602-.79-1.85-.88-.25-.09-.432-.135-.612.135-.18.27-.697.88-.855 1.06-.157.18-.315.2-.585.065-.27-.135-1.14-.42-2.17-1.34-.802-.717-1.343-1.604-1.5-1.875-.158-.271-.017-.417.118-.552.122-.121.27-.315.405-.471.135-.158.18-.27.27-.45.09-.18.045-.338-.022-.473-.068-.135-.613-1.477-.84-2.023-.22-.53-.443-.458-.612-.466-.16-.008-.344-.01-.528-.01-.184 0-.485.07-.74.35-.254.277-.97.95-.97 2.317 0 1.368.994 2.69 1.133 2.88.138.19 1.956 2.99 4.74 4.19.662.285 1.178.455 1.58.583.665.21 1.27.18 1.75.108.533-.08 1.602-.656 1.828-1.29.225-.633.225-1.176.157-1.29-.067-.112-.25-.202-.52-.337z"/>
              </svg>
              Contact on WhatsApp
            </button>
          </div>
          <Link href="/subscriptions" className={styles.backLink} style={{ margin: 0, color: '#0070f3', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem' }}>
            ← Back to plans
          </Link>
        </div>
      </div>
    );
  }

  /** Same numeric id as admin subscription deliveries (`#subscriptionId`). */
  const orderId = subscription.id;
  const paidAmount = subscription.totalAmountPaid ?? subscription.totalAmount ?? 0;
  const isTrialSubscription = subscription.isTrial === true;
  const canManage = subscription.status === 'active' || subscription.status === 'paused';
  const hasAutopayMandate =
    subscription.autopayStatus === 'authenticated'
    || subscription.autopayStatus === 'active';
  const nextAutopayDateDisplay = formatNextAutopayAtIst(subscription.endDate);
  const subscriptionItemName = subscription.product?.name || 'this item';
  const formatInr = (value: number) =>
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  const purchasedAtValue = subscription.purchasedAt || subscription.createdAt || null;
  const renewedAtValue = getRenewedAtValue(subscription);
  const effectiveStart =
    dateRange?.start ??
    dateOnly(parseLocalDateFromYmd(subscription.startDate) ?? new Date(subscription.startDate));
  // Never use Date.toISOString() for labels: IST midnight becomes previous UTC date, so fmtFullDate
  // would show one calendar day *earlier* than start_date while the calendar uses startDate → mismatch.
  const startYmdRaw = subscription.startDate ? String(subscription.startDate).slice(0, 10) : '';
  const initialYmdRaw = subscription.initialStartDate ? String(subscription.initialStartDate).slice(0, 10) : '';
  const displayDeliveryStart =
    (/^\d{4}-\d{2}-\d{2}$/.test(startYmdRaw) && startYmdRaw) ||
    (/^\d{4}-\d{2}-\d{2}$/.test(initialYmdRaw) && initialYmdRaw) ||
    formatDateKey(effectiveStart);
  const start = effectiveStart;
  const end =
    dateRange?.end ??
    dateOnly(parseLocalDateFromYmd(subscription.endDate) ?? new Date(subscription.endDate));
  const shiftedFromText = start.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const shiftedToText = end.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays =
    subscription.durationDays != null && subscription.durationDays >= 1
      ? subscription.durationDays
      : Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay) + 1);
  // Only delivered (green) days are counted as used for refund calculation.
  const deliveredDays = subscription.deliverySchedules?.filter((d) => d.status === 'delivered').length ?? 0;
  const usedDays = Math.min(totalDays, Math.max(0, deliveredDays));
  const unusedDays = Math.max(0, totalDays - usedDays);
  const totalPaid = Number(paidAmount) || 0;
  const platformFee = Number(subscription.platformFee) || 0;
  const productCost = Math.max(0, totalPaid - platformFee);
  const unusedAmount = totalDays > 0 ? (productCost / totalDays) * unusedDays : 0;
  const unusedAmountInr = formatInr(Math.max(0, unusedAmount));
  const status = getStatusPresentation(subscription);
  const badgeClass = getStatusBadgeClass(status.variant);
  const isCancelledSubscription = subscription.status === 'cancelled';
  const trialCreditOffer = Number(subscription.trialCreditAmount ?? subscription.totalAmountPaid ?? subscription.totalAmount ?? 0);
  const startFullSubscriptionHref = (() => {
    const params = new URLSearchParams();
    params.set('productId', String(subscription.productId));
    if (subscription.variationId) params.set('variationId', String(subscription.variationId));
    params.set('trialSubscriptionId', String(subscription.id));
    params.set('trialCredit', String(trialCreditOffer));
    params.set('trial', '1');
    params.set('renew', '1');
    params.set('lockProduct', '1');
    return `/subscribe?${params.toString()}`;
  })();
  const expiryDateForDisplay = isCancelledSubscription
    ? (subscription.cancelledAt || null)
    : subscription.endDate;
  const expiryTextForDisplay = expiryDateForDisplay ? fmtFullDate(expiryDateForDisplay) : 'N/A';
  const endLabel = subscription.status === 'cancelled' ? 'Ended' : 'Ends';

  const showCodPendingNotice =
    subscription.status === 'pending' &&
    (Boolean(subscription.checkoutOrderId) || Boolean(subscription.trialCheckoutOrderId));
  const paymentMethodLc = String(subscription.paymentMethod || '').toLowerCase();
  const isTrialCodPendingBanner =
    isTrialSubscription &&
    paymentMethodLc === 'cod' &&
    showCodPendingNotice &&
    Boolean(subscription.trialCheckoutOrderId);
  const trialCodAmountDue =
    subscription.trialCheckoutOrderTotal != null && Number.isFinite(Number(subscription.trialCheckoutOrderTotal))
      ? Number(subscription.trialCheckoutOrderTotal)
      : Number(subscription.totalAmount ?? paidAmount ?? 0);
  /** Checkout COD (or any pending): no AutoPay until subscription is Active */
  const autopayActionsDisabled = !canManage;

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {showCodPendingNotice ? (
          <>
            {isTrialCodPendingBanner ? (
              <p className={styles.trialCodPaymentTitle} aria-hidden>
                COD
              </p>
            ) : null}
            <p className={styles.codPendingNotice} role="status">
            {isTrialCodPendingBanner ? (
              <>
                To pay <strong>₹{trialCodAmountDue.toFixed(2)}</strong> to the delivery agent when your order is delivered.
              </>
            ) : (
              <>
                Subscription will be marked as <strong>Active</strong> when the COD amount is received from you at delivery.
                Until then it stays <strong>Pending</strong> and becomes <strong>Active</strong> when an admin marks your
                order as <strong>delivered</strong>.
              </>
            )}
            </p>
          </>
        ) : null}
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>{subscription.product?.name || 'Plan'}</h1>
          <div className={styles.headerBadges}>
            {isTrialSubscription ? (
              <span className={styles.customerTrialBadge} title="This plan is a trial until you start a full plan">
                Trial
              </span>
            ) : null}
            <div className={`${styles.statusBadge} ${badgeClass}`}>
              {status.showTick && (
                <svg className={styles.statusBadgeTick} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path fillRule="evenodd" clipRule="evenodd" d="M16.0303 8.96967C16.3232 9.26256 16.3232 9.73744 16.0303 10.0303L11.0303 15.0303C10.7374 15.3232 10.2626 15.3232 9.96967 15.0303L7.96967 13.0303C7.67678 12.7374 7.67678 12.2626 7.96967 11.9697C8.26256 11.6768 8.73744 11.6768 9.03033 11.9697L10.5 13.4393L12.7348 11.2045L14.9697 8.96967C15.2626 8.67678 15.7374 8.67678 16.0303 8.96967Z" fill="currentColor" />
                </svg>
              )}
              {status.label}
            </div>
          </div>
        </div>

        <div className={styles.metaRow}>
          <span className={styles.metaText}>
            {subscription.litresPerDay} x {subscription.variationSize || '1L'}/day
          </span>
          <span className={styles.metaMuted}>
            {' • '}
            {endLabel} {expiryTextForDisplay}
            {' • '}
            ₹{Number(paidAmount).toFixed(2)}
          </span>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            {isTrialSubscription ? 'Product' : subscription.status === 'active' ? "Today's Item to deliver" : 'Product'}
          </h2>
          <div className={styles.productRow}>
            <div className={styles.productThumb}>
              {subscription.product?.imageUrl ? (
                <img src={subscription.product.imageUrl} alt="" />
              ) : (
                <span className={styles.productThumbPlaceholder} aria-hidden>🥛</span>
              )}
            </div>
            <div>
              <p className={styles.productBlockName}>{subscription.product?.name || 'Product'}</p>
              <p className={styles.productBlockMeta}>
                {subscription.litresPerDay} x {subscription.variationSize || '1L'}/day • Delivery{' '}
                {formatSubscriptionDeliveryTimeDisplay(subscription.deliveryTime, deliveryTimeSlots)}
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Delivery address</h2>
          <div className={styles.deliveryAddressBlock}>
            {subscription.deliveryAddress ? (
              <>
                <p className={styles.deliveryAddressName}>{subscription.deliveryAddress.name}</p>
                <p className={styles.deliveryAddressLine}>{subscription.deliveryAddress.street}</p>
                <p className={styles.deliveryAddressLine}>
                  {subscription.deliveryAddress.city}, {subscription.deliveryAddress.state} {subscription.deliveryAddress.postalCode}
                </p>
                <p className={styles.deliveryAddressLine}>{subscription.deliveryAddress.country}</p>
                {subscription.deliveryAddress.phone ? (
                  <p className={styles.deliveryAddressLine}>Phone: {subscription.deliveryAddress.phone}</p>
                ) : null}
              </>
            ) : (
              <p className={styles.deliveryAddressLine}>No delivery address selected for this plan.</p>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Delivery calendar</h2>
          <div className={styles.calendarHint} role="list" aria-label="Calendar legend">
            <span className={styles.calendarHintItem} role="listitem">
              <span className={`${styles.calendarHintDot} ${styles.calendarHintDotDelivered}`} aria-hidden />
              Delivered
            </span>
            <span className={styles.calendarHintItem} role="listitem">
              <span className={`${styles.calendarHintDot} ${styles.calendarHintDotScheduled}`} aria-hidden />
              Scheduled
            </span>
            <span className={styles.calendarHintItem} role="listitem">
              <span className={`${styles.calendarHintDot} ${styles.calendarHintDotCancelled}`} aria-hidden />
              Cancelled / skipped
            </span>
            <span className={styles.calendarHintItem} role="listitem">
              <span className={`${styles.calendarHintDot} ${styles.calendarHintDotPaused}`} aria-hidden />
              Plan Period
            </span>
            {subscription.firstDayShiftApplied ? (
              <span className={styles.calendarHintItem} role="listitem">
                <span className={`${styles.calendarHintDot} ${styles.calendarHintDotShifted}`} aria-hidden />
                Shifted
              </span>
            ) : null}
          </div>
          <div className={styles.calendarList}>
            {dateRange && calendarMonths.map((month) => {
              const cells = buildCalendarCells(month, dateRange.start, dateRange.end);
              return (
                <div key={`${month.getFullYear()}-${month.getMonth()}`} className={styles.calendarCard}>
                  <div className={styles.calendarMonth}>
                    {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </div>
                  <div className={styles.weekLabels}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                  <div className={styles.calendarGrid}>
                    {cells.map((cell) => (
                      <div
                        key={cell.date.toISOString()}
                        className={getCalendarDayClassName(
                          cell,
                          dateRange,
                          scheduleByDate,
                          pausedDateSet,
                          {
                            dayCell: styles.dayCell,
                            dayMuted: styles.dayMuted,
                            dayOutOfRange: styles.dayOutOfRange,
                            dayDelivered: styles.dayDelivered,
                            dayPending: styles.dayPending,
                            dayCancelled: styles.dayCancelled,
                            dayPaused: styles.dayPaused,
                            dayToday: styles.dayToday,
                            dayShifted: styles.dayShifted,
                          },
                          shiftCalendarHighlight,
                          subscription.frequency || 'daily',
                          displayDeliveryStart,
                          totalDays,
                        )}
                        title={
                          cell.inMonth && cell.inSubscriptionRange
                            ? (() => {
                                const k = formatDateKey(cell.date);
                                const st = scheduleByDate.get(k);
                                const isShiftedFirstDay =
                                  shiftCalendarHighlight.applied &&
                                  shiftCalendarHighlight.shiftedDayKey &&
                                  k === shiftCalendarHighlight.shiftedDayKey;
                                if (isShiftedFirstDay) {
                                  return shiftedFirstDayCalendarTitle;
                                }
                                if (st === 'delivered') return 'Delivered';
                                if (st === 'cancelled' || st === 'skipped') return 'Delivery cancelled / skipped';
                                if (st === 'pending') return 'Scheduled (not delivered yet)';
                                if (pausedDateSet.has(k)) return 'Paused (no delivery)';

                                // Calculate frequency-based scheduled status for fallback or pending
                                const offset = getDayOffset(displayDeliveryStart, k);
                                const freq = subscription.frequency || 'daily';
                                let step = 1;
                                if (freq === 'alternate') step = 2;
                                else if (freq === 'weekly') step = 7;
                                else if (freq === 'monthly') step = 30;

                                const N = Math.max(1, Math.floor((totalDays - 1) / step) + 1);
                                const isScheduled = (offset % step === 0) && (offset / step >= 0) && (offset / step < N);
                                return isScheduled ? 'Scheduled' : 'No delivery scheduled';
                              })()
                            : undefined
                        }
                      >
                        {cell.date.getDate()}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {subscription.firstDayShiftApplied ? (
            <p className={styles.calendarShiftNote}>
              <span className={styles.calendarShiftNoteDot} aria-hidden />
              <span>
                <strong>Shifted</strong> — Plan spans <strong>{shiftedFromText}</strong> to <strong>{shiftedToText}</strong>.
                {subscription.firstDayShiftReason === 'purchased_within_delivery_window' ? (
                  <>
                    {' '}
                    The first calendar day is skipped for scheduling, and one extra delivery day was added at the end,
                    because you purchased during today&apos;s delivery window for your selected slot.
                  </>
                ) : (
                  <>
                    {' '}
                    The system automatically added an extra delivery day at the end because this subscription was bought
                    or renewed after your selected {firstDayShiftSlotLabel} delivery window had already ended today.
                  </>
                )}
                <span className={styles.calendarShiftNoteMeta} />
              </span>
            </p>
          ) : null}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Plan details</h2>
          <div className={styles.detailsGrid}>
            {!isTrialSubscription ? (
              <>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Quantity</span>
              <span className={styles.detailValue}>
                {subscription.litresPerDay} x {subscription.variationSize || '1L'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Type</span>
              <span className={styles.detailValue}>
                {subscription.frequency === 'alternate'
                  ? 'Alternate Days'
                  : subscription.frequency === 'weekly'
                  ? 'Once a Week'
                  : subscription.frequency === 'monthly'
                  ? 'Once a Month'
                  : 'Daily'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Delivery start</span>
              <span className={styles.detailValue}>{fmtFullDate(displayDeliveryStart)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Expiry</span>
              <span className={styles.detailValue}>{expiryTextForDisplay}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Duration</span>
              <span className={styles.detailValue}>
                {subscription.durationDays != null && subscription.durationDays >= 1
                  ? `${subscription.durationDays} day${subscription.durationDays !== 1 ? 's' : ''}`
                  : `${subscription.durationMonths} month${subscription.durationMonths !== 1 ? 's' : ''}`}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Next Delivery</span>
              <span className={styles.detailValue}>{nextDeliveryShortLabelIST(subscription)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Purchased</span>
              <span className={styles.detailValue}>{fmtFullDate(purchasedAtValue)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Renewed</span>
              <span className={styles.detailValue}>{renewedAtValue ? fmtFullDate(renewedAtValue) : 'N/A'}</span>
            </div>
              </>
            ) : null}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Delivery time</span>
              <span className={styles.detailValue}>{formatSubscriptionDeliveryTimeDisplay(subscription.deliveryTime, deliveryTimeSlots)}</span>
            </div>
            {!isTrialSubscription ? (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Order ID</span>
              <button
                type="button"
                className={styles.copyValueBtn}
                onClick={() => {
                  navigator.clipboard.writeText(String(orderId)).then(() => showToast('Copied!', 'success')).catch(() => {});
                }}
              >
                {orderId}
              </button>
            </div>
            ) : null}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Total paid</span>
              <span className={styles.detailValue}>₹{Number(paidAmount).toFixed(2)}</span>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            {isTrialSubscription ? 'Start full plan' : (subscription.status === 'cancelled' || subscription.status === 'expired') ? 'Renew' : 'AutoPay'}
          </h2>
          {isTrialSubscription ? (
            <>
              <ul className={styles.trialInfoBullets}>
                <li>Continue with the same subscription product</li>
                <li>Your <strong>₹{trialCreditOffer.toFixed(2)}</strong> trial payment will be deducted from the full plan price</li>
                <li>Pay only the remaining amount</li>
              </ul>
              <div className={styles.autoPayActions}>
                <button
                  type="button"
                  className={styles.autoPayButton}
                  onClick={() => router.push(startFullSubscriptionHref)}
                >
                  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="white" className={styles.lightningIcon} stroke="white">
                    <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641l2.5-8.5z"></path>
                  </svg>
                  Start my full plan
                </button>
              </div>
            </>
          ) : subscription.status === 'cancelled' ? (
            <div className={styles.autoPayActions}>
              <button
                type="button"
                className={styles.autoPayButton}
                onClick={() => {
                  const redirectProductId = subscription.productId || subscription.product?.id;
                  const query = redirectProductId
                    ? `?from=cart&renew=1&productId=${encodeURIComponent(String(redirectProductId))}`
                    : '?from=cart&renew=1';
                  router.push(`/subscribe${query}`);
                }}
              >
                Create A New Plan
              </button>
            </div>
          ) : subscription.status === 'expired' ? (
            <>
              {subscription.autopayFailureReason ? (
                <p className={styles.autopayFailureNote}>{subscription.autopayFailureReason}</p>
              ) : null}
              <div className={styles.autoPayActions}>
              <button
                type="button"
                className={styles.autoPayButton}
                disabled={renewBusy}
                onClick={async () => {
                  const loadRazorpayScript = (): Promise<void> => {
                    if (typeof window !== 'undefined' && (window as unknown as { Razorpay?: unknown }).Razorpay) {
                      return Promise.resolve();
                    }
                    return new Promise((resolve, reject) => {
                      const s = document.createElement('script');
                      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
                      s.async = true;
                      s.onload = () => resolve();
                      s.onerror = () => reject(new Error('Failed to load Razorpay'));
                      document.head.appendChild(s);
                    });
                  };

                  try {
                    setRenewBusy(true);
                    const init = await subscriptionsApi.renewInit(subscription.id);
                    await loadRazorpayScript();
                    const Razorpay = (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }).Razorpay;
                    const rzp = new Razorpay({
                      key: init.razorpayOrder.key,
                      order_id: init.razorpayOrder.orderId,
                      currency: init.razorpayOrder.currency || 'INR',
                      name: SITE_NAME,
                      description: 'Plan renewal payment',
                      handler: async function (resp: { razorpay_payment_id: string; razorpay_order_id: string }) {
                        try {
                          await subscriptionsApi.renewVerify(subscription.id, {
                            razorpay_order_id: resp.razorpay_order_id,
                            razorpay_payment_id: resp.razorpay_payment_id,
                          });
                          showToast('Plan renewed successfully', 'success');
                          await fetchSubscription();
                        } catch (e) {
                          showToast((e as { message?: string })?.message || 'Renewal verification failed', 'error');
                        } finally {
                          setRenewBusy(false);
                        }
                      },
                      modal: {
                        ondismiss: () => setRenewBusy(false),
                      },
                    });
                    rzp.open();
                  } catch (e) {
                    setRenewBusy(false);
                    showToast((e as { message?: string })?.message || 'Failed to start renewal', 'error');
                  }
                }}
              >
                {renewBusy ? 'Please wait...' : 'Renew This Plan'}
              </button>
            </div>
            </>
          ) : (
            <>
              {hasAutopayMandate ? (
                <>
                  <p className={styles.autoPayText}>
                    AutoPay is active. Renewal is charged at the end of each period (IST midnight on the day after your last subscription day). Until then, your plan stays as it is.
                  </p>
                  <p className={styles.nextAutopayDateLine}>
                    <span className={styles.nextAutopayDateStrong}>Next Autopay date: </span>
                    {nextAutopayDateDisplay}
                    <span className={styles.nextAutopayDateHint}>
                      {' '}
                      (IST — 12:00 AM on the day after your subscription period ends; e.g. period ends 30 Apr → charge 1 May)
                    </span>
                  </p>
                  <p className={styles.autopayPolicyNote}>
                    Without AutoPay, the subscription ends when the period ends. With AutoPay, if renewal fails at that time we retry once; if it fails again, the subscription expires.
                  </p>
                  <div className={styles.autoPayActions}>
                    <button
                      type="button"
                      className={styles.deleteAutopayButton}
                      disabled={true}
                      onClick={async () => {
                        try {
                          setDeleteAutopayBusy(true);
                          await subscriptionsApi.removeAutopay(subscription.id);
                          showToast('AutoPay removed', 'success');
                          await fetchSubscription();
                        } catch (e) {
                          showToast((e as { message?: string })?.message || 'Failed to remove AutoPay', 'error');
                        } finally {
                          setDeleteAutopayBusy(false);
                        }
                      }}
                    >
                      {deleteAutopayBusy ? 'Please wait...' : 'Delete Autopay'}
                    </button>
                  </div>
                  <p style={{ marginTop: '16px', fontSize: '0.9rem', color: '#4b5563', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: '16px', height: '16px', flexShrink: 0 }}>
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Autopay has been disabled by our team due to inconsistency, <Link href="/contact" style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: '600' }}>contact</Link> to know more
                  </p>
                </>
              ) : (
                <>
                  <p className={styles.autoPayText}>
                    AutoPay is not linked yet. Without it, your subscription ends when the current period ends. When linked, renewal is charged at the end of the period—not before.
                  </p>
                  {autopayActionsDisabled ? (
                    <p className={styles.autopayPendingHint}>
                      {showCodPendingNotice
                        ? 'AutoPay can be set after your COD order is delivered and this subscription becomes Active.'
                        : 'AutoPay can be set once this subscription is Active.'}
                    </p>
                  ) : null}
                  <div className={styles.autoPayActions}>
                    <button
                      type="button"
                      className={styles.autoPayButton}
                      disabled={true}
                      onClick={async () => {
                        let openedRazorpay = false;
                        const loadRazorpayScript = (): Promise<void> => {
                          if (typeof window !== 'undefined' && (window as unknown as { Razorpay?: unknown }).Razorpay) {
                            return Promise.resolve();
                          }
                          return new Promise((resolve, reject) => {
                            const s = document.createElement('script');
                            s.src = 'https://checkout.razorpay.com/v1/checkout.js';
                            s.async = true;
                            s.onload = () => resolve();
                            s.onerror = () => reject(new Error('Failed to load Razorpay'));
                            document.head.appendChild(s);
                          });
                        };

                        try {
                          setAutopayBusy(true);
                          const resp = await subscriptionsApi.setupAutopay(subscription.id);
                          if (resp.shortUrl && (!resp.razorpaySubscriptionId || !resp.key)) {
                            window.location.href = resp.shortUrl;
                            return;
                          }
                          if (resp.alreadyLinked) {
                            showToast('AutoPay is already linked', 'success');
                            await fetchSubscription();
                            return;
                          }
                          if (!resp.razorpaySubscriptionId || !resp.key) {
                            throw new Error('AutoPay setup is incomplete. Razorpay subscription ID was not returned.');
                          }

                          await loadRazorpayScript();
                          const Razorpay = (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }).Razorpay;
                          const rzp = new Razorpay({
                            key: resp.key,
                            subscription_id: resp.razorpaySubscriptionId,
                            name: SITE_NAME,
                            description: 'Authenticate AutoPay mandate',
                            handler: async function (rzpResp: {
                              razorpay_payment_id: string;
                              razorpay_subscription_id?: string;
                              razorpay_signature?: string;
                            }) {
                              try {
                                await subscriptionsApi.verifyAutopaySetup(subscription.id, {
                                  razorpay_payment_id: rzpResp.razorpay_payment_id,
                                  razorpay_subscription_id: rzpResp.razorpay_subscription_id || resp.razorpaySubscriptionId,
                                  razorpay_signature: rzpResp.razorpay_signature,
                                });
                                showToast('AutoPay linked successfully. Redirecting to subscription details...', 'success');
                                await fetchSubscription();
                                window.setTimeout(() => {
                                  router.replace(`/subscriptions/${subscription.id}`);
                                }, 5000);
                              } catch (e) {
                                showToast((e as { message?: string })?.message || 'Failed to verify AutoPay', 'error');
                                await fetchSubscription();
                              } finally {
                                setAutopayBusy(false);
                              }
                            },
                            modal: {
                              ondismiss: async () => {
                                setAutopayBusy(false);
                                await fetchSubscription();
                              },
                            },
                          });
                          openedRazorpay = true;
                          rzp.open();
                        } catch (e) {
                          showToast((e as { message?: string })?.message || 'Failed to setup AutoPay', 'error');
                          await fetchSubscription();
                        } finally {
                          if (!openedRazorpay) {
                            setAutopayBusy(false);
                          }
                        }
                      }}
                    >
                      {autopayBusy ? 'Please wait...' : 'Set AutoPay'}
                    </button>
                  </div>
                  <p style={{ marginTop: '16px', fontSize: '0.9rem', color: '#4b5563', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: '16px', height: '16px', flexShrink: 0 }}>
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Autopay has been disabled by our team due to inconsistency, <Link href="/contact" style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: '600' }}>contact</Link> to know more
                  </p>
                </>
              )}
            </>
          )}
        </section>

        {((subscription.status !== 'cancelled' && subscription.status !== 'expired') || isTrialSubscription) && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Help</h2>
            <p className={styles.autoPayText}>Need Help with this subscription? Contact us regarding your doubt.</p>
            <div className={styles.autoPayActions}>
              <button
                type="button"
                className={styles.helpButton}
                onClick={() => {
                  const raw = (helpSupportNumber || '').trim();
                  if (!raw) {
                    showToast('Help number not configured', 'error');
                    return;
                  }
                  if (/^https?:\/\//i.test(raw)) {
                    window.open(raw, '_blank');
                  } else {
                    const digits = raw.replace(/\D/g, '');
                    window.open(`https://wa.me/${digits || '0'}`, '_blank');
                  }
                }}
              >
                <svg className={styles.deliveredActionBtnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Contact Us
              </button>
            </div>
          </section>
        )}

        {canManage && !isTrialSubscription && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Manage</h2>
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={busy || isTodayCancellationLocked}
                onClick={() => {
                  if (isTodayCancellationLocked) return;
                  setShowCancelTodayModal(true);
                }}
              >
                <svg className={styles.actionBtnIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="8.5" stroke="#222222"></circle>
                  <path d="M5 2.80385C4.08789 3.33046 3.33046 4.08788 2.80385 5" stroke="#222222" strokeLinecap="round"></path>
                  <path d="M19 2.80385C19.9121 3.33046 20.6695 4.08788 21.1962 5" stroke="#222222" strokeLinecap="round"></path>
                  <path d="M12 6.5V11.75C12 11.8881 12.1119 12 12.25 12H16.5" stroke="#222222" strokeLinecap="round"></path>
                </svg>
                {cancelTodayLabel}
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={busy}
                onClick={() => {
                  setShowRefundBreakup(false);
                  setShowCancelSubscriptionModal(true);
                }}
              >
                <svg className={styles.actionBtnIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor"></circle>
                  <path d="M18 18L6 6" stroke="currentColor"></path>
                </svg>
                Cancel Subscription
              </button>
            </div>
          </section>
        )}

        {showCancelTodayModal && (
          <div
            className={styles.confirmOverlay}
            role="presentation"
            onClick={() => {
              if (!busy) setShowCancelTodayModal(false);
            }}
          >
            <div
              className={styles.confirmModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-today-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={styles.confirmCloseBtn}
                aria-label="Close"
                disabled={busy}
                onClick={() => setShowCancelTodayModal(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className={styles.confirmIconWrap} aria-hidden="true">
                <svg
                  className={styles.confirmIcon}
                  viewBox="0 0 400 400"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <path d="M188.238 150.351C187.902 139.999 187.322 129.445 186.537 119.742" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M257.109 150.174C259.044 139.34 255.208 121.895 257.959 111.239" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M180.222 203.544C205.959 201.513 230.999 205.656 251.643 221.772" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M151.414 94.3317C159.018 93.0218 170.14 79.1169 179.734 81.2152C190.277 83.5213 201.918 93.332 205.241 94.3317" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M257.958 111.24C270.277 105.447 283.635 103.832 297.07 102.737" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M102 266.977C102 237.192 104.574 206.959 120.64 214.927C127.688 218.425 143.844 249.321 146.784 248.487C168.261 242.401 215.933 226.987 221.534 248.487C226.75 268.511 187.6 265.542 187.6 266.977C187.6 268.368 198.161 273.321 197.261 281.36C196.396 289.087 171.478 296.427 179.314 296.427C220.65 296.427 165.143 313.809 146.784 317.549C128.425 321.289 115.772 316.382 102 312.177" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                  </g>
                </svg>
              </div>
              <h3 id="cancel-today-title" className={styles.confirmTitle}>
                Cancel today&apos;s delivery?
              </h3>
              <p className={styles.confirmText}>
                If you cancel today&apos;s delivery, {subscriptionItemName} will not be delivered today, and your
                subscription will be extended by {extensionText} and you will get one scheduled delivery day at the end of the current period.
              </p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.confirmProceedBtn}
                  disabled={busy}
                  onClick={async () => {
                    try {
                      setBusy(true);
                      const updated = await subscriptionsApi.cancelToday(subscription.id);
                      // Ensure admin endpoints can see the cancellation too. The cancel-today endpoint
                      // handles the user action/extension, while pauseDate provides the persisted
                      // paused_dates signal used by admin delivery filtering.
                      await subscriptionsApi.pauseDate(subscription.id, todayIstKey).catch(() => undefined);
                      // Persist this cancellation locally so it survives reloads + remains visible
                      // for the rest of the subscription period.
                      setLocalCancelledDates((prev) => {
                        const next = new Set(prev);
                        next.add(todayIstKey);
                        writeLocalCancelledDates(String(subscription.id), next);
                        return next;
                      });
                      // Optimistic UI update so the button/calendar respond immediately even if backend data is briefly stale.
                      setSubscription((prev) => {
                        const base = updated || prev;
                        if (!base) return base;
                        const updatedPaused = new Set(base.pausedDates || []);
                        updatedPaused.add(todayIstKey);
                        const updatedSchedules = (base.deliverySchedules || []).map((row) => {
                          const key = normalizeScheduleDateKey(row.deliveryDate);
                          if (key === todayIstKey && row.status === 'pending') {
                            return { ...row, status: 'cancelled' as const };
                          }
                          return row;
                        });
                        return {
                          ...base,
                          pausedDates: Array.from(updatedPaused),
                          deliverySchedules: updatedSchedules,
                        };
                      });
                      setShowCancelTodayModal(false);
                      showToast("Today's delivery cancelled", 'success');
                      // Do a delayed background refresh to avoid immediately overwriting with stale cache.
                      window.setTimeout(() => {
                        void fetchSubscription();
                      }, 1500);
                    } catch (e) {
                      showToast((e as { message?: string })?.message || 'Failed to cancel today', 'error');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Please wait...' : 'Proceed'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showCancelSubscriptionModal && (
          <div
            className={styles.confirmOverlay}
            role="presentation"
            onClick={() => {
              if (!busy) setShowCancelSubscriptionModal(false);
            }}
          >
            <div
              className={`${styles.confirmModal} ${styles.confirmModalScrollable}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-subscription-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={styles.confirmCloseBtn}
                aria-label="Close"
                disabled={busy}
                onClick={() => setShowCancelSubscriptionModal(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div className={styles.confirmIconWrap} aria-hidden="true">
                <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.confirmIcon}>
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <path d="M303.126 136.208C281.015 132.778 265.08 104.845 246.318 98.0984C244.081 97.2946 232.069 107.635 229.8 109.141C197.375 130.656 162.319 147.633 129.719 168.977C122.439 173.743 85.8024 187.889 83.1465 196.481C82.674 198.014 82.5844 200.212 83.1465 200.322C91.5257 201.965 100.174 208.769 107.257 213.499C111.791 216.526 151.723 247.346 155.006 244.84C189.824 218.255 264.876 166.587 305.77 140.126" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M312.312 160.424C262.454 184.856 195.245 257.231 155.602 278.601C153.826 279.558 139.956 268.042 137.675 266.812C123.434 259.133 110.102 248.85 97.7998 237.996" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M317 184.071C304.217 178.343 169.407 306.551 156.375 300.919C143.344 295.288 116.401 273.745 100.319 261.358" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M188.842 155.443C219.671 118.612 245.085 191.932 193.136 184.294C182.431 182.721 176.52 159.313 184.875 153.304" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M119.806 192.842C125.346 200.295 129.325 195.187 139.627 187.5" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M263.16 144.401C268.505 140.996 264.15 143.816 264.15 137.28" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                  </g>
                </svg>
              </div>

              <h3 id="cancel-subscription-title" className={styles.confirmTitle}>
                Cancel Subscription?
              </h3>

              <p className={styles.confirmText}>
                If you cancel this subscription, the unused amount will be transferred to your wallet. This wallet
                balance is non-withdrawable, but you can use it to buy another subscription or product.
              </p>
              <p className={styles.confirmTextStrong}>
                Your unused amount is ₹{unusedAmountInr}
              </p>
              <button
                type="button"
                className={styles.breakupToggle}
                onClick={() => setShowRefundBreakup((v) => !v)}
              >
                <span>Show Breakup amount</span>
                <svg
                  className={`${styles.breakupArrow} ${showRefundBreakup ? styles.breakupArrowOpen : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {showRefundBreakup && (
                <div className={styles.breakupPanel}>
                  <p className={styles.breakupNote}>
                    Used days are counted only when delivery status is delivered (green).
                  </p>
                  <div className={styles.breakupRow}>
                    <span>Total subscription days</span>
                    <strong>{totalDays}</strong>
                  </div>
                  <div className={styles.breakupRow}>
                    <span>Used days</span>
                    <strong>{usedDays}</strong>
                  </div>
                  <div className={styles.breakupRow}>
                    <span>Unused days</span>
                    <strong>{unusedDays}</strong>
                  </div>
                  <div className={styles.breakupRow}>
                    <span>Total paid amount</span>
                    <strong>₹{formatInr(totalPaid)}</strong>
                  </div>
                  {platformFee > 0 && (
                    <div className={styles.breakupRow} style={{ color: '#ef4444' }}>
                      <span>Platform fee (non-refundable)</span>
                      <strong>- ₹{formatInr(platformFee)}</strong>
                    </div>
                  )}
                  <div className={styles.breakupRow}>
                    <span>Product cost</span>
                    <strong>₹{formatInr(productCost)}</strong>
                  </div>
                  <div className={styles.breakupRow}>
                    <span>Per day cost</span>
                    <strong>₹{formatInr(totalDays > 0 ? productCost / totalDays : 0)}</strong>
                  </div>
                  <div className={`${styles.breakupRow} ${styles.breakupRowTotal}`}>
                    <span>Unused refund amount</span>
                    <strong>₹{unusedAmountInr}</strong>
                  </div>
                </div>
              )}

              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.confirmDangerBtn}
                  disabled={busy || hasAutopayMandate}
                  onClick={async () => {
                    try {
                      setBusy(true);
                      await subscriptionsApi.cancel(subscription.id);
                      setShowCancelSubscriptionModal(false);
                      showToast('Subscription cancelled', 'success');
                      await fetchSubscription();
                    } catch (e) {
                      showToast((e as { message?: string })?.message || 'Failed to cancel subscription', 'error');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Please wait...' : 'Cancel now'}
                </button>
                {hasAutopayMandate && (
                  <p className={styles.autopayWarning}>
                    Delete autopay first to proceed with the cancellation
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
