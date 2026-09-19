'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  formatGoogleMapsLoadError,
  getGoogleMapsApiKeyPresent,
  getGoogleMapsEnvSetupHint,
  loadGoogleMaps,
} from '@/lib/maps/googleMaps';
import MapLocationPinIcon from '@/components/icons/MapLocationPinIcon';
import styles from './AdminOrderMapLocationModal.module.css';

/** Gwalior city centre — default when picking inside Gwalior */
export const GWALIOR_MAP_CENTER = { lat: 26.2183, lng: 78.1828 };

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (coords: { latitude: number; longitude: number }) => void;
  initialLatitude?: number;
  initialLongitude?: number;
  mode?: 'pick' | 'view';
  title?: string;
  hint?: string;
  confirmLabel?: string;
};

function MapCenterPin() {
  return (
    <div className={styles.centerPin} aria-hidden>
      <MapLocationPinIcon className={styles.centerPinSvg} />
    </div>
  );
}

export default function AdminOrderMapLocationModal({
  open,
  onClose,
  onConfirm,
  initialLatitude,
  initialLongitude,
  mode = 'pick',
  title,
  hint,
  confirmLabel,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setMapsError(null);
    setMapsReady(false);
    mapInstanceRef.current = null;
    setCopied(false);

    let cancelled = false;
    void (async () => {
      try {
        await loadGoogleMaps();
        if (!cancelled) setMapsReady(true);
      } catch (e) {
        if (!cancelled) setMapsError(formatGoogleMapsLoadError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, initialLatitude, initialLongitude]);

  useEffect(() => {
    if (!open || !mapsReady || !mapRef.current || mapInstanceRef.current) return;

    const start =
      typeof initialLatitude === 'number' &&
      typeof initialLongitude === 'number' &&
      Number.isFinite(initialLatitude) &&
      Number.isFinite(initialLongitude)
        ? { lat: initialLatitude, lng: initialLongitude }
        : { lat: GWALIOR_MAP_CENTER.lat, lng: GWALIOR_MAP_CENTER.lng };

    const map = new google.maps.Map(mapRef.current, {
      center: start,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
    });
    mapInstanceRef.current = map;
    setDraft(start);

    if (mode === 'pick') {
      map.addListener('dragend', () => {
        const c = map.getCenter();
        if (!c) return;
        setDraft({ lat: c.lat(), lng: c.lng() });
      });
    } else {
      new google.maps.Marker({
        position: start,
        map,
      });
    }

    return () => {
      google.maps.event.clearInstanceListeners(map);
      mapInstanceRef.current = null;
    };
  }, [open, mapsReady, initialLatitude, initialLongitude, mode]);

  const handleCopyCoords = () => {
    if (!draft) return;
    const text = `${draft.lat.toFixed(6)}, ${draft.lng.toFixed(6)}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy coordinates:', err);
    });
  };

  const handleContinue = () => {
    if (mode === 'view') {
      onClose();
      return;
    }
    if (!draft) return;
    onConfirm({ latitude: draft.lat, longitude: draft.lng });
    onClose();
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-lenis-prevent
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-order-map-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2 id="admin-order-map-title" className={styles.title}>
          {title || (mode === 'view' ? "Customer's live location" : 'Set delivery location')}
        </h2>
        <p className={styles.hint}>
          {hint || (mode === 'view'
            ? 'This map shows the latitude and longitude saved with this order.'
            : 'Drag the map so the pin marks the delivery point, then tap Continue.')}
        </p>

        {!getGoogleMapsApiKeyPresent() ? (
          <p className={styles.status}>{getGoogleMapsEnvSetupHint()}</p>
        ) : null}
        {mapsError ? <p className={styles.status}>{mapsError}</p> : null}

        <div className={styles.mapWrap}>
          {mode === 'pick' ? <span className={styles.dragHint}>Drag map</span> : null}
          <div ref={mapRef} className={styles.map} />
          {mode === 'pick' ? <MapCenterPin /> : null}
        </div>

        {draft ? (
          <button
            type="button"
            className={styles.coordsPreview}
            onClick={handleCopyCoords}
            title="Click to copy coordinates"
          >
            <span>{draft.lat.toFixed(6)}, {draft.lng.toFixed(6)}</span>
            <span className={`${styles.copyText} ${copied ? styles.copyTextCopied : ''}`}>
              {copied ? '✓ Copied!' : '📋 Copy'}
            </span>
          </button>
        ) : null}

        <button
          type="button"
          className={styles.continueBtn}
          disabled={mode === 'pick' && (!draft || !mapsReady || Boolean(mapsError))}
          onClick={handleContinue}
        >
          {confirmLabel || (mode === 'view' ? 'Close' : 'Continue')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
