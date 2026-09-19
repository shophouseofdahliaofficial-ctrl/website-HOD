'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  STICKER_GRID_PAGE_SIZE,
  filterStickerAssets,
  loadOpenMojiCatalog,
  type StickerAsset,
} from '@/lib/photobook/stickers';

type UseStickerLibraryOptions = {
  searchQuery: string;
  assets?: StickerAsset[];
};

export function useStickerLibrary({ searchQuery, assets: assetsOverride }: UseStickerLibraryOptions) {
  const [allAssets, setAllAssets] = useState<StickerAsset[]>(assetsOverride ?? []);
  const [loading, setLoading] = useState(!assetsOverride);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(STICKER_GRID_PAGE_SIZE);

  useEffect(() => {
    if (assetsOverride) {
      setAllAssets(assetsOverride);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadOpenMojiCatalog()
      .then((catalog) => {
        if (cancelled) return;
        setAllAssets(catalog);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load stickers');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assetsOverride]);

  const filteredAssets = useMemo(
    () => filterStickerAssets(allAssets, searchQuery),
    [allAssets, searchQuery],
  );

  useEffect(() => {
    setVisibleCount(STICKER_GRID_PAGE_SIZE);
  }, [searchQuery, allAssets]);

  const visibleAssets = useMemo(
    () => filteredAssets.slice(0, visibleCount),
    [filteredAssets, visibleCount],
  );

  const hasMore = visibleCount < filteredAssets.length;

  const loadMore = () => {
    setVisibleCount((count) => Math.min(count + STICKER_GRID_PAGE_SIZE, filteredAssets.length));
  };

  return {
    loading,
    error,
    filteredAssets,
    visibleAssets,
    hasMore,
    loadMore,
    totalCount: filteredAssets.length,
  };
}
