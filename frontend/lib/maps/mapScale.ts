/** Web Mercator meters per pixel at latitude for the given zoom level. */
export function metersPerPixelAtLatLng(lat: number, zoom: number): number {
  const z = Math.max(0, Math.min(22, zoom));
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, z);
}

/**
 * Rough ground radius (meters) covered by a pin-sized footprint at the map center.
 * Used to warn when the user should zoom in for a more accurate address.
 */
export function approximatePinGroundRadiusMeters(
  lat: number,
  zoom: number,
  pinFootprintPx = 30,
): number {
  return metersPerPixelAtLatLng(lat, zoom) * pinFootprintPx;
}

export const ZOOM_ACCURACY_WARN_THRESHOLD_M = 100;
