'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { bannersApi, Banner as BannerType, BannerImageItem } from '@/lib/api';
import styles from './Banner.module.css';

interface BannerProps {
  autoSlideInterval?: number; // in milliseconds
}

interface BannerSectionProps {
  banner: BannerType;
  isMobile: boolean;
  autoSlideInterval: number;
}

function BannerSection({ banner, isMobile, autoSlideInterval }: BannerSectionProps) {
  const items: BannerImageItem[] =
    banner.images && banner.images.length > 0
      ? banner.images
      : [
          {
            id: banner.id,
            imageUrl: banner.imageUrl,
            imagePublicId: banner.imagePublicId,
            mobileImageUrl: banner.mobileImageUrl,
            mobileImagePublicId: banner.mobileImagePublicId,
            title: banner.title,
            link: banner.link,
            linkTarget: banner.linkTarget,
          },
        ];

  const activeMode = isMobile
    ? banner.mobileDisplayMode === 'down'
      ? 'down'
      : 'swipe'
    : banner.desktopDisplayMode === 'down'
    ? 'down'
    : 'swipe';

  const [currentSlide, setCurrentSlide] = useState(0);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [resetTimerToken, setResetTimerToken] = useState(0);
  const firstImageRef = useRef<HTMLDivElement>(null);

  const totalSlides = items.length;

  // Auto slide timer - resets cleanly on every manual swipe or slide advance
  useEffect(() => {
    if (totalSlides <= 1 || activeMode === 'down') return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, autoSlideInterval);

    return () => clearInterval(timer);
  }, [totalSlides, activeMode, autoSlideInterval, resetTimerToken]);

  // Adapt container height to the first image aspect ratio if enabled
  useEffect(() => {
    if (items.length === 0 || !firstImageRef.current || activeMode === 'down') {
      setContainerHeight(null);
      return;
    }

    if (banner.adaptToFirstImage) {
      const firstItem = items[0];
      const imgUrl = isMobile && firstItem.mobileImageUrl ? firstItem.mobileImageUrl : firstItem.imageUrl;
      if (!imgUrl) return;

      const img = new Image();
      img.onload = () => {
        const aspectRatio = img.height / img.width;
        const containerWidth = firstImageRef.current?.parentElement?.clientWidth || window.innerWidth;
        const calculatedHeight = containerWidth * aspectRatio;
        setContainerHeight(calculatedHeight);
      };
      img.src = imgUrl;
    } else {
      setContainerHeight(null);
    }
  }, [items, isMobile, activeMode, banner.adaptToFirstImage]);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
    setResetTimerToken((prev) => prev + 1);
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
    setResetTimerToken((prev) => prev + 1);
  }, [totalSlides]);

  const goToNext = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
    setResetTimerToken((prev) => prev + 1);
  }, [totalSlides]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    const threshold = 40;
    if (diff > threshold) {
      goToNext();
    } else if (diff < -threshold) {
      goToPrevious();
    }
    setTouchStartX(null);
  };

  const getImageUrl = (item: BannerImageItem) => {
    if (isMobile && item.mobileImageUrl) {
      return item.mobileImageUrl;
    }
    return item.imageUrl;
  };

  // Stacked vertical layout ("Banners down one by one")
  if (activeMode === 'down') {
    return (
      <div className={styles.bannerStackedContainer}>
        {items.map((item, index) => {
          const itemLink = item.link || banner.link;
          const target = item.linkTarget || banner.linkTarget || 'same_tab';
          const opensInNewTab =
            target === 'new_tab' || (!target && !!itemLink && itemLink.startsWith('http'));

          const BannerWrapper = itemLink ? 'a' : 'div';
          const wrapperProps = itemLink
            ? {
                href: itemLink,
                target: opensInNewTab ? '_blank' : '_self',
                rel: opensInNewTab ? 'noopener noreferrer' : undefined,
                className: `${styles.stackedBannerItem} ${styles.clickable}`,
              }
            : {
                className: styles.stackedBannerItem,
              };

          const imageUrl = getImageUrl(item);
          const itemTitle = item.title || (index === 0 ? banner.title : '');

          return (
            <BannerWrapper key={item.id || index} {...wrapperProps}>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={itemTitle || 'Banner'}
                  className={styles.stackedBannerImage}
                  loading="lazy"
                />
              )}
              {(itemTitle || banner.description) && (
                <div className={styles.stackedBannerContent}>
                  {itemTitle && <h2 className={styles.stackedBannerTitle}>{itemTitle}</h2>}
                  {index === 0 && banner.description && (
                    <p className={styles.stackedBannerDescription}>{banner.description}</p>
                  )}
                </div>
              )}
            </BannerWrapper>
          );
        })}
      </div>
    );
  }

  // Carousel Layout (Swipe mode)
  return (
    <div
      className={styles.bannerContainer}
      style={containerHeight ? { height: `${containerHeight}px` } : undefined}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className={styles.bannerWrapper}>
        {items.map((item, index) => {
          const itemLink = item.link || banner.link;
          const target = item.linkTarget || banner.linkTarget || 'same_tab';
          const opensInNewTab =
            target === 'new_tab' || (!target && !!itemLink && itemLink.startsWith('http'));

          const BannerWrapper = itemLink ? 'a' : 'div';
          const wrapperProps = itemLink
            ? {
                href: itemLink,
                target: opensInNewTab ? '_blank' : '_self',
                rel: opensInNewTab ? 'noopener noreferrer' : undefined,
                style: { textDecoration: 'none', display: 'block', width: '100%', height: '100%' },
              }
            : {};

          const imageUrl = getImageUrl(item);
          const isFirstSlide = index === 0;
          const itemTitle = item.title || (isFirstSlide ? banner.title : '');

          return (
            <BannerWrapper key={item.id || index} {...wrapperProps}>
              <div
                ref={isFirstSlide ? firstImageRef : null}
                className={`${styles.bannerSlide} ${index === currentSlide ? styles.active : ''} ${
                  itemLink ? styles.clickable : ''
                }`}
                style={{
                  backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
                  backgroundColor: '#f5f5f5',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {(itemTitle || (isFirstSlide && banner.description)) && (
                  <div className={styles.bannerContent}>
                    {itemTitle && <h2 className={styles.bannerTitle}>{itemTitle}</h2>}
                    {isFirstSlide && banner.description && (
                      <p className={styles.bannerDescription}>{banner.description}</p>
                    )}
                  </div>
                )}
              </div>
            </BannerWrapper>
          );
        })}
      </div>

      {/* Navigation Arrows (shown if more than 1 image) */}
      {totalSlides > 1 && (
        <>
          <button
            className={styles.navButton}
            onClick={goToPrevious}
            aria-label="Previous slide"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            className={`${styles.navButton} ${styles.navButtonRight}`}
            onClick={goToNext}
            aria-label="Next slide"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Dots Indicator */}
          <div className={styles.dotsContainer}>
            {items.map((_, index) => (
              <button
                key={index}
                className={`${styles.dot} ${index === currentSlide ? styles.dotActive : ''}`}
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Banner Component
 * Fetches all active banner sets and renders each section with its own images and display modes.
 */
export default function Banner({ autoSlideInterval = 5000 }: BannerProps) {
  const pathname = usePathname();
  const [banners, setBanners] = useState<BannerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const bannersData = await bannersApi.getAll();
        setBanners(bannersData || []);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch banners:', error);
        setLoading(false);
      }
    };

    fetchBanners();
  }, []);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    if (typeof window !== 'undefined') {
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, []);

  // Show skeleton loading effect
  if (loading) {
    return (
      <div className={`${styles.bannerOuter} ${pathname === '/cart' ? styles.hideOnMobile : ''}`}>
        <div className={styles.bannerSkeleton}></div>
      </div>
    );
  }

  if (banners.length === 0) {
    return null;
  }

  return (
    <div
      className={`${styles.bannerOuter} ${pathname === '/cart' ? styles.hideOnMobile : ''}`}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
    >
      {banners.map((banner) => (
        <BannerSection
          key={banner.id}
          banner={banner}
          isMobile={isMobile}
          autoSlideInterval={autoSlideInterval}
        />
      ))}
    </div>
  );
}
