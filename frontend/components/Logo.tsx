'use client';

import { useEffect, useState } from 'react';
import { contentApi } from '@/lib/api';
import styles from './Logo.module.css';

export interface LogoProps {
  /** Class for the text fallback */
  textClassName?: string;
  /** Class for the image when logo is set */
  imageClassName?: string;
  /** Optional fallback text when no logo is configured */
  fallbackText?: string;
}

/**
 * Renders the site logo from content (Cloudinary) or skeleton during loading.
 * Fetches /api/content/logo; if metadata.imageUrl exists, shows img with metadata.widthPx.
 * Uses different widths for mobile and desktop.
 */
export default function Logo({ textClassName, imageClassName, fallbackText }: LogoProps) {
  const [config, setConfig] = useState<{ imageUrl: string; widthPx?: number; widthPxMobile?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    contentApi
      .getByType('logo')
      .then((c) => {
        const url = c?.metadata?.imageUrl;
        if (typeof url === 'string' && url) {
          const w = c?.metadata?.widthPx;
          const wMobile = c?.metadata?.widthPxMobile;
          setConfig({ 
            imageUrl: url, 
            widthPx: typeof w === 'number' ? w : 120,
            widthPxMobile: typeof wMobile === 'number' ? wMobile : (typeof w === 'number' ? w : 120)
          });
        }
      })
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <span
        className={`${styles.logoSkeleton} ${imageClassName || ''}`}
        style={{
          '--logo-width-desktop': '120px',
          '--logo-width-mobile': '120px',
        } as React.CSSProperties}
      />
    );
  }

  const defaultLogoUrl = '/finallogo.png';
  const displayUrl = config?.imageUrl || defaultLogoUrl;

  return (
    <img
      src={displayUrl}
      alt="House Of Dahlia"
      onLoad={() => setImgLoaded(true)}
      className={`${styles.logoImage} ${imageClassName || ''}`}
      style={{
        '--logo-width-desktop': `${config?.widthPx ?? 130}px`,
        '--logo-width-mobile': `${config?.widthPxMobile ?? config?.widthPx ?? 110}px`,
        opacity: imgLoaded ? 1 : 0.8,
        transition: 'opacity 0.25s ease-in-out',
        objectFit: 'contain',
      } as React.CSSProperties}
    />
  );
}



