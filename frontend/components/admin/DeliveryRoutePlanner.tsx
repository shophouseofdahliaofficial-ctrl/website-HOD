'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import {
  getGoogleMapsApiKeyPresent,
  getGoogleMapsEnvSetupHint,
  getLoadedMapsLibrary,
  formatGoogleMapsLoadError,
  loadGoogleMaps,
  reverseGeocodeLatLng,
} from '@/lib/maps/googleMaps';
import { calculateDistance } from '@/lib/maps/routeOptimization';
import { productWithVariationDisplayLabel } from '@/lib/utils/productVariationDisplay';
import LocationPermissionHelpDialog from '@/components/LocationPermissionHelpDialog';
import { mapLocationPinIconDataUrl } from '@/components/icons/MapLocationPinIcon';
import SwipeToDeliver from '@/components/admin/SwipeToDeliver';
import styles from './DeliveryRoutePlanner.module.css';



export type DeliveryStop = {
  id: number | string;   // number for subscription stops, UUID string for order stops
  userId: number;
  userName: string | null;
  userEmail: string | null;
  date: string | null;
  lat: number;
  lng: number;
  noCoords?: boolean;    // true = no GPS coords available; stop appears in list but may not be pinned
  deliveryTime: string | null;
  status: string;
  litresPerDay?: number | null;  // also used as totalQty for orders mode
  productName?: string | null;
  /** From `product_variations.size` for subscription stops; orders mode may embed size in productName. */
  productVariationSize?: string | null;
  addressName?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  userPhone?: string | null;
  trialShifted?: boolean;
  /** Orders route planner only: from `orders` row */
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  orderTotal?: number | null;
  /** Orders API: platform fee on the order row */
  platformFee?: number | null;
  /** Orders API: line items for this order (route planner / “View items”). */
  orderItems?: Array<{
    productName: string;
    variationSize?: string | null;
    quantity: number;
    lineTotal: number;
  }>;
};

type Mode = 'subscriptions' | 'orders';

type Props = {
  slot: 'morning' | 'evening';
  date: string;
  onClose: () => void;
  mode?: Mode;
  /** delivery_schedules.id (or order id) values to drop from the route — e.g. customer cancelled today. */
  excludeStopIds?: Set<string> | Iterable<string | number>;
};

const PROXIMITY_METERS = 40;

function formatRupeeInr(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function orderPaymentKindForStop(mode: Mode, s: DeliveryStop | null): 'prepaid' | 'cod' | null {
  if (mode !== 'orders' || !s) return null;
  const pm = String(s.paymentMethod || '').toLowerCase();
  const ps = String(s.paymentStatus || '').toLowerCase();
  if (ps === 'paid' || pm === 'online' || pm === 'wallet') return 'prepaid';
  if (pm === 'cod') return 'cod';
  return 'prepaid';
}

function orderPaymentStripTextForStop(mode: Mode, s: DeliveryStop | null): string | null {
  if (mode !== 'orders' || !s) return null;
  const amt = Number(s.orderTotal);
  const formatted = formatRupeeInr(Number.isFinite(amt) ? amt : 0);
  const kind = orderPaymentKindForStop(mode, s);
  if (kind === 'cod') return `To receive: ${formatted}`;
  return `Prepaid: ${formatted}`;
}

function stopDisplayName(s: DeliveryStop): string {
  return s.userName || s.userEmail || `User ${s.userId}`;
}

function OrderPaymentStripIcon() {
  return (
    <svg
      className={styles.orderPaymentStripIcon}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z"
        stroke="currentColor"
        strokeWidth="1.344"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5898 13.3398H14.8298V9.09985"
        stroke="currentColor"
        strokeWidth="1.344"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.8299 13.3399L9.16992 7.67993"
        stroke="currentColor"
        strokeWidth="1.344"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 16.51C9.89 17.81 14.11 17.81 18 16.51"
        stroke="currentColor"
        strokeWidth="1.344"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const DELIVERY_COMPLETE_HOLD_MS = 5000;
const LIVE_REROUTE_MIN_MOVE_METERS = 12;
const LIVE_REROUTE_DEBOUNCE_MS = 900;

const MAP_PIN_PX = 48;

const ROUTE_STROKE_COLOR = '#0062ff';
const ROUTE_STROKE_WEIGHT = 5;

function deliveryMapPinMarkerIcon(): google.maps.Icon {
  return {
    url: mapLocationPinIconDataUrl(MAP_PIN_PX),
    scaledSize: new google.maps.Size(MAP_PIN_PX, MAP_PIN_PX),
    anchor: new google.maps.Point(MAP_PIN_PX / 2, MAP_PIN_PX),
  };
}

function slotLabel(slot: 'morning' | 'evening'): string {
  return slot === 'morning' ? 'morning' : 'evening';
}

/** DB-backed lines only (no geocode); used for queue list + fallback label. */
function formatStopAddressSync(s: DeliveryStop): string {
  const parts = [s.addressName, s.street, s.city, s.state, s.postalCode].filter((p) => p && String(p).trim());
  if (parts.length > 0) return parts.join(', ');
  return `Pin: ${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}`;
}

function isPendingStop(s: DeliveryStop): boolean {
  return String(s.status).toLowerCase() === 'pending';
}

function pickNearestStop(origin: { lat: number; lng: number }, list: DeliveryStop[]): DeliveryStop | null {
  if (list.length === 0) return null;
  let best = list[0];
  let bestD = calculateDistance(origin.lat, origin.lng, best.lat, best.lng);
  for (let i = 1; i < list.length; i += 1) {
    const c = list[i];
    const d = calculateDistance(origin.lat, origin.lng, c.lat, c.lng);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Full greedy delivery order from an origin through all stops (for “upcoming” list). */
function greedySequenceFrom(origin: { lat: number; lng: number }, stops: DeliveryStop[]): DeliveryStop[] {
  const pending = [...stops];
  const ordered: DeliveryStop[] = [];
  let cur = origin;
  while (pending.length > 0) {
    const next = pickNearestStop(cur, pending);
    if (!next) break;
    ordered.push(next);
    const idx = pending.findIndex((x) => x.id === next.id);
    if (idx >= 0) pending.splice(idx, 1);
    cur = { lat: next.lat, lng: next.lng };
  }
  return ordered;
}

/**
 * Compute compass bearing (0 = North, 90 = East, 180 = South, 270 = West)
 * from point A to point B using the standard spherical formula.
 */
function computeBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.lng - from.lng);
  const latA = toRad(from.lat);
  const latB = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(latB);
  const x = Math.cos(latA) * Math.sin(latB) - Math.sin(latA) * Math.cos(latB) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export default function DeliveryRoutePlanner({ slot, date, onClose, mode = 'subscriptions', excludeStopIds }: Props) {
  const excludedStopIdSet = useMemo(() => {
    const set = new Set<string>();
    if (excludeStopIds) {
      const iterable: Iterable<string | number> =
        excludeStopIds instanceof Set ? excludeStopIds : excludeStopIds;
      for (const id of iterable) set.add(String(id));
    }
    return set;
  }, [excludeStopIds]);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const adminMarkerRef = useRef<google.maps.OverlayView | null>(null);
  const deliveryMarkersRef = useRef<google.maps.Marker[]>([]);
  const sheetSlideWrapRef = useRef<HTMLDivElement | null>(null);
  const pendingDeliveryCommitRef = useRef<(() => void) | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const prevLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const bearingRef = useRef<number>(0);
  const lastRouteOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  const liveRerouteTimerRef = useRef<number | null>(null);
  const liveRouteRequestSeqRef = useRef(0);

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [stops, setStops] = useState<DeliveryStop[]>([]);
  const [adminLocation, setAdminLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [adminAddress, setAdminAddress] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');
  const [mapsReady, setMapsReady] = useState(false);

  const [routeStarted, setRouteStarted] = useState(false);
  const [flowComplete, setFlowComplete] = useState(false);
  const [routeOrigin, setRouteOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [remainingStops, setRemainingStops] = useState<DeliveryStop[]>([]);
  const [currentStop, setCurrentStop] = useState<DeliveryStop | null>(null);
  const [sessionDelivered, setSessionDelivered] = useState<DeliveryStop[]>([]);
  const [marking, setMarking] = useState(false);
  const [queuePopupOpen, setQueuePopupOpen] = useState(false);
  const [orderItemsPopupOpen, setOrderItemsPopupOpen] = useState(false);
  const [locationPermissionHelpOpen, setLocationPermissionHelpOpen] = useState(false);
  const [sheetExiting, setSheetExiting] = useState(false);
  const [sheetEnterNonce, setSheetEnterNonce] = useState(0);
  const [sheetAddressLine, setSheetAddressLine] = useState('');

  const pendingStops = useMemo(() => stops.filter(isPendingStop), [stops]);
  const totalPendingLitres = useMemo(
    () => pendingStops.reduce((sum, s) => sum + (Number(s.litresPerDay) || 0), 0),
    [pendingStops],
  );

  const nearCurrentStop = useMemo(() => {
    if (!routeStarted || !currentStop || !adminLocation || flowComplete) return false;
    const d = calculateDistance(adminLocation.lat, adminLocation.lng, currentStop.lat, currentStop.lng);
    return d <= PROXIMITY_METERS;
  }, [routeStarted, currentStop, adminLocation, flowComplete]);

  const leftCount = remainingStops.length;

  const orderPaymentStripText = useMemo(
    () => orderPaymentStripTextForStop(mode, currentStop),
    [mode, currentStop],
  );

  const orderPaymentStripKind = useMemo(
    () => orderPaymentKindForStop(mode, currentStop),
    [mode, currentStop],
  );

  const orderPaymentStripClassName =
    orderPaymentStripKind === 'cod'
      ? `${styles.orderPaymentStrip} ${styles.orderPaymentStripCod}`
      : `${styles.orderPaymentStrip} ${styles.orderPaymentStripPrepaid}`;

  const orderLinesForView = currentStop?.orderItems ?? [];
  const showViewOrderItems =
    mode === 'orders' && routeStarted && currentStop && !flowComplete && orderLinesForView.length > 1;

  const upcomingOrdered = useMemo(() => {
    if (!routeOrigin || remainingStops.length === 0) return [];
    return greedySequenceFrom(routeOrigin, remainingStops);
  }, [routeOrigin, remainingStops]);

  /** Straight-line distance admin → current stop in metres (live, updates with GPS). */
  const distanceMeters = useMemo(() => {
    if (!adminLocation || !currentStop || !routeStarted || flowComplete) return null;
    return calculateDistance(adminLocation.lat, adminLocation.lng, currentStop.lat, currentStop.lng);
  }, [adminLocation, currentStop, routeStarted, flowComplete]);

  /** ETA in minutes (30 km/h average city speed, straight-line × 1.35 road-factor). */
  const etaMinutes = useMemo(() => {
    if (distanceMeters === null) return null;
    const roadDistanceM = distanceMeters * 1.35;          // road-factor
    const speedMps = (30 * 1000) / 3600;                  // 30 km/h → m/s
    return Math.max(1, Math.round(roadDistanceM / speedMps / 60));
  }, [distanceMeters]);

  /** Human-readable distance label. */
  const distanceLabel = useMemo(() => {
    if (distanceMeters === null) return null;
    return distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(1)} km`
      : `${Math.round(distanceMeters)} m`;
  }, [distanceMeters]);

  useEffect(() => {
    if (!currentStop) {
      setSheetAddressLine('');
      return;
    }
    const sync = formatStopAddressSync(currentStop);
    const hasDbLines = [currentStop.addressName, currentStop.street, currentStop.city, currentStop.state, currentStop.postalCode].some(
      (p) => p && String(p).trim(),
    );
    if (hasDbLines) {
      setSheetAddressLine(sync);
      return;
    }
    let cancelled = false;
    setSheetAddressLine(sync);
    (async () => {
      try {
        const geo = await reverseGeocodeLatLng(currentStop.lat, currentStop.lng);
        if (cancelled) return;
        if (geo && geo.trim()) setSheetAddressLine(geo.trim());
      } catch {
        /* keep Pin: line */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    currentStop?.id,
    currentStop?.lat,
    currentStop?.lng,
    currentStop?.addressName,
    currentStop?.street,
    currentStop?.city,
    currentStop?.state,
    currentStop?.postalCode,
  ]);

  useEffect(() => {
    setOrderItemsPopupOpen(false);
  }, [currentStop?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorText('');
      try {
        await loadGoogleMaps();
        if (cancelled) return;
        setMapsReady(true);
      } catch (error) {
        if (cancelled) return;
        setMapsReady(false);
        setErrorText(formatGoogleMapsLoadError(error));
        setLoading(false);
        return;
      }
      try {
        let deliveryData: DeliveryStop[];
        if (mode === 'orders') {
          deliveryData = await apiClient.get<DeliveryStop[]>(
            API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.ORDER_DELIVERY_STOPS,
          );
        } else {
          deliveryData = await apiClient.get<DeliveryStop[]>(
            `${API_ENDPOINTS.DELIVERY_TRACKING.LIST}?date=${encodeURIComponent(date)}&slot=${slot}`,
          );
        }
        if (cancelled) return;
        const list = Array.isArray(deliveryData) ? deliveryData : [];
        setStops(
          excludedStopIdSet.size > 0
            ? list.filter((stop) => !excludedStopIdSet.has(String(stop.id)))
            : list
        );
      } catch (error) {
        if (cancelled) return;
        setErrorText((error as { message?: string })?.message || 'Unable to load route data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, slot, mode, excludedStopIdSet]);

  /**
   * ORDERS MODE — live poll while pre-route screen is showing.
   * Every 10 s, silently re-fetch stops so any order newly marked
   * "out for delivery" from the list appears immediately in the count.
   */
  useEffect(() => {
    if (mode !== 'orders') return;           // only in orders mode
    if (routeStarted || flowComplete) return; // stop polling once route is in progress

    const poll = async () => {
      try {
        const fresh = await apiClient.get<DeliveryStop[]>(
          API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.ORDER_DELIVERY_STOPS,
        );
        if (Array.isArray(fresh)) {
          setStops(
            excludedStopIdSet.size > 0
              ? fresh.filter((stop) => !excludedStopIdSet.has(String(stop.id)))
              : fresh
          );
        }
      } catch {
        // silent — don't disrupt UX
      }
    };

    const id = window.setInterval(() => void poll(), 10_000);
    return () => window.clearInterval(id);
  }, [mode, routeStarted, flowComplete, excludedStopIdSet]);

  useEffect(() => {
    if (!mapsReady || !mapContainerRef.current || mapRef.current) return;
    let MapCtor: typeof google.maps.Map;
    try {
      ({ Map: MapCtor } = getLoadedMapsLibrary());
    } catch {
      setErrorText(
        'Google Maps failed to load (check API key, billing, and Maps JavaScript API on the same Cloud project).',
      );
      return;
    }
    if (typeof MapCtor !== 'function') {
      setErrorText(
        'Google Maps failed to load (check API key, billing, and Maps JavaScript API on the same Cloud project).',
      );
      return;
    }
    const map = new MapCtor(mapContainerRef.current, {
      center: { lat: 20.5937, lng: 78.9629 },
      zoom: 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
    });
    mapRef.current = map;
    directionsRendererRef.current = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: ROUTE_STROKE_COLOR,
        strokeOpacity: 1,
        strokeWeight: ROUTE_STROKE_WEIGHT,
      },
    });
  }, [mapsReady]);

  const updateFromGeolocation = useCallback(async (position: GeolocationPosition, opts?: { focusMap?: boolean }) => {
    const next = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
    // Update bearing if we've moved at least 8 m (avoids jitter when stationary)
    const prev = prevLocationRef.current;
    if (prev) {
      const moved = calculateDistance(prev.lat, prev.lng, next.lat, next.lng);
      if (moved >= 8) {
        bearingRef.current = computeBearing(prev, next);
        prevLocationRef.current = next;
      }
    } else {
      prevLocationRef.current = next;
    }
    setAdminLocation(next);
    try {
      const address = await reverseGeocodeLatLng(next.lat, next.lng);
      if (address) setAdminAddress(address);
    } catch {
      /* ignore */
    }
    if (opts?.focusMap && mapRef.current) {
      mapRef.current.panTo(next);
      mapRef.current.setZoom(16);
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        void updateFromGeolocation(position);
      },
      () => { },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000,
      },
    );
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [updateFromGeolocation]);

  /** First fix + permission: runs without a tap; denied → help dialog. */
  useEffect(() => {
    if (!mapsReady || typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void updateFromGeolocation(pos, { focusMap: true });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED || err.code === 1) {
          setLocationPermissionHelpOpen(true);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
  }, [mapsReady, updateFromGeolocation]);

  const requestLocationOnUserGesture = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocationPermissionHelpOpen(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void updateFromGeolocation(pos, { focusMap: true });
        setLocationPermissionHelpOpen(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED || err.code === 1) {
          setLocationPermissionHelpOpen(true);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
  }, [updateFromGeolocation]);

  const drawLeg = useCallback(async (
    origin: { lat: number; lng: number },
    dest: DeliveryStop,
    opts?: { fitBounds?: boolean }
  ) => {
    if (!mapRef.current || !directionsRendererRef.current) return;
    setErrorText('');
    const fitBounds = opts?.fitBounds ?? true;
    const requestSeq = ++liveRouteRequestSeqRef.current;
    try {
      const directionsService = new google.maps.DirectionsService();
      const result = await directionsService.route({
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(dest.lat, dest.lng),
        travelMode: google.maps.TravelMode.DRIVING,
      });
      if (requestSeq !== liveRouteRequestSeqRef.current) return;
      directionsRendererRef.current.setOptions({ preserveViewport: !fitBounds });
      directionsRendererRef.current.setDirections(result);
      lastRouteOriginRef.current = { ...origin };
      if (fitBounds) {
        const b = new google.maps.LatLngBounds();
        b.extend(origin);
        b.extend({ lat: dest.lat, lng: dest.lng });
        mapRef.current.fitBounds(b, 48);
      }
    } catch (error) {
      if (requestSeq !== liveRouteRequestSeqRef.current) return;
      setErrorText((error as Error)?.message || 'Failed to draw route');
    }
  }, []);

  useEffect(() => {
    if (
      !routeStarted ||
      !currentStop ||
      currentStop.noCoords ||
      !adminLocation ||
      flowComplete ||
      marking ||
      nearCurrentStop
    ) {
      if (liveRerouteTimerRef.current != null) {
        window.clearTimeout(liveRerouteTimerRef.current);
        liveRerouteTimerRef.current = null;
      }
      return;
    }

    const lastOrigin = lastRouteOriginRef.current;
    if (lastOrigin) {
      const moved = calculateDistance(
        lastOrigin.lat,
        lastOrigin.lng,
        adminLocation.lat,
        adminLocation.lng,
      );
      if (moved < LIVE_REROUTE_MIN_MOVE_METERS) {
        return;
      }
    }

    if (liveRerouteTimerRef.current != null) {
      window.clearTimeout(liveRerouteTimerRef.current);
    }

    liveRerouteTimerRef.current = window.setTimeout(() => {
      liveRerouteTimerRef.current = null;
      void drawLeg(adminLocation, currentStop, { fitBounds: false });
    }, LIVE_REROUTE_DEBOUNCE_MS);

    return () => {
      if (liveRerouteTimerRef.current != null) {
        window.clearTimeout(liveRerouteTimerRef.current);
        liveRerouteTimerRef.current = null;
      }
    };
  }, [adminLocation, currentStop, drawLeg, flowComplete, marking, nearCurrentStop, routeStarted]);

  /**
   * Admin live marker — OverlayView wrapping the original SVG icon.
   * CSS transform:rotate() is applied on every GPS update so the icon
   * always points in the direction of travel without swapping the image.
   */
  useEffect(() => {
    if (!mapRef.current || !mapsReady || flowComplete) {
      if (adminMarkerRef.current) {
        adminMarkerRef.current.setMap(null);
        adminMarkerRef.current = null;
      }
      return;
    }
    if (!adminLocation) return;

    const ICON_SIZE = 56; // px — same visual size as before

    if (!adminMarkerRef.current) {
      // Define a one-off OverlayView subclass that hosts <img> with CSS rotation
      class AdminIconOverlay extends google.maps.OverlayView {
        private _latlng: google.maps.LatLng;
        private _bearing: number;
        private _div: HTMLDivElement | null = null;

        constructor(latlng: google.maps.LatLng, bearing: number) {
          super();
          this._latlng = latlng;
          this._bearing = bearing;
        }

        onAdd() {
          const div = document.createElement('div');
          div.style.cssText = 'position:absolute;pointer-events:none;';
          const img = document.createElement('img');
          img.src = '/icons/admin-live-location-marker.svg';
          img.width = ICON_SIZE;
          img.height = ICON_SIZE;
          img.style.cssText = [
            'display:block',
            'transform-origin:50% 100%',          // pin anchor = bottom-centre
            `transform:rotate(${this._bearing}deg)`,
            'transition:transform 0.35s ease-out', // smooth rotation
            'will-change:transform',
          ].join(';');
          div.appendChild(img);
          this._div = div;
          this.getPanes()!.overlayMouseTarget.appendChild(div);
        }

        draw() {
          if (!this._div) return;
          const pt = this.getProjection().fromLatLngToDivPixel(this._latlng);
          if (!pt) return;
          // Offset so the bottom-centre of the icon sits on the coordinate
          this._div.style.left = `${pt.x - ICON_SIZE / 2}px`;
          this._div.style.top  = `${pt.y - ICON_SIZE}px`;
          const img = this._div.querySelector('img') as HTMLImageElement | null;
          if (img) img.style.transform = `rotate(${this._bearing}deg)`;
        }

        onRemove() {
          this._div?.parentNode?.removeChild(this._div);
          this._div = null;
        }

        /** Call this on each GPS update instead of recreating the overlay. */
        update(latlng: google.maps.LatLng, bearing: number) {
          this._latlng = latlng;
          this._bearing = bearing;
          this.draw();
        }
      }

      const overlay = new AdminIconOverlay(
        new google.maps.LatLng(adminLocation.lat, adminLocation.lng),
        bearingRef.current,
      );
      overlay.setMap(mapRef.current);
      adminMarkerRef.current = overlay;
    } else {
      // Overlay already exists — just update position + bearing
      (adminMarkerRef.current as unknown as {
        update: (latlng: google.maps.LatLng, bearing: number) => void;
      }).update(
        new google.maps.LatLng(adminLocation.lat, adminLocation.lng),
        bearingRef.current,
      );
    }
  }, [mapsReady, adminLocation, flowComplete]);

  /** Customer / stop pins: rebuild only when route shape changes (not on admin GPS updates). */
  useEffect(() => {
    if (!mapRef.current || !mapsReady || flowComplete) {
      deliveryMarkersRef.current.forEach((m) => m.setMap(null));
      deliveryMarkersRef.current = [];
      return;
    }

    deliveryMarkersRef.current.forEach((m) => m.setMap(null));
    deliveryMarkersRef.current = [];

    if (routeStarted && currentStop && !currentStop.noCoords) {
      deliveryMarkersRef.current.push(
        new google.maps.Marker({
          map: mapRef.current,
          position: { lat: currentStop.lat, lng: currentStop.lng },
          title: currentStop.userName || currentStop.userEmail || 'Delivery',
          optimized: true,
          icon: deliveryMapPinMarkerIcon(),
        }),
      );
    } else if (!routeStarted && pendingStops.length > 0) {
      pendingStops.forEach((stop, i) => {
        if (stop.noCoords) return; // no GPS — skip map pin, still counted in list
        deliveryMarkersRef.current.push(
          new google.maps.Marker({
            map: mapRef.current,
            position: { lat: stop.lat, lng: stop.lng },
            title: stop.userName || stop.userEmail || `Stop ${i + 1}`,
            optimized: true,
            icon: deliveryMapPinMarkerIcon(),
            opacity: 0.92,
          }),
        );
      });
    }
  }, [mapsReady, routeStarted, currentStop, pendingStops, flowComplete]);

  useEffect(() => {
    return () => {
      if (liveRerouteTimerRef.current != null) {
        window.clearTimeout(liveRerouteTimerRef.current);
        liveRerouteTimerRef.current = null;
      }
      if (adminMarkerRef.current) {
        adminMarkerRef.current.setMap(null);
        adminMarkerRef.current = null;
      }
      deliveryMarkersRef.current.forEach((m) => m.setMap(null));
      deliveryMarkersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!sheetExiting) return;
    const el = sheetSlideWrapRef.current;
    const fallback = window.setTimeout(() => {
      const fn = pendingDeliveryCommitRef.current;
      pendingDeliveryCommitRef.current = null;
      fn?.();
      setSheetExiting(false);
      setSheetEnterNonce((n) => n + 1);
    }, 420);
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'transform') return;
      window.clearTimeout(fallback);
      const fn = pendingDeliveryCommitRef.current;
      pendingDeliveryCommitRef.current = null;
      fn?.();
      setSheetExiting(false);
      setSheetEnterNonce((n) => n + 1);
    };
    el?.addEventListener('transitionend', onEnd, { once: true });
    return () => {
      window.clearTimeout(fallback);
      el?.removeEventListener('transitionend', onEnd);
    };
  }, [sheetExiting]);

  const startOptimizedRoute = async () => {
    if (!adminLocation) {
      setErrorText('Live location is required. Allow location access when prompted, or use Try again in the location dialog.');
      return;
    }
    if (pendingStops.length === 0) {
      setErrorText('No pending deliveries for this slot.');
      return;
    }
    setGenerating(true);
    setErrorText('');
    try {
      const origin = { ...adminLocation };
      const list = [...pendingStops];
      const next = pickNearestStop(origin, list);
      if (!next) {
        setErrorText('No stops to route.');
        return;
      }
      setRouteOrigin(origin);
      setRemainingStops(list);
      setCurrentStop(next);
      setRouteStarted(true);
      if (!next.noCoords) await drawLeg(origin, next);
    } catch (error) {
      setErrorText((error as Error)?.message || 'Failed to start route');
    } finally {
      setGenerating(false);
    }
  };

  const onMarkDeliveredSwipe = async () => {
    if (!currentStop || marking) return;
    setMarking(true);
    setErrorText('');
    try {
      if (mode === 'orders') {
        // Mark order as delivered via the orders API
        await apiClient.post(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.MARK_DELIVERED(String(currentStop.id)));
      } else {
        await apiClient.post(API_ENDPOINTS.DELIVERY_TRACKING.MARK_DELIVERED, {
          deliveryId: currentStop.id,
          date,
        });
      }
      const done = currentStop;
      pendingDeliveryCommitRef.current = () => {
        setStops((prev) => prev.map((s) => (s.id === done.id ? { ...s, status: 'delivered' } : s)));
        setSessionDelivered((prev) => [...prev, done]);

        const rest = remainingStops.filter((s) => s.id !== done.id);
        if (rest.length === 0) {
          setFlowComplete(true);
          setRouteStarted(false);
          setCurrentStop(null);
          setRemainingStops([]);
          return;
        }

        const newOrigin = { lat: done.lat, lng: done.lng };
        setRouteOrigin(newOrigin);
        setRemainingStops(rest);
        const next = pickNearestStop(newOrigin, rest);
        setCurrentStop(next);
        if (next && !next.noCoords) {
          void drawLeg(newOrigin, next);
        }
      };
      await new Promise<void>((resolve) => {
        setTimeout(resolve, DELIVERY_COMPLETE_HOLD_MS);
      });
      setSheetExiting(true);
    } catch (e) {
      setErrorText((e as { message?: string })?.message || 'Could not mark delivered');
    } finally {
      setMarking(false);
    }
  };

  if (!getGoogleMapsApiKeyPresent()) {
    return <p className={styles.inlineError}>{getGoogleMapsEnvSetupHint()}</p>;
  }

  const productLabel = (s: DeliveryStop) => {
    const base = s.productName?.trim() || (mode === 'orders' ? 'Order' : 'Milk');
    return productWithVariationDisplayLabel(base, s.productVariationSize);
  };
  const qtyLabel = (s: DeliveryStop) => {
    const q = Number(s.litresPerDay);
    return Number.isFinite(q) && q > 0 ? q : 1;
  };
  const qtyUnit = mode === 'orders' ? '' : 'L';    // no unit suffix for orders (qty is item count)
  const summaryCardUnitLabel = mode === 'orders' ? 'items' : 'L';

  /** Before “Generate optimized route” — basket / area icon */
  const sheetDeliveryHeadlineIcon = (
    <svg
      className={styles.sheetHeadlineIcon}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4.20404 15C3.43827 15.5883 3 16.2714 3 17C3 19.2091 7.02944 21 12 21C16.9706 21 21 19.2091 21 17C21 16.2714 20.5617 15.5883 19.796 15M12 6.5V11.5M9.5 9H14.5M18 9.22222C18 12.6587 15.3137 15.4444 12 17C8.68629 15.4444 6 12.6587 6 9.22222C6 5.78578 8.68629 3 12 3C15.3137 3 18 5.78578 18 9.22222Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  /** After route starts — delivery person silhouette */
  const sheetRouteHeadlineIcon = (
    <svg
      className={styles.sheetHeadlineIconRoute}
      viewBox="-20 0 190 190"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M94.11 109.87L86.11 85.87L84.82 94L91.71 147.42C91.71 147.42 84.18 149.95 82.85 143.29C81.71 137.56 76.12 112.06 76.12 112.06L73.2 111.89C73.2 111.89 68 135.1 66.42 142.72C64.9 150.19 57.15 147.14 57.15 147.14L64.93 91.36L63.85 85.59L56.05 110.44C56.05 110.44 49.05 110.44 51.05 102.36C53.11 94.03 58.25 72.8 58.25 72.8C66.25 64.8 83.78 64.8 91.69 72.8C91.69 72.8 97.5 96.52 99.02 102.8C100.54 109.08 94.11 109.87 94.11 109.87ZM66.82 53.5C66.82 40.88 85.03 43.11 83.62 54.35C82.27 65.17 66.82 66.29 66.82 53.5Z"
        fill="currentColor"
      />
    </svg>
  );

  return (
    <div className={styles.shell}>
      <div className={styles.bottomSheet}>
        {loading ? <p className={styles.sheetMeta}>Loading delivery points…</p> : null}
        {errorText ? <div className={styles.inlineError}>{errorText}</div> : null}

        {!routeStarted && !flowComplete ? (
          <div className={styles.sheetStepBlock}>
            <div className={styles.sheetHeadlineRow}>
              {sheetDeliveryHeadlineIcon}
              <div className={styles.sheetTextGroup}>
                <p className={styles.sheetTitle}>
                  {mode === 'orders' ? (
                    <><strong>{pendingStops.length}</strong> order{pendingStops.length !== 1 ? 's' : ''} out for delivery</>
                  ) : (
                    <>To Deliver:{' '}<strong>{totalPendingLitres > 0 ? `${totalPendingLitres} L` : `${pendingStops.length} stop(s)`}</strong></>
                  )}
                </p>
                <p className={styles.sheetSub}>
                  {mode === 'orders'
                    ? 'Ready to start your order delivery route?'
                    : `Do you want to start delivering for the ${slotLabel(slot)} slot?`}
                </p>
              </div>
            </div>
            <button
              type="button"
              className={`${styles.sheetPrimaryBtn} ${styles.sheetPrimaryBtnWithIcon}`}
              disabled={generating || loading || pendingStops.length === 0}
              onClick={() => void startOptimizedRoute()}
            >
              <svg
                className={styles.sheetPrimaryBtnIcon}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path
                  d="M21.3046 4.69335C21.908 3.41959 20.5806 2.09225 19.3069 2.69561L2.83473 10.4982C1.56185 11.1011 1.74664 12.9674 3.11305 13.309L9.17556 14.8247L10.6912 20.8872C11.0328 22.2536 12.8991 22.4384 13.502 21.1655L21.3046 4.69335Z"
                  fill="currentColor"
                />
              </svg>
              {generating ? 'Generating…' : 'Generate Optimized Route'}
            </button>
          </div>
        ) : null}

        {routeStarted && currentStop && !flowComplete ? (
          <div
            ref={sheetSlideWrapRef}
            className={`${styles.sheetSlideWrap} ${sheetExiting ? styles.sheetSlideWrapOut : ''}`}
          >
            <div
              key={`${currentStop.id}-${sheetEnterNonce}`}
              className={sheetEnterNonce > 0 ? styles.sheetSlideInnerEnter : undefined}
            >
              <div className={styles.sheetRowTop}>
                <div className={styles.sheetNameBlock}>
                  <div className={styles.sheetHeadlineRow}>
                    {sheetRouteHeadlineIcon}
                    <div className={styles.sheetTextGroup}>
                      {mode === 'orders' ? (
                        <div className={styles.customerNameRow}>
                          <p className={styles.customerName}>
                            {stopDisplayName(currentStop)}
                            {' · '}
                            {qtyLabel(currentStop)}
                            {' · '}
                            {productLabel(currentStop)}
                            {currentStop.trialShifted && (
                              <>
                                {' · '}
                                <span style={{ color: '#0070f3', fontWeight: 800 }}>Trial shifted</span>
                              </>
                            )}
                          </p>
                          {showViewOrderItems ? (
                            <button
                              type="button"
                              className={styles.viewOrderItemsBtn}
                              onClick={() => setOrderItemsPopupOpen(true)}
                            >
                              View items
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <p className={styles.customerName}>
                          {currentStop.userName || currentStop.userEmail || `User ${currentStop.userId}`}
                          {' · '}
                          {qtyLabel(currentStop)}{qtyUnit ? ` ${qtyUnit}` : ''}
                          {' · '}
                          {productLabel(currentStop)}
                          {currentStop.trialShifted && (
                            <>
                              {' · '}
                              <span style={{ color: '#0070f3', fontWeight: 800 }}>Trial shifted</span>
                            </>
                          )}
                        </p>
                      )}
                      <p className={styles.sheetSub}>
                        {sheetAddressLine || formatStopAddressSync(currentStop)}
                        {currentStop.userPhone ? (
                          <>
                            {' · '}
                            <a
                              href={`tel:${currentStop.userPhone}`}
                              style={{ color: 'black', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', verticalAlign: 'middle' }}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{ width: '0.85em', height: '0.85em', display: 'inline-block', flexShrink: 0, verticalAlign: 'middle' }}
                                aria-hidden
                              >
                                <path
                                  d="M9 16C2.814 9.813 3.11 5.134 5.94 3.012l.627-.467a1.483 1.483 0 0 1 2.1.353l1.579 2.272a1.5 1.5 0 0 1-.25 1.99L8.476 8.474c-.38.329-.566.828-.395 1.301.316.88 1.083 2.433 2.897 4.246 1.814 1.814 3.366 2.581 4.246 2.898.474.17.973-.015 1.302-.396l1.314-1.518a1.5 1.5 0 0 1 1.99-.25l2.276 1.58a1.48 1.48 0 0 1 .354 2.096l-.47.633C19.869 21.892 15.188 22.187 9 16z"
                                  fill="currentColor"
                                />
                              </svg>
                              {currentStop.userPhone}
                            </a>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.leftPill}
                  onClick={() => setQueuePopupOpen(true)}
                >
                  <svg
                    className={styles.leftPillIcon}
                    viewBox="0 0 100 100"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                  >
                    <path
                      d="M42 0a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h3v5.295C23.364 15.785 6.5 34.209 6.5 56.5C6.5 80.483 26.017 100 50 100s43.5-19.517 43.5-43.5a43.22 43.22 0 0 0-6.72-23.182l4.238-3.431l1.888 2.332a2 2 0 0 0 2.813.297l3.11-2.518a2 2 0 0 0 .294-2.812L89.055 14.75a2 2 0 0 0-2.813-.297l-3.11 2.518a2 2 0 0 0-.294 2.812l1.889 2.332l-4.22 3.414C73.77 18.891 64.883 14.435 55 13.297V8h3a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H42zm8 20c20.2 0 36.5 16.3 36.5 36.5S70.2 93 50 93S13.5 76.7 13.5 56.5S29.8 20 50 20zm.002 7.443L50 56.5l23.234 17.447a29.056 29.056 0 0 0 2.758-30.433a29.056 29.056 0 0 0-25.99-16.07z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className={styles.leftPillLabel}>
                    {leftCount} left
                  </span>
                </button>
              </div>
              <SwipeToDeliver
                disabled={!nearCurrentStop || marking}
                label="Mark as deliver"
                onConfirm={() => onMarkDeliveredSwipe()}
              />
              {!nearCurrentStop ? (
                <p className={styles.proximityHint}>
                  Move within {PROXIMITY_METERS} m of the pin to enable swipe ({PROXIMITY_METERS} m radius).
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {flowComplete ? (
          <div className={styles.sheetStepBlock}>
            <div className={styles.sheetHeadlineRow}>
              {sheetRouteHeadlineIcon}
              <div className={styles.sheetTextGroup}>
                <p className={styles.sheetTitle}>All done!</p>
                <p className={styles.sheetSub}>
                  {mode === 'orders'
                    ? 'All orders delivered successfully!'
                    : `You are all set for today\u2019s ${slotLabel(slot)} slot.`}
                </p>
              </div>
            </div>
            <button type="button" className={styles.sheetPrimaryBtn} onClick={onClose}>
              Return to deliveries
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.mapStage}>
        {!flowComplete ? (
          <>
            <button
              type="button"
              className={styles.mapBackBtn}
              aria-label="Close"
              onClick={onClose}
            >
              <svg
                className={styles.mapBackIcon}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M11.7071 4.29289C12.0976 4.68342 12.0976 5.31658 11.7071 5.70711L6.41421 11H20C20.5523 11 21 11.4477 21 12C21 12.5523 20.5523 13 20 13H6.41421L11.7071 18.2929C12.0976 18.6834 12.0976 19.3166 11.7071 19.7071C11.3166 20.0976 10.6834 20.0976 10.2929 19.7071L3.29289 12.7071C3.10536 12.5196 3 12.2652 3 12C3 11.7348 3.10536 11.4804 3.29289 11.2929L10.2929 4.29289C10.6834 3.90237 11.3166 3.90237 11.7071 4.29289Z"
                  fill="currentColor"
                />
              </svg>
            </button>

            {/* Distance + ETA pills — top-right of map */}
            {routeStarted && currentStop && distanceLabel !== null && etaMinutes !== null ? (
              <div className={styles.mapInfoPills}>
                <div className={styles.mapInfoPill}>
                  <svg
                    className={styles.mapInfoPillIcon}
                    viewBox="0 0 48 48"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                  >
                    <path
                      d="M24,2C14.1,2,7,10.1,7,20S18.5,41.3,22.6,45.4a1.9,1.9,0,0,0,2.8,0C29.5,41.3,41,30.1,41,20S33.9,2,24,2Zm0,8a8.7,8.7,0,0,1,4.8,1.4L16.4,23.8A8.7,8.7,0,0,1,15,19,9,9,0,0,1,24,10Zm0,18a8.7,8.7,0,0,1-4.8-1.4L31.6,14.2A8.7,8.7,0,0,1,33,19,9,9,0,0,1,24,28Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className={styles.mapInfoPillValue}>{distanceLabel}</span>
                </div>
                <div className={styles.mapInfoPill}>
                  <svg
                    className={styles.mapInfoPillIcon}
                    viewBox="0 0 48 48"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                  >
                    <path
                      d="M24,2A22,22,0,1,0,46,24,21.9,21.9,0,0,0,24,2ZM35.7,31A2.1,2.1,0,0,1,34,32a1.9,1.9,0,0,1-1-.3L22,25.1V14a2,2,0,0,1,4,0v8.9l9,5.4A1.9,1.9,0,0,1,35.7,31Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className={styles.mapInfoPillValue}>{etaMinutes} min</span>
                </div>
              </div>
            ) : null}

            <div ref={mapContainerRef} className={styles.mapFill} />

            {mode === 'orders' && routeStarted && currentStop && !flowComplete && orderPaymentStripText ? (
              <div className={styles.orderPaymentStripRow}>
                <div className={orderPaymentStripClassName} role="status" aria-live="polite">
                  <OrderPaymentStripIcon />
                  <span>{orderPaymentStripText}</span>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className={styles.completeMapPlaceholder}>
            <div className={styles.completeIcon} aria-hidden="true">
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="32" r="28" fill="#ecfdf5" stroke="#059669" strokeWidth="2" />
                <path
                  d="M20 33l8 8 16-18"
                  stroke="#059669"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className={styles.completeMapTitle}>
              All items delivered for the {slotLabel(slot)} slot.
            </p>
          </div>
        )}
      </div>

      <LocationPermissionHelpDialog
        open={locationPermissionHelpOpen}
        onClose={() => setLocationPermissionHelpOpen(false)}
        onTryAgain={requestLocationOnUserGesture}
        onReloadPage={() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }}
      />

      {queuePopupOpen ? (
        <div
          className={styles.queueOverlay}
          role="presentation"
          onClick={() => setQueuePopupOpen(false)}
        >
          <div
            className={styles.queuePanel}
            role="dialog"
            aria-modal="true"
            aria-label="Delivery queue"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.queueClose}
              aria-label="Close"
              onClick={() => setQueuePopupOpen(false)}
            >
              ×
            </button>

            <h4 className={styles.queueSectionTitle}>Delivered subscriptions</h4>
            {sessionDelivered.length === 0 ? (
              <p className={styles.queueEmpty}>None yet this run.</p>
            ) : (
              <ul className={styles.queueList}>
                {sessionDelivered.map((s, i) => (
                  <li key={`d-${s.id}`} className={styles.queueItem}>
                    <span className={styles.queueNum}>{i + 1}</span>
                    <div>
                      <div className={styles.queueName}>{s.userName || s.userEmail || `User ${s.userId}`}</div>
                      <div className={styles.queueDetail}>
                        {qtyLabel(s)} L · {productLabel(s)}
                        {s.trialShifted && <span style={{ color: '#0070f3', fontWeight: 800 }}> · Trial shifted</span>}
                        {' · '}{formatStopAddressSync(s)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h4 className={styles.queueSectionTitle}>Up-coming subscriptions</h4>
            {upcomingOrdered.length === 0 ? (
              <p className={styles.queueEmpty}>No remaining stops.</p>
            ) : (
              <ul className={styles.queueList}>
                {upcomingOrdered.map((s, i) => (
                  <li key={`u-${s.id}`} className={styles.queueItem}>
                    <span className={styles.queueNum}>{i + 1}</span>
                    <div>
                      <div className={styles.queueName}>{s.userName || s.userEmail || `User ${s.userId}`}</div>
                      <div className={styles.queueDetail}>
                        {qtyLabel(s)} L · {productLabel(s)}
                        {s.trialShifted && <span style={{ color: '#0070f3', fontWeight: 800 }}> · Trial shifted</span>}
                        {' · '}{formatStopAddressSync(s)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {orderItemsPopupOpen && mode === 'orders' && currentStop ? (
        <div
          className={`${styles.queueOverlay} ${styles.orderItemsPopupRaise}`}
          role="presentation"
          onClick={() => setOrderItemsPopupOpen(false)}
        >
          <div
            className={styles.queuePanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-items-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.queueClose}
              aria-label="Close"
              onClick={() => setOrderItemsPopupOpen(false)}
            >
              ×
            </button>
            <h4 id="order-items-dialog-title" className={styles.queueSectionTitle}>
              Order items
            </h4>
            <p className={styles.orderItemsModalIntro}>
              <strong>{stopDisplayName(currentStop)}</strong> has ordered {qtyLabel(currentStop)} in total.
            </p>
            {orderPaymentStripText ? (
              <div className={styles.orderPaymentStripRowEmbed}>
                <div className={orderPaymentStripClassName} role="status" aria-live="polite">
                  <OrderPaymentStripIcon />
                  <span>{orderPaymentStripText}</span>
                </div>
              </div>
            ) : null}
            <p className={styles.orderItemsModalSectionTitle}>
              Product names + {formatRupeeInr(Number(currentStop.platformFee ?? 0))} Platform Fees:
            </p>
            <ul className={styles.orderItemsModalList}>
              {orderLinesForView.map((it, idx) => (
                <li key={`${String(currentStop.id)}-${idx}`} className={styles.orderItemsModalLine}>
                  {productWithVariationDisplayLabel(it.productName, it.variationSize)}
                  {', '}
                  {it.quantity}
                  {', '}
                  {formatRupeeInr(it.lineTotal)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
