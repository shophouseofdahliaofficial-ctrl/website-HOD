'use client';

import { useEffect, useRef } from 'react';
import type { StickerAsset } from '@/lib/photobook/stickers';
import PbThumbScrollbar from '@/components/photobook/PbThumbScrollbar';
import pbStyles from '@/components/ProductDetailsModal.module.css';
import StickerTile from './StickerTile';
import styles from './StickerSidebar.module.css';

type StickerGridProps = {
  assets: StickerAsset[];
  hasMore: boolean;
  onLoadMore: () => void;
  disabled?: boolean;
  importingId?: string | null;
  clearingId?: string | null;
  onSelect: (asset: StickerAsset) => void | Promise<void>;
  onDragStart?: (asset: StickerAsset, event: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  emptyLabel?: string;
};

export default function StickerGrid({
  assets,
  hasMore,
  onLoadMore,
  disabled = false,
  importingId = null,
  clearingId = null,
  onSelect,
  onDragStart,
  onDragEnd,
  emptyLabel = 'No stickers match your search.',
}: StickerGridProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !hasMore || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { root, rootMargin: '120px 0px', threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, assets.length]);

  if (assets.length === 0) {
    return <p className={styles.empty}>{emptyLabel}</p>;
  }

  return (
    <div className={`${styles.scrollHost} ${pbStyles.pbThumbScrollbarHost}`}>
      <div
        ref={scrollRef}
        className={`${styles.gridWrap} ${pbStyles.pbNativeScrollHidden}`}
        data-lenis-prevent
      >
        <div className={styles.grid} role="list">
          {assets.map((asset) => (
            <StickerTile
              key={asset.id}
              asset={asset}
              disabled={disabled}
              isImporting={importingId === asset.id}
              isClearing={clearingId === asset.id}
              onSelect={onSelect}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
        {hasMore ? <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" /> : null}
      </div>
      <PbThumbScrollbar scrollRef={scrollRef} />
    </div>
  );
}
