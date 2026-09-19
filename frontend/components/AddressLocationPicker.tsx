'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import styles from './AddressLocationPicker.module.css';
import MapCurrentLocationButton from './MapCurrentLocationButton';
import {
  approximatePinGroundRadiusMeters,
  ZOOM_ACCURACY_WARN_THRESHOLD_M,
} from '../lib/maps/mapScale';
import {
  formatGoogleMapsLoadError,
  getGoogleMapsApiKeyPresent,
  getGoogleMapsEnvSetupHint,
  loadGoogleMaps,
  reverseGeocodeLatLng,
} from '../lib/maps/googleMaps';
import MapLocationPinIcon from './icons/MapLocationPinIcon';

type AddressLocationPickerProps = {
  latitude?: number;
  longitude?: number;
  onChange: (coords: { latitude: number; longitude: number }) => void;
  /** When false, hides the raw lat/lng line (e.g. customer map modals). Default true. */
  showCoords?: boolean;
  /** Shown centered along the bottom inside the map (e.g. COD for trial checkout map). */
  bottomCenterBadge?: string;
};

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];

type PlacePrediction = {
  placeId: string;
  description: string;
};

/** Fixed centre pin (tip at map centre); pointer-events none so the map stays draggable. */
function MapCenterPin() {
  return (
    <div className={styles.centerPin} aria-hidden>
      <MapLocationPinIcon className={styles.centerPinSvg} />
    </div>
  );
}

export default function AddressLocationPicker({
  latitude,
  longitude,
  onChange,
  showCoords = true,
  bottomCenterBadge,
}: AddressLocationPickerProps) {
  const hasSelection = typeof latitude === 'number' && typeof longitude === 'number';
  const [isOpen, setIsOpen] = useState(hasSelection);

  useEffect(() => {
    if (hasSelection) {
      setIsOpen(true);
    }
  }, [hasSelection]);

  const center = useMemo<[number, number]>(
    () => (hasSelection ? [latitude as number, longitude as number] : DEFAULT_CENTER),
    [hasSelection, latitude, longitude],
  );

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);

  const onChangeRef = useRef(onChange);
  const zoomAccuracyToastShownRef = useRef(false);
  const mapDraggingRef = useRef(false);
  const autocompleteEpochRef = useRef(0);
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  /** Hide place predictions while the user is dragging the map (coords still update on drag end). */
  const [mapDragging, setMapDragging] = useState(false);

  /** Only show permission help if GPS failed and user still has no address/map fix. */
  const shouldOpenPermissionHelpOnDeny = useCallback(() => {
    const hasText = searchText.trim().length > 0;
    const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';
    return !hasText && !hasCoords;
  }, [searchText, latitude, longitude]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleMaps();
        if (cancelled) return;
        setMapsReady(true);
      } catch (error) {
        if (cancelled) return;
        setMapsError(formatGoogleMapsLoadError(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapInstanceRef.current) return;

    const initialLat = hasSelection ? (latitude as number) : DEFAULT_CENTER[0];
    const initialLng = hasSelection ? (longitude as number) : DEFAULT_CENTER[1];
    const zoom = hasSelection ? 16 : 5;

    const map = new google.maps.Map(mapRef.current, {
      center: { lat: initialLat, lng: initialLng },
      zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
      scrollwheel: true,
    });
    mapInstanceRef.current = map;

    placesServiceRef.current = new google.maps.places.PlacesService(document.createElement('div'));
    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();

    map.addListener('dragstart', () => {
      autocompleteEpochRef.current += 1;
      mapDraggingRef.current = true;
      setMapDragging(true);
      setSearching(false);
      setResults([]);
    });

    map.addListener('dragend', () => {
      mapDraggingRef.current = false;
      setMapDragging(false);
      const c = map.getCenter();
      if (!c) return;
      const lat = c.lat();
      const lng = c.lng();
      const z = map.getZoom() ?? 15;
      const radiusM = approximatePinGroundRadiusMeters(lat, z, 30);
      if (
        radiusM > ZOOM_ACCURACY_WARN_THRESHOLD_M &&
        !zoomAccuracyToastShownRef.current
      ) {
        zoomAccuracyToastShownRef.current = true;
        showToastRef.current('Zoom in closer for a more accurate address.', 'error', 4500);
      }
      onChangeRef.current({ latitude: lat, longitude: lng });
      // Do not fill the search box from reverse geocode — only typed search / pick / GPS updates it.
      setResults([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create map once; use pan effect for prop updates
  }, [mapsReady]);

  useEffect(() => {
    if (mapDragging) {
      setResults([]);
      return;
    }

    const trimmed = searchText.trim();
    const autocompleteService = autocompleteServiceRef.current;
    if (!trimmed || trimmed.length < 3 || !autocompleteService) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setSearching(true);
        const requestEpoch = autocompleteEpochRef.current;
        const next = await autocompleteService.getPlacePredictions({
          input: trimmed,
          componentRestrictions: { country: 'in' },
        });
        if (
          requestEpoch !== autocompleteEpochRef.current ||
          mapDraggingRef.current
        ) {
          setResults([]);
          return;
        }
        setResults((next.predictions || []).slice(0, 5).map((item) => ({
          placeId: item.place_id,
          description: item.description,
        })));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchText, mapDragging]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    map.panTo({ lat: center[0], lng: center[1] });
    // Do not call setZoom here — it reset zoom after every coordinate sync and broke pinch / Ctrl+scroll zoom.
  }, [center]);

  const onPickPlace = (placeId: string) => {
    if (!placesServiceRef.current) return;
    placesServiceRef.current.getDetails(
      {
        placeId,
        fields: ['formatted_address', 'geometry'],
      },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) return;
        const latValue = place.geometry.location.lat();
        const lngValue = place.geometry.location.lng();
        onChange({ latitude: latValue, longitude: lngValue });
        const m = mapInstanceRef.current;
        if (m) {
          m.panTo({ lat: latValue, lng: lngValue });
          m.setZoom(16);
        }
        setSearchText(place.formatted_address || `${latValue.toFixed(6)}, ${lngValue.toFixed(6)}`);
        setResults([]);
      },
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.headerRow}>
        <p className={styles.label}>Pin exact location on map</p>
        <button
          type="button"
          className={styles.hideButton}
          onClick={() => {
            setIsOpen(false);
            onChange({ latitude: undefined as any, longitude: undefined as any });
          }}
        >
          Remove exact location & hide map
        </button>
      </div>
      <p className={styles.helpText}>
        Drag the map so the <strong>blue pin</strong> sits on your doorstep, search above the map, or choose{' '}
        <strong>Use current location</strong>. Coordinates update when you finish dragging.
      </p>
      {!getGoogleMapsApiKeyPresent() ? (
        <p className={styles.searchStatus}>{getGoogleMapsEnvSetupHint()}</p>
      ) : null}
      {mapsError ? <p className={styles.searchStatus}>{mapsError}</p> : null}
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="text"
          className={`${styles.searchInput} ${searching ? styles.searchInputBusy : ''}`}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search location"
          autoComplete="off"
        />
        {searching ? <span className={styles.searchingInline}>Searching…</span> : null}
        {searchFocused && results.length > 0 && !mapDragging ? (
          <div className={styles.searchResults}>
            {results.map((item) => (
              <button
                key={item.placeId}
                type="button"
                className={styles.searchResultItem}
                onPointerDown={(event) => {
                  event.preventDefault();
                  onPickPlace(item.placeId);
                }}
              >
                {item.description}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className={styles.mapWrap}>
        <div className={styles.mapToolbar}>
          <div className={styles.mapToolbarSpacer} />
          <span className={styles.dragMapHint}>Drag Map</span>
          <div className={styles.mapToolbarRight}>
            <MapCurrentLocationButton
              className={styles.mapToolbarLocate}
              disabled={!mapsReady || Boolean(mapsError)}
              timeoutMs={6500}
              shouldOpenPermissionHelpOnDeny={shouldOpenPermissionHelpOnDeny}
              onLocated={async (r) => {
                onChange({ latitude: r.latitude, longitude: r.longitude });
                const m = mapInstanceRef.current;
                if (m) {
                  m.panTo({ lat: r.latitude, lng: r.longitude });
                  m.setZoom(16);
                }
                setSearchText(
                  r.formattedAddress || `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}`,
                );
                setResults([]);
              }}
            />
          </div>
        </div>
        <div ref={mapRef} className={styles.map} />
        <MapCenterPin />
        {bottomCenterBadge ? (
          <div className={styles.mapBottomBadge} role="status" aria-label={bottomCenterBadge}>
            {bottomCenterBadge}
          </div>
        ) : null}
      </div>
      {showCoords ? (
        <p className={styles.coords}>
          {hasSelection
            ? `Selected: ${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`
            : 'No location selected yet'}
        </p>
      ) : null}
    </div>
  );
}
