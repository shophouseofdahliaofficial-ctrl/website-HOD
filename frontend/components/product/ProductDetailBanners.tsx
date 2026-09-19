'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProductDetailBanners } from '@/types';
import styles from './ProductDetailBanners.module.css';

interface ProductDetailBannersProps {
  banners?: ProductDetailBanners | null;
}

export default function ProductDetailBanners({ banners }: ProductDetailBannersProps) {
  const images = banners?.images?.filter(Boolean) ?? [];
  const displayMode = banners?.displayMode === 'carousel' ? 'carousel' : 'stacked';
  const adaptToFullImageRatio = Boolean(banners?.adaptToFullImageRatio);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const firstImageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentSlide(0);
  }, [images.length, displayMode]);

  useEffect(() => {
    if (!adaptToFullImageRatio || images.length === 0 || !firstImageRef.current) {
      setContainerHeight(null);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const containerWidth = firstImageRef.current?.parentElement?.clientWidth || window.innerWidth;
      const aspectRatio = img.height / img.width;
      setContainerHeight(containerWidth * aspectRatio);
    };
    img.src = images[0];
  }, [adaptToFullImageRatio, images]);

  if (images.length === 0) return null;

  if (displayMode === 'stacked') {
    return (
      <section className={styles.stackedSection} aria-label="Product banners">
        {images.map((url, index) => (
          <div
            key={`${url}-${index}`}
            className={`${styles.stackedImageWrap} ${adaptToFullImageRatio ? styles.naturalRatio : ''}`}
          >
            <img src={url} alt={`Product banner ${index + 1}`} className={styles.bannerImage} loading="lazy" />
          </div>
        ))}
      </section>
    );
  }

  const goTo = (index: number) => {
    if (images.length === 0) return;
    const next = ((index % images.length) + images.length) % images.length;
    setCurrentSlide(next);
  };

  return (
    <section className={styles.carouselSection} aria-label="Product banners carousel">
      <div
        className={styles.carouselViewport}
        style={containerHeight ? { height: `${containerHeight}px` } : undefined}
      >
        <div
          className={styles.carouselTrack}
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {images.map((url, index) => (
            <div
              key={`${url}-${index}`}
              ref={index === 0 ? firstImageRef : undefined}
              className={`${styles.carouselSlide} ${adaptToFullImageRatio ? styles.naturalRatio : ''}`}
            >
              <img src={url} alt={`Product banner ${index + 1}`} className={styles.bannerImage} loading="lazy" />
            </div>
          ))}
        </div>

        {images.length > 1 && (
          <>
            <button type="button" className={styles.carouselArrowLeft} onClick={() => goTo(currentSlide - 1)} aria-label="Previous banner">
              ‹
            </button>
            <button type="button" className={styles.carouselArrowRight} onClick={() => goTo(currentSlide + 1)} aria-label="Next banner">
              ›
            </button>
            <div className={styles.carouselDots}>
              {images.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`${styles.carouselDot} ${index === currentSlide ? styles.carouselDotActive : ''}`}
                  onClick={() => goTo(index)}
                  aria-label={`Go to banner ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
