/**
 * High-accuracy fix using watchPosition: keeps sampling until accuracy is within
 * target (GPS ~10–15 m outdoors) or max wait, then uses the best reading.
 */
const DEFAULT_TARGET_ACCURACY_M = 12;
const DEFAULT_MAX_WAIT_MS = 32000;
const DEFAULT_MIN_SAMPLE_MS = 500;

export function getAccuratePosition(options?: {
  targetAccuracyMeters?: number;
  maxWaitMs?: number;
  minSampleMs?: number;
}): Promise<GeolocationPosition> {
  const targetAccuracyMeters = options?.targetAccuracyMeters ?? DEFAULT_TARGET_ACCURACY_M;
  const maxWaitMs = options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const minSampleMs = options?.minSampleMs ?? DEFAULT_MIN_SAMPLE_MS;

  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(Object.assign(new Error('Geolocation not supported'), { code: 0 }));
      return;
    }

    let settled = false;
    let best: GeolocationPosition | null = null;
    let bestAccuracy = Infinity;
    const startTime = Date.now();

    const geoOpts: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: maxWaitMs,
    };

    const clearWatch = (id: number | null) => {
      if (id !== null) navigator.geolocation.clearWatch(id);
    };

    let timerId: ReturnType<typeof setTimeout> | null = null;

    const finishOk = (pos: GeolocationPosition, watchId: number | null) => {
      if (settled) return;
      settled = true;
      clearWatch(watchId);
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      resolve(pos);
    };

    const finishErr = (err: GeolocationPositionError, watchId: number | null) => {
      if (settled) return;
      settled = true;
      clearWatch(watchId);
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      reject(err);
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (settled) return;
        const acc = pos.coords.accuracy;
        if (Number.isFinite(acc) && acc > 0) {
          if (acc < bestAccuracy) {
            bestAccuracy = acc;
            best = pos;
          }
          const elapsed = Date.now() - startTime;
          if (acc <= targetAccuracyMeters && elapsed >= minSampleMs) {
            finishOk(pos, watchId);
          }
        }
      },
      (err) => finishErr(err, watchId),
      geoOpts
    );

    timerId = setTimeout(() => {
      if (settled) return;
      clearWatch(watchId);
      timerId = null;

      if (best) {
        finishOk(best, null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => finishOk(pos, null),
        (err) => finishErr(err, null),
        geoOpts
      );
    }, maxWaitMs);
  });
}

/**
 * Single fast GPS read — usually 1–6s on phones with Wi‑Fi/GPS. Good for map pickers
 * where waiting for a long watch-based fix feels slow.
 */
export function getQuickGeolocationPosition(timeoutMs = 7000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(Object.assign(new Error('Geolocation not supported'), { code: 0 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: timeoutMs,
    });
  });
}
