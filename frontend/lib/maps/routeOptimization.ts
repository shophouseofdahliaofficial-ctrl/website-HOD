export type Coordinate = {
  lat: number;
  lng: number;
};

export type RouteUserPoint = Coordinate & {
  id: string;
};

/**
 * Haversine distance in meters.
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

/**
 * Nearest-neighbor route optimization.
 * Starts from warehouse and picks the nearest unvisited user each step.
 */
export function optimizeRoute(warehouse: Coordinate, users: RouteUserPoint[]): RouteUserPoint[] {
  const pending = [...users];
  const ordered: RouteUserPoint[] = [];
  let current = warehouse;

  while (pending.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < pending.length; i += 1) {
      const candidate = pending[i];
      const distance = calculateDistance(current.lat, current.lng, candidate.lat, candidate.lng);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    const [next] = pending.splice(nearestIndex, 1);
    ordered.push(next);
    current = { lat: next.lat, lng: next.lng };
  }

  return ordered;
}

