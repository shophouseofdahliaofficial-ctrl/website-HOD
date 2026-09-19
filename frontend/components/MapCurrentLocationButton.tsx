'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { getGoogleMapsApiKeyPresent, reverseGeocodeLatLng } from '../lib/maps/googleMaps';
import LocationPermissionHelpDialog from './LocationPermissionHelpDialog';
import styles from './MapCurrentLocationButton.module.css';

export type MapLocatedResult = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  formattedAddress: string | null;
};

type Props = {
  onLocated: (r: MapLocatedResult) => void | Promise<void>;
  className?: string;
  disabled?: boolean;
  /** Reverse-geocode when Maps API key is configured (default true) */
  withAddress?: boolean;
  /** Geolocation timeout in ms (default 7000) */
  timeoutMs?: number;
  /**
   * When permission is denied, open the help dialog only if this returns true.
   * Use to avoid showing the dialog when the user already has coords / address in the form.
   */
  shouldOpenPermissionHelpOnDeny?: () => boolean;
};

const locateIcon = (
  <svg className={styles.icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M12 3V5M12 19V21M3 12H5M19 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * Call geolocation synchronously from a click handler so the browser keeps
 * transient user activation for permission prompts.
 */
export default function MapCurrentLocationButton({
  onLocated,
  className,
  disabled,
  withAddress = true,
  timeoutMs = 7000,
  shouldOpenPermissionHelpOnDeny,
}: Props) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [permissionHelpOpen, setPermissionHelpOpen] = useState(false);

  const onLocatedRef = useRef(onLocated);
  const withAddressRef = useRef(withAddress);
  const shouldOpenHelpRef = useRef(shouldOpenPermissionHelpOnDeny);
  const locateSessionRef = useRef(0);

  useEffect(() => {
    onLocatedRef.current = onLocated;
  }, [onLocated]);
  useEffect(() => {
    withAddressRef.current = withAddress;
  }, [withAddress]);
  useEffect(() => {
    shouldOpenHelpRef.current = shouldOpenPermissionHelpOnDeny;
  }, [shouldOpenPermissionHelpOnDeny]);

  const finishWithPosition = useCallback(
    async (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const accuracyM = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : null;

      let formattedAddress: string | null = null;
      if (withAddressRef.current && getGoogleMapsApiKeyPresent()) {
        try {
          formattedAddress = await reverseGeocodeLatLng(latitude, longitude);
        } catch {
          formattedAddress = null;
        }
      }

      try {
        await onLocatedRef.current({
          latitude,
          longitude,
          accuracyM,
          formattedAddress: formattedAddress?.trim() || null,
        });
      } catch {
        showToast('Could not apply this location.', 'error');
      }
    },
    [showToast],
  );

  const requestFromUserGesture = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('Location is not supported on this device.', 'error');
      return;
    }

    const session = ++locateSessionRef.current;
    setPermissionHelpOpen(false);
    setBusy(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (session !== locateSessionRef.current) return;
        setPermissionHelpOpen(false);
        void (async () => {
          try {
            await finishWithPosition(pos);
          } finally {
            if (session === locateSessionRef.current) {
              setBusy(false);
            }
          }
        })();
      },
      (err) => {
        if (session !== locateSessionRef.current) return;
        setBusy(false);
        if (err.code === err.PERMISSION_DENIED || err.code === 1) {
          const gate = shouldOpenHelpRef.current;
          const openHelp = gate === undefined || gate();
          if (openHelp) {
            setPermissionHelpOpen(true);
          } else {
            showToast(
              'Location permission denied. You can still drag the map or search for your address.',
              'error',
            );
          }
          return;
        }
        if (err.code === err.POSITION_UNAVAILABLE || err.code === 2) {
          showToast('Location unavailable. Try outdoors or pick on the map.', 'error');
          return;
        }
        if (err.code === err.TIMEOUT || err.code === 3) {
          showToast('Location timed out. Try again.', 'error');
          return;
        }
        showToast('Could not get your location.', 'error');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: timeoutMs,
      },
    );
  }, [finishWithPosition, showToast, timeoutMs]);

  return (
    <>
      <button
        type="button"
        className={`${styles.btn} ${className || ''}`}
        disabled={disabled || busy}
        onClick={requestFromUserGesture}
        aria-label="Use current location"
      >
        {locateIcon}
        {busy ? 'Locating…' : 'Use current location'}
      </button>

      <LocationPermissionHelpDialog
        open={permissionHelpOpen}
        onClose={() => setPermissionHelpOpen(false)}
        onTryAgain={requestFromUserGesture}
        onReloadPage={() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }}
      />
    </>
  );
}
