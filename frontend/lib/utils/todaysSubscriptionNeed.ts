import type { DeliverySchedule } from '@/types';
import {
  deliverySlotPeriodBucket,
  type DeliverySlotWindow,
} from '@/lib/utils/deliverySlotDisplay';

export type TodaysNeedLine = {
  key: string;
  productId: string;
  productName: string;
  variationSize: string | undefined;
  litresPerDay: number;
  deliveryCount: number;
  totalLitres: number;
};

export type TodaysNeedSlotBreakdown = {
  totalLitres: number;
  lines: TodaysNeedLine[];
};

function lineKey(d: DeliverySchedule): string {
  const pid = d.productId ?? '';
  const v = (d.variationSize || '').trim();
  const l = d.litresPerDay != null && Number.isFinite(d.litresPerDay) ? d.litresPerDay : 0;
  return `${pid}|${v}|${l}`;
}

function bump(map: Map<string, TodaysNeedLine>, d: DeliverySchedule) {
  const litres = d.litresPerDay != null && Number.isFinite(d.litresPerDay) ? d.litresPerDay : 0;
  const k = lineKey(d);
  const existing = map.get(k);
  if (existing) {
    existing.deliveryCount += 1;
    existing.totalLitres += litres;
  } else {
    map.set(k, {
      key: k,
      productId: d.productId ?? '',
      productName: d.productName || 'Unknown product',
      variationSize: d.variationSize?.trim() || undefined,
      litresPerDay: litres,
      deliveryCount: 1,
      totalLitres: litres,
    });
  }
}

function sumMapLitres(map: Map<string, TodaysNeedLine>): number {
  let s = 0;
  for (const v of map.values()) s += v.totalLitres;
  return s;
}

function mapToSortedLines(map: Map<string, TodaysNeedLine>): TodaysNeedLine[] {
  return [...map.values()].sort((a, b) => {
    const n = a.productName.localeCompare(b.productName);
    if (n !== 0) return n;
    const v = (a.variationSize || '').localeCompare(b.variationSize || '');
    if (v !== 0) return v;
    return a.litresPerDay - b.litresPerDay;
  });
}

/**
 * Roll up today’s subscription delivery rows: totals, per product (+ variation / L/day), and morning vs evening slot.
 * Default: only `pending` rows (what still needs to go out).
 */
export function aggregateTodaysSubscriptionNeed(
  deliveries: DeliverySchedule[],
  slotWindows: DeliverySlotWindow[],
  options: { onlyPending?: boolean } = {}
): {
  totalLitres: number;
  rowCount: number;
  lines: TodaysNeedLine[];
  morning: TodaysNeedSlotBreakdown;
  evening: TodaysNeedSlotBreakdown;
  unknown: TodaysNeedSlotBreakdown;
} {
  const onlyPending = options.onlyPending !== false;
  const relevant = onlyPending
    ? deliveries.filter((d) => d.status === 'pending')
    : deliveries.filter((d) => d.status !== 'skipped' && d.status !== 'cancelled');

  const allMap = new Map<string, TodaysNeedLine>();
  const morningMap = new Map<string, TodaysNeedLine>();
  const eveningMap = new Map<string, TodaysNeedLine>();
  const unknownMap = new Map<string, TodaysNeedLine>();

  let totalLitres = 0;
  for (const d of relevant) {
    const litres = d.litresPerDay != null && Number.isFinite(d.litresPerDay) ? d.litresPerDay : 0;
    totalLitres += litres;
    bump(allMap, d);
    const bucket = deliverySlotPeriodBucket(d.deliveryTime, slotWindows);
    if (bucket === 'morning') bump(morningMap, d);
    else if (bucket === 'evening') bump(eveningMap, d);
    else bump(unknownMap, d);
  }

  return {
    totalLitres,
    rowCount: relevant.length,
    lines: mapToSortedLines(allMap),
    morning: { totalLitres: sumMapLitres(morningMap), lines: mapToSortedLines(morningMap) },
    evening: { totalLitres: sumMapLitres(eveningMap), lines: mapToSortedLines(eveningMap) },
    unknown: { totalLitres: sumMapLitres(unknownMap), lines: mapToSortedLines(unknownMap) },
  };
}

export function formatLitresAmount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  if (rounded % 1 === 0) return String(rounded);
  return rounded.toFixed(2).replace(/\.?0+$/, '') || '0';
}

/** Primary label: product + variation, or product + daily litres when no variation row. */
export function formatTodaysNeedLineLabel(line: TodaysNeedLine): string {
  const name = line.productName;
  if (line.variationSize) return `${name} (${line.variationSize})`;
  if (line.litresPerDay > 0) return `${name} (${formatLitresAmount(line.litresPerDay)} L/day)`;
  return name;
}
