'use client';

import { useCallback, useEffect, useRef } from 'react';
import { contentApi, type SiteContent } from '@/lib/api';
import {
  DEFAULT_DELIVERY_TIME_OFF_BODY,
  DEFAULT_DELIVERY_TIME_OFF_TITLE,
  isDeliveryTimeOffActive,
  type DeliveryTimeOffMetadata,
} from '@/lib/utils/deliveryTimeOff';

type ResolvedConfig = {
  row: SiteContent | null;
  intercept: boolean;
  title: string;
  description: string;
};

/**
 * Loads `delivery_time_off` site content once. Call `evaluate()` at pay time so the cutoff
 * compares the current clock (IST), not the moment of fetch.
 */
export function useDeliveryTimeOffConfig() {
  const rowRef = useRef<SiteContent | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await contentApi.getByType('delivery_time_off');
        if (!cancelled) {
          rowRef.current = data;
          loadedRef.current = true;
        }
      } catch {
        if (!cancelled) {
          rowRef.current = null;
          loadedRef.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const evaluate = useCallback((): ResolvedConfig => {
    const row = rowRef.current;
    const meta = (row?.metadata || {}) as DeliveryTimeOffMetadata;
    const title = (row?.title || '').trim() || DEFAULT_DELIVERY_TIME_OFF_TITLE;
    const description = (row?.content || '').trim() || DEFAULT_DELIVERY_TIME_OFF_BODY;
    const intercept = isDeliveryTimeOffActive(row);
    return { row, intercept, title, description };
  }, []);

  return { evaluate, isReady: () => loadedRef.current };
}
