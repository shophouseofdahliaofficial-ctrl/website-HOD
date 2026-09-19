export type DeliveryRateRange = {
  startMeters: number;
  endMeters: number;
  rate: number;
};

export type DeliveryRatesConfig = {
  warehouseLatitude?: number;
  warehouseLongitude?: number;
  ranges: DeliveryRateRange[];
};

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeDeliveryRatesConfig(metadata: Record<string, any> | null | undefined): DeliveryRatesConfig {
  const warehouseLatitude = toFiniteNumber(metadata?.warehouseLatitude);
  const warehouseLongitude = toFiniteNumber(metadata?.warehouseLongitude);
  const ranges = Array.isArray(metadata?.ranges)
    ? metadata.ranges
        .map((row: any) => {
          const startMeters = toFiniteNumber(row?.startMeters);
          const endMeters = toFiniteNumber(row?.endMeters);
          const rate = toFiniteNumber(row?.rate);
          if (startMeters === null || endMeters === null || rate === null) return null;
          return {
            startMeters: Math.max(0, Math.round(startMeters)),
            endMeters: Math.max(0, Math.round(endMeters)),
            rate: Math.max(0, Math.round(rate * 100) / 100),
          };
        })
        .filter((row): row is DeliveryRateRange => !!row && row.endMeters >= row.startMeters)
        .sort((a, b) => a.startMeters - b.startMeters || a.endMeters - b.endMeters)
    : [];

  return {
    warehouseLatitude: warehouseLatitude ?? undefined,
    warehouseLongitude: warehouseLongitude ?? undefined,
    ranges,
  };
}

export function calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

export function resolveDeliveryRate(
  config: DeliveryRatesConfig,
  customerLatitude?: number,
  customerLongitude?: number,
): { distanceMeters: number | null; charge: number } {
  if (
    !Number.isFinite(config.warehouseLatitude)
    || !Number.isFinite(config.warehouseLongitude)
    || !Number.isFinite(customerLatitude)
    || !Number.isFinite(customerLongitude)
  ) {
    return { distanceMeters: null, charge: 0 };
  }

  const distanceMeters = Math.round(
    calculateDistanceMeters(
      Number(config.warehouseLatitude),
      Number(config.warehouseLongitude),
      Number(customerLatitude),
      Number(customerLongitude),
    ),
  );
  if (config.ranges.length === 0) {
    return { distanceMeters, charge: 0 };
  }

  const directMatch = config.ranges.find((row) => distanceMeters >= row.startMeters && distanceMeters <= row.endMeters);
  if (directMatch) {
    return { distanceMeters, charge: directMatch.rate };
  }

  const lastRange = config.ranges[config.ranges.length - 1];
  if (distanceMeters > lastRange.endMeters) {
    return { distanceMeters, charge: lastRange.rate };
  }

  return { distanceMeters, charge: 0 };
}
