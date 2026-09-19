/** Asia/Kolkata — same business calendar as subscriptions / pricing. */
export const DELIVERY_TIME_OFF_TZ = 'Asia/Kolkata';

export const DEFAULT_DELIVERY_TIME_OFF_TITLE = 'Delivery timing';

export const DEFAULT_DELIVERY_TIME_OFF_BODY =
  'We are currently unable to process deliveries at this time. Your order will be rescheduled for the next available slot to ensure the best quality service';

export type DeliveryTimeOffMetadata = {
  enabled?: boolean;
  cutoffTime?: string;
};

/** `HH:mm` 24h in IST — returns true when current IST clock is at or after cutoff (same calendar day). */
export function isPastOrderCutoffIst(cutoffHhMm: string): boolean {
  const s = String(cutoffHhMm || '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return false;
  const ch = parseInt(m[1], 10);
  const cm = parseInt(m[2], 10);
  if (!Number.isFinite(ch) || !Number.isFinite(cm) || ch < 0 || ch > 23 || cm < 0 || cm > 59) return false;
  const cutoffMinutes = ch * 60 + cm;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DELIVERY_TIME_OFF_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const nh = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const nmin = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const nowMinutes = nh * 60 + nmin;

  return nowMinutes >= cutoffMinutes;
}

export function isDeliveryTimeOffActive(
  row: { isActive?: boolean; metadata?: DeliveryTimeOffMetadata } | null | undefined,
): boolean {
  if (!row || row.isActive === false) return false;
  const meta = row.metadata || {};
  if (meta.enabled !== true) return false;
  const cutoff = typeof meta.cutoffTime === 'string' && meta.cutoffTime.trim() ? meta.cutoffTime.trim() : '22:00';
  return isPastOrderCutoffIst(cutoff);
}
