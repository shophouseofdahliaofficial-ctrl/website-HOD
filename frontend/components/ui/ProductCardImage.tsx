'use client';

import { useState } from 'react';
import Image from 'next/image';
import styles from './ProductCardImage.module.css';

interface ProductCardImageProps {
  src: string | null | undefined;
  alt: string;
  hoverSrc?: string | null | undefined;
  className?: string;
  sizes?: string;
  width?: number;
  height?: number;
}

const PLACEHOLDER_LOGO = '/finallogo.png';

export default function ProductCardImage({
  src,
  alt,
  hoverSrc,
  className,
  sizes = '(max-width: 640px) 50vw, (max-width: 968px) 50vw, (max-width: 1200px) 33vw, 25vw',
  width = 500,
  height = 500,
}: ProductCardImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const hasValidImage = Boolean(src) && !hasError;

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {/* Placeholder Logo visible while image is loading or when no valid image exists */}
      {(!isLoaded || !hasValidImage) && (
        <div className={styles.placeholderWrapper}>
          <img
            src={PLACEHOLDER_LOGO}
            alt="House Of Dahlia"
            className={styles.placeholderLogo}
            loading="eager"
          />
        </div>
      )}

      {hasValidImage && src ? (
        <>
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            sizes={sizes}
            className={`${styles.mainImage} ${isLoaded ? styles.mainImageLoaded : ''}`}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
          />

          {hoverSrc && isLoaded ? (
            <div className={styles.hoverImageContainer}>
              <Image
                src={hoverSrc}
                alt={alt}
                width={width}
                height={height}
                sizes={sizes}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
