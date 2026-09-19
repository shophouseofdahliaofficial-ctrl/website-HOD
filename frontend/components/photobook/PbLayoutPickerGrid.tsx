'use client';

import styles from '../ProductDetailsModal.module.css';
import type { PbLayoutId } from './canvas/layouts';
import { getPbLayoutDefinition, PB_EDITOR_LAYOUT_IDS } from './canvas/layouts';

export type PbLayoutPickerGridProps = {
  activeLayoutId?: string | null;
  onSelect: (layoutId: PbLayoutId) => void;
  className?: string;
};

export default function PbLayoutPickerGrid({
  activeLayoutId,
  onSelect,
  className,
}: PbLayoutPickerGridProps) {
  const gridClass = [styles.pbLayoutsGrid, className ?? ''].filter(Boolean).join(' ');

  const renderPreview = (layoutId: PbLayoutId) => {
    switch (layoutId) {
      case 'grid-4':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeGrid4Box}`}>
            <div className={styles.pbWireframeMiniBox} />
            <div className={styles.pbWireframeMiniBox} />
            <div className={styles.pbWireframeMiniBox} />
            <div className={styles.pbWireframeMiniBox} />
          </div>
        );
      case 'grid-6':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeGrid6Box}`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.pbWireframeMiniBox} />
            ))}
          </div>
        );
      case 'left-full-right-2':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeLeftFullRightTwoBox}`}>
            <div className={`${styles.pbWireframeMiniBox} ${styles.pbWireframeSlotTall}`} />
            <div className={styles.pbWireframeMiniBox} />
            <div className={styles.pbWireframeMiniBox} />
          </div>
        );
      case 'left-2-right-full':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeLeftTwoRightFullBox}`}>
            <div className={`${styles.pbWireframeMiniBox} ${styles.pbWireframeSlotLeftTop}`} />
            <div className={`${styles.pbWireframeMiniBox} ${styles.pbWireframeSlotLeftBottom}`} />
            <div className={`${styles.pbWireframeMiniBox} ${styles.pbWireframeSlotTallRight}`} />
          </div>
        );
      case 'stacked-horizontal':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeTextTopBox}`}>
            <div className={styles.pbWireframeMiniBox} />
            <div className={styles.pbWireframeMiniBox} />
          </div>
        );
      case 'text-top':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeTextTopBox}`}>
            <div className={styles.pbWireframeMiniTextLabel}>Heading</div>
            <div className={styles.pbWireframeMiniBox} />
          </div>
        );
      case 'text-bottom':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeTextBottomBox}`}>
            <div className={styles.pbWireframeMiniBox} />
            <div className={styles.pbWireframeMiniTextLabel}>Heading</div>
          </div>
        );
      case 'two-vertical':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeTwoVerticalBox}`}>
            <div className={styles.pbWireframeMiniBox} />
            <div className={styles.pbWireframeMiniBox} />
          </div>
        );
      case 'three-vertical':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeThreeVerticalBox}`}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.pbWireframeMiniBox} />
            ))}
          </div>
        );
      case 'four-vertical':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeFourVerticalBox}`}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.pbWireframeMiniBox} />
            ))}
          </div>
        );
      case 'four-horizontal':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeFourHorizontalBox}`}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.pbWireframeMiniBox} />
            ))}
          </div>
        );
      case 'three-horizontal':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeThreeHorizontalBox}`}>
            <div className={styles.pbWireframeMiniBox} />
            <div className={styles.pbWireframeMiniBox} />
            <div className={styles.pbWireframeMiniBox} />
          </div>
        );
      case 'center-inset':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeCenterInsetBox}`}>
            <div className={styles.pbWireframeMiniBox} />
          </div>
        );
      case 'double-center-inset':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeDoubleCenterInsetBox}`}>
            <div className={styles.pbWireframeMiniBox} />
            <div className={styles.pbWireframeMiniBox} />
          </div>
        );
      case 'single':
        return <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeSingleBox}`} />;
      case 'blank':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbLayoutWireframeBlankPreview}`}>
            <span className={styles.pbLayoutWireframeBlankText}>Fully custom</span>
          </div>
        );
      default:
        return null;
    }
  };

  const renderWireframe = (layoutId: PbLayoutId) => {
    const isActive = activeLayoutId === layoutId;
    const layoutName = getPbLayoutDefinition(layoutId).name;

    return (
      <div
        className={[
          styles.pbLayoutWireframe,
          layoutId === 'blank' ? styles.pbLayoutWireframeBlank : '',
          isActive ? styles.pbLayoutWireframeActive : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="button"
        tabIndex={0}
        aria-label={layoutName}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSelect(layoutId);
        }}
        onClick={() => onSelect(layoutId)}
      >
        {renderPreview(layoutId)}
        <span className={styles.pbLayoutWireframeLabel}>{layoutName}</span>
      </div>
    );
  };

  return (
    <div className={gridClass}>
      {PB_EDITOR_LAYOUT_IDS.map((id) => (
        <div key={id}>{renderWireframe(id)}</div>
      ))}
    </div>
  );
}
