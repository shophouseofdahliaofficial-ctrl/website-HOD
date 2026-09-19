const siteContentModel = require('../models/siteContent');

const CAL_TZ = process.env.SUBSCRIPTION_CALENDAR_TZ || 'Asia/Kolkata';

/**
 * First HH:MM from a delivery_time value (DB TIME string, or free text).
 *
 * node-pg decodes PostgreSQL `TIME` as a JS Date on 1970-01-01 using **local**
 * wall-clock hours (see pg-types). Using getUTCHours breaks slot matching on
 * hosts whose system TZ is not UTC (e.g. IST servers) → no shift for COD/cart.
 */
function extractSlotStartKey(deliveryTime) {
  if (deliveryTime == null || deliveryTime === '') return null;
  if (deliveryTime instanceof Date) {
    if (Number.isNaN(deliveryTime.getTime())) return null;
    const h = deliveryTime.getHours();
    const m = deliveryTime.getMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const m = String(deliveryTime).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function hhmmToMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

/**
 * Minute-of-day in CAL_TZ for an instant (for same-calendar-day comparison with slot end).
 */
function calendarTzMinutesFromMidnight(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: CAL_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
    const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  } catch {
    return null;
  }
}

async function fetchAdminDeliverySlotsWithEnd() {
  try {
    const c = await siteContentModel.getContentByType('subscription_delivery');
    const meta = (c && c.metadata) || {};
    const arr = Array.isArray(meta.deliveryTimeSlots) ? meta.deliveryTimeSlots : [];
    return arr
      .map((slot) => ({
        value: extractSlotStartKey(slot.value),
        end: extractSlotStartKey(slot.end),
      }))
      .filter((s) => s.value && s.end);
  } catch {
    return [];
  }
}

/**
 * Morning vs evening wording: window ending by 12:00 (inclusive) in slot end time → "morning".
 */
function shiftReasonForSlot(slot) {
  const endM = hhmmToMinutes(slot.end);
  if (endM == null) return 'slot_passed';
  if (endM <= 12 * 60) return 'morning_slot_passed';
  return 'evening_slot_passed';
}

/**
 * If activation happens strictly after the chosen slot's end time (same IST calendar day),
 * today's delivery in that slot is missed → extend plan by one full frequency interval at the end.
 *
 * @param {{ deliveryTime, activationInstant, frequency?: string }} opts
 * @returns {{ bonusDays: number, reason: string|null }}
 */
async function computeFirstDayShiftBonus({ deliveryTime, activationInstant, frequency = 'daily' }) {
  const slots = await fetchAdminDeliverySlotsWithEnd();
  if (slots.length === 0) return { bonusDays: 0, reason: null };

  const startKey = extractSlotStartKey(deliveryTime);
  if (!startKey) return { bonusDays: 0, reason: null };

  const slot = slots.find((s) => s.value === startKey);
  if (!slot) return { bonusDays: 0, reason: null };

  const startMin = hhmmToMinutes(slot.value);
  const endMin = hhmmToMinutes(slot.end);
  const nowMin = calendarTzMinutesFromMidnight(activationInstant);
  if (endMin == null || nowMin == null) return { bonusDays: 0, reason: null };

  // Resolve the full interval step for this frequency.
  // When first day is missed/shifted, the plan must extend by one full interval
  // so the correct number of deliveries is maintained.
  let intervalStep = 1;
  if (frequency === 'alternate') intervalStep = 2;
  else if (frequency === 'weekly') intervalStep = 7;
  else if (frequency === 'monthly') intervalStep = 30;

  // Purchased during the same-day morning/evening window → extend plan by one full interval at the end.
  if (startMin != null && nowMin >= startMin && nowMin <= endMin) {
    return { bonusDays: intervalStep, reason: 'purchased_within_delivery_window' };
  }

  if (nowMin > endMin) {
    return { bonusDays: intervalStep, reason: shiftReasonForSlot(slot) };
  }
  return { bonusDays: 0, reason: null };
}

module.exports = {
  computeFirstDayShiftBonus,
  extractSlotStartKey,
};
