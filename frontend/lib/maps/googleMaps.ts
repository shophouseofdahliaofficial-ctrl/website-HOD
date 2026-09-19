import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

let mapsConfigured = false;
let loaderPromise: Promise<typeof google> | null = null;
let mapsLibrary: google.maps.MapsLibrary | null = null;
const reverseGeocodeCache = new Map<string, string>();

function getGoogleMapsApiKey(): string {
  const raw =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
  return String(raw).trim().replace(/^['"]|['"]$/g, '');
}

export function getGoogleMapsApiKeyPresent(): boolean {
  return Boolean(getGoogleMapsApiKey());
}

/** User-facing hint when the key is missing (browser + server). */
export function getGoogleMapsEnvSetupHint(): string {
  return (
    'Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY to .env.local next to package.json, save, ' +
    'then restart: in the terminal running the site, press Ctrl+C, then run npm run dev again.'
  );
}

/** User-facing message when `loadGoogleMaps()` or map init fails (key restrictions, APIs, billing). */
export function formatGoogleMapsLoadError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error || 'Failed to load Google Maps');
  let out = msg;
  if (/ReferrerNotAllowed|ApiTargetBlocked|RefererNotAllowed|not allowed for this|referr?er/i.test(msg)) {
    out +=
      ' In Google Cloud → APIs & Services → Credentials → your browser key → Application restrictions: add HTTP referrer http://localhost:3000/* (match your dev URL and port).';
  }
  if (/ApiNotActivated|not been used in project|InvalidKeyMapError/i.test(msg)) {
    out +=
      ' Enable Maps JavaScript API and Places API (and Geocoding if you use address lookup) on the same Cloud project as this key.';
  }
  if (/billing|BillingNotEnabled|OVER_QUERY_LIMIT/i.test(msg)) {
    out += ' Ensure billing is enabled for the Google Cloud project.';
  }
  return out;
}

export async function loadGoogleMaps(): Promise<typeof google> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw new Error(
      'Missing Google Maps API key. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY to .env.local next to package.json, then stop the dev server (Ctrl+C) and run npm run dev again.',
    );
  }

  if (!mapsConfigured) {
    setOptions({
      key: apiKey,
      v: 'weekly',
    });
    mapsConfigured = true;
  }

  if (!loaderPromise) {
    loaderPromise = (async () => {
      const [mapsMod] = await Promise.all([importLibrary('maps'), importLibrary('places')]);
      mapsLibrary = mapsMod;
      return google;
    })();
  }

  return loaderPromise;
}

/** Use after `loadGoogleMaps()` resolves — prefer `Map` / `Marker` from here over `google.maps.*` when possible. */
export function getLoadedMapsLibrary(): google.maps.MapsLibrary {
  if (!mapsLibrary) {
    throw new Error('Call loadGoogleMaps() before getLoadedMapsLibrary()');
  }
  return mapsLibrary;
}

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export async function reverseGeocodeLatLng(lat: number, lng: number): Promise<string | null> {
  const key = cacheKey(lat, lng);
  if (reverseGeocodeCache.has(key)) return reverseGeocodeCache.get(key) || null;

  const g = await loadGoogleMaps();
  const geocoder = new g.maps.Geocoder();

  const result = await geocoder.geocode({
    location: { lat, lng },
  });

  const address = result.results?.[0]?.formatted_address || null;
  if (address) reverseGeocodeCache.set(key, address);
  return address;
}

/** Extracts a 6-digit postal code from Google Geocoder results (e.g. India pincodes). */
export async function getPostalCodeFromLatLng(lat: number, lng: number): Promise<string | null> {
  const g = await loadGoogleMaps();
  const geocoder = new g.maps.Geocoder();
  const result = await geocoder.geocode({
    location: { lat, lng },
  });
  const results = result.results || [];
  for (const res of results) {
    const comps = res.address_components || [];
    const pc = comps.find((c) => c.types.includes('postal_code'));
    const digits = (pc?.long_name || '').replace(/\D/g, '');
    if (digits.length >= 6) return digits.slice(-6);
  }
  return null;
}

