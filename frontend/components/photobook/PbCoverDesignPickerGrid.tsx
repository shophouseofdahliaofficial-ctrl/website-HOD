'use client';

import styles from '../ProductDetailsModal.module.css';
import type { PbCoverDesignId } from './canvas/coverDesigns';
import { getPbCoverDesignDefinition, PB_COVER_DESIGN_IDS } from './canvas/coverDesigns';

export type PbCoverDesignPickerGridProps = {
  activeDesignId?: string | null;
  onSelect: (designId: PbCoverDesignId) => void;
  className?: string;
};

export default function PbCoverDesignPickerGrid({
  activeDesignId,
  onSelect,
  className,
}: PbCoverDesignPickerGridProps) {
  const gridClass = [styles.pbLayoutsGrid, className ?? ''].filter(Boolean).join(' ');

  const renderPreview = (designId: PbCoverDesignId) => {
    switch (designId) {
      case 'cover-full-bleed':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeCoverFullBleedBox}`} />
        );
      case 'cover-full-page':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeSingleBox}`} />
        );
      case 'cover-center-inset':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeCenterInsetBox}`}>
            <div className={styles.pbWireframeMiniBox} />
          </div>
        );
      case 'cover-title-top':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeTextTopBox}`}>
            <div className={styles.pbWireframeMiniTextLabel}>Title</div>
            <div className={styles.pbWireframeMiniBox} />
          </div>
        );
      case 'cover-title-bottom':
        return (
          <div className={`${styles.pbLayoutWireframePreview} ${styles.pbWireframeTextBottomBox}`}>
            <div className={styles.pbWireframeMiniBox} />
            <div className={styles.pbWireframeMiniTextLabel}>Title</div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderWireframe = (designId: PbCoverDesignId) => {
    const isActive = activeDesignId === designId;
    const designName = getPbCoverDesignDefinition(designId).name;

    return (
      <div
        className={[
          styles.pbLayoutWireframe,
          isActive ? styles.pbLayoutWireframeActive : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="button"
        tabIndex={0}
        aria-label={designName}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSelect(designId);
        }}
        onClick={() => onSelect(designId)}
      >
        {renderPreview(designId)}
        <span className={styles.pbLayoutWireframeLabel}>{designName}</span>
      </div>
    );
  };

  return (
    <div className={gridClass}>
      {PB_COVER_DESIGN_IDS.map((id) => (
        <div key={id}>{renderWireframe(id)}</div>
      ))}
    </div>
  );
}
