/** India Standard Time — use for all admin-facing order/delivery timestamps from UTC ISO strings */
export const IST_TIMEZONE = 'Asia/Kolkata';

function parseValidDate(iso: string | null | undefined): Date | null {
  if (iso == null || iso === '') return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Full date & time in IST (e.g. admin order list / detail). */
export function formatDateTimeIST(iso: string | null | undefined): string {
  const d = parseValidDate(iso);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** Date only as DD/MM/YYYY in IST (deliveries tab — subscription delivery date, etc.). */
export function formatDateDDMMYYYYIST(iso: string | null | undefined): string {
  const d = parseValidDate(iso);
  if (!d) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const year = parts.find((p) => p.type === 'year')?.value;
  if (!day || !month || !year) return '—';
  return `${day}/${month}/${year}`;
}

/** DD/MM/YYYY + time in IST (deliveries tab “Ordered at”). NBSP after comma so time doesn’t wrap alone. */
export function formatDateTimeDDMMYYYYIST(iso: string | null | undefined): string {
  const d = parseValidDate(iso);
  if (!d) return '—';
  const datePart = formatDateDDMMYYYYIST(iso);
  const timePart = d.toLocaleTimeString('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart},\u00A0${timePart}`;
}

/** Timeline / summary: “20 Jan, 2026” calendar date in IST. */
export function formatFullDateIST(iso: string | null | undefined): string {
  const d = parseValidDate(iso);
  if (!d) return '';
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const year = parts.find((p) => p.type === 'year')?.value;
  if (!day || !month || !year) return '';
  return `${day} ${month}, ${year}`;
}

/** DD/MM/YY in IST (order list chips). */
export function formatDdMmYyIST(iso: string | null | undefined): string {
  const d = parseValidDate(iso);
  if (!d) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const year = parts.find((p) => p.type === 'year')?.value;
  if (!day || !month || !year) return '';
  return `${day}/${month}/${year}`;
}

/** Order timeline step: date + time in IST (matches admin semantics). */
export function formatTimelineStepIST(iso: string | null | undefined): string {
  const d = parseValidDate(iso);
  if (!d) return '';
  return d.toLocaleString('en-IN', {
    timeZone: IST_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** `<input type="date" value="YYYY-MM-DD">` → DD/MM/YYYY without timezone interpretation. */
export function formatYyyyMmDdInputAsDDMMYYYY(yyyyMmDd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!m) return yyyyMmDd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Parse API date-only strings (`YYYY-MM-DD` or ISO starting with that) as a **local** calendar day at 00:00.
 * `new Date("YYYY-MM-DD")` uses UTC midnight and breaks day arithmetic after `setHours(0,0,0,0)` in non-UTC zones.
 */
export function parseLocalDateFromYmd(input: string | null | undefined): Date | null {
  if (input == null || input === '') return null;
  const ymd = String(input).trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const date = new Date(y, mo, d);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return date;
}
