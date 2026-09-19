'use client';

import { memo } from 'react';
import Image from 'next/image';
import type { PhotoboothPhoto } from '@/lib/photobooth/constants';
import styles from './photobooth.module.css';

type PolaroidFrameProps = {
  photo: PhotoboothPhoto;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  interactive?: boolean;
  priority?: boolean;
  sizes?: string;
};

function PolaroidFrame({
  photo,
  className = '',
  style,
  onClick,
  interactive = false,
  priority = false,
  sizes,
}: PolaroidFrameProps) {
  const Tag = interactive || onClick ? 'button' : 'div';

  return (
    <Tag
      type={Tag === 'button' ? 'button' : undefined}
      className={`${styles.scrapbookFrame} ${className}`.trim()}
      style={style}
      onClick={onClick}
      aria-label={interactive || onClick ? `View photo: ${photo.alt}` : undefined}
    >
      <span className={styles.photoImageWrap}>
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes={sizes || "(max-width: 768px) 140px, 200px"}
          className={styles.photoImage}
          priority={priority}
          draggable={false}
        />
      </span>
      {photo.label && (
        <span className={styles.photoLabel} aria-hidden>
          {photo.label}
        </span>
      )}
    </Tag>
  );
}

export default memo(PolaroidFrame, (prevProps, nextProps) => {
  return (
    prevProps.photo.id === nextProps.photo.id &&
    prevProps.priority === nextProps.priority &&
    prevProps.interactive === nextProps.interactive &&
    prevProps.sizes === nextProps.sizes
  );
});


