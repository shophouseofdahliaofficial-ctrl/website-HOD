/** HH:MM from DB TIME, ISO fragment, or free text (first match). */
export function extractSlotStartKey(deliveryTime: string | null | undefined): string | null {
  if (deliveryTime == null || deliveryTime === '') return null;
  const m = String(deliveryTime).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function hhmmToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

/** Aligns with backend `shiftReasonForSlot`: end by noon → Morning. */
export function slotPeriodLabel(endOrStartHhmm: string): 'Morning' | 'Evening' {
  const mins = hhmmToMinutes(endOrStartHhmm);
  if (mins == null) return 'Morning';
  return mins <= 12 * 60 ? 'Morning' : 'Evening';
}

/** e.g. "06:00" → "6:00 am", "17:30" → "5:30 pm" */
export function formatHhmmTo12h(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) return hhmm;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return hhmm;
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const minPart = min === 0 ? '' : `:${String(min).padStart(2, '0')}`;
  return `${h12}${minPart} ${suffix}`;
}

export type DeliverySlotWindow = { startKey: string; endKey: string | null };

const DEFAULT_SLOT_WINDOWS: DeliverySlotWindow[] = [
  { startKey: '06:00', endKey: '09:00' },
  { startKey: '17:00', endKey: '20:00' },
];

export function parseDeliverySlotWindowsFromMetadata(metadata: unknown): DeliverySlotWindow[] {
  const meta = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
  const raw = meta.deliveryTimeSlots;
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_SLOT_WINDOWS;

  const out: DeliverySlotWindow[] = [];
  for (const el of raw) {
    if (!el || typeof el !== 'object') continue;
    const o = el as Record<string, unknown>;
    const value = String(o.value ?? '').trim();
    if (!value) continue;
    const startKey = extractSlotStartKey(value);
    if (!startKey) continue;
    const endRaw = o.end != null ? String(o.end).trim() : '';
    const endKey = endRaw ? extractSlotStartKey(endRaw) : null;
    out.push({ startKey, endKey });
  }
  return out.length > 0 ? out : DEFAULT_SLOT_WINDOWS;
}

/**
 * e.g. "Slot: Morning 6:00 am - 9:00 am"
 */
export function formatSubscriptionSlotLine(
  deliveryTime: string | null | undefined,
  windows: DeliverySlotWindow[]
): string | null {
  const dtKey = extractSlotStartKey(deliveryTime);
  if (!dtKey) return null;

  const list = windows.length > 0 ? windows : DEFAULT_SLOT_WINDOWS;
  const win = list.find((w) => w.startKey === dtKey);
  if (!win) {
    const period = slotPeriodLabel(dtKey);
    return `Slot: ${period} ${formatHhmmTo12h(dtKey)}`;
  }

  const period = slotPeriodLabel(win.endKey || win.startKey);
  const startStr = formatHhmmTo12h(win.startKey);
  if (win.endKey) {
    return `Slot: ${period} ${startStr} - ${formatHhmmTo12h(win.endKey)}`;
  }
  return `Slot: ${period} ${startStr}`;
}

export type DeliverySlotPeriodBucket = 'morning' | 'evening' | 'unknown';

/** Morning vs evening for routing / packing (uses same rules as slot label). */
export function deliverySlotPeriodBucket(
  deliveryTime: string | null | undefined,
  windows: DeliverySlotWindow[]
): DeliverySlotPeriodBucket {
  const dtKey = extractSlotStartKey(deliveryTime);
  if (!dtKey) return 'unknown';
  const list = windows.length > 0 ? windows : DEFAULT_SLOT_WINDOWS;
  const win = list.find((w) => w.startKey === dtKey);
  const ref = win ? win.endKey || win.startKey : dtKey;
  return slotPeriodLabel(ref) === 'Morning' ? 'morning' : 'evening';
}
