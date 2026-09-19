'use client';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import type { StickerAsset } from '@/lib/photobook/stickers';
import styles from './StickerSidebar.module.css';

type StickerTileProps = {
  asset: StickerAsset;
  disabled?: boolean;
  isImporting?: boolean;
  isClearing?: boolean;
  onSelect: (asset: StickerAsset) => void | Promise<void>;
  onDragStart?: (asset: StickerAsset, event: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
};

export default function StickerTile({
  asset,
  disabled = false,
  isImporting = false,
  isClearing = false,
  onSelect,
  onDragStart,
  onDragEnd,
}: StickerTileProps) {
  const showSpinner = isImporting || isClearing;

  return (
    <button
      type="button"
      className={styles.tile}
      disabled={disabled}
      title={asset.name}
      aria-label={asset.name}
      aria-busy={isImporting}
      draggable={!disabled && !isImporting && Boolean(onDragStart)}
      onClick={() => onSelect(asset)}
      onDragStart={(e) => onDragStart?.(asset, e)}
      onDragEnd={onDragEnd}
    >
      <img
        src={asset.url}
        alt=""
        className={`${styles.tileImg} ${showSpinner ? styles.tileImgDimmed : ''}`}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      {showSpinner ? (
        <span
          className={`${styles.tileSpinner} ${isClearing && !isImporting ? styles.tileSpinnerOut : ''}`}
          aria-hidden="true"
        >
          <LoadingSpinner size="small" color="var(--pb-pink, #ff1e68)" />
        </span>
      ) : null}
    </button>
  );
}
