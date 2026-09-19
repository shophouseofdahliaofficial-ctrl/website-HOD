'use client';

import { useCallback, useState } from 'react';
import type { StickerAsset } from '@/lib/photobook/stickers';
import StickerGrid from './StickerGrid';
import { useStickerLibrary } from './useStickerLibrary';
import styles from './StickerSidebar.module.css';

const IMPORT_SPINNER_FADE_MS = 280;

export type StickerSidebarProps = {
  searchQuery: string;
  disabled?: boolean;
  assets?: StickerAsset[];
  onStickerSelect: (asset: StickerAsset) => void | Promise<void>;
  onStickerDragStart?: (asset: StickerAsset, event: React.DragEvent<HTMLButtonElement>) => void;
  onStickerDragEnd?: () => void;
};

export default function StickerSidebar({
  searchQuery,
  disabled = false,
  assets,
  onStickerSelect,
  onStickerDragStart,
  onStickerDragEnd,
}: StickerSidebarProps) {
  const { loading, error, visibleAssets, hasMore, loadMore } = useStickerLibrary({
    searchQuery,
    assets,
  });
  const [importingId, setImportingId] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);

  const handleStickerSelect = useCallback(
    async (asset: StickerAsset) => {
      if (disabled || importingId) return;
      setClearingId(null);
      setImportingId(asset.id);
      try {
        await Promise.resolve(onStickerSelect(asset));
      } finally {
        setImportingId(null);
        setClearingId(asset.id);
        window.setTimeout(() => {
          setClearingId((current) => (current === asset.id ? null : current));
        }, IMPORT_SPINNER_FADE_MS);
      }
    },
    [disabled, importingId, onStickerSelect],
  );

  return (
    <div className={styles.panel}>
      {loading ? <p className={styles.status}>Loading stickers…</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {!loading && !error ? (
        <StickerGrid
          assets={visibleAssets}
          hasMore={hasMore}
          onLoadMore={loadMore}
          disabled={disabled || Boolean(importingId)}
          importingId={importingId}
          clearingId={clearingId}
          onSelect={handleStickerSelect}
          onDragStart={onStickerDragStart}
          onDragEnd={onStickerDragEnd}
          emptyLabel={searchQuery.trim() ? 'No stickers match your search.' : 'No stickers available.'}
        />
      ) : null}
    </div>
  );
}
