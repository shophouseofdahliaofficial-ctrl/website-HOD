'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { contentApi } from '@/lib/api';
import styles from './Footer.module.css';

const FOOTER_LINKS = [
  { label: 'My Account', href: '/account' },
  { label: 'Cart', href: '/cart' },
  { label: 'Returns & Exchanges', href: '/returns' },
  { label: 'Size Guide', href: '/size-guide' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Stories', href: '/stories' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

export default function Footer() {
  const [trustpilotUrl, setTrustpilotUrl] = useState<string>('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string>('');
  const marqueeTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentApi
      .getByType('reviews')
      .then((data) => {
        if (data && data.isActive && data.metadata) {
          if (data.metadata.trustpilotUrl) {
            setTrustpilotUrl(data.metadata.trustpilotUrl);
          }
          if (data.metadata.googleReviewUrl) {
            setGoogleReviewUrl(data.metadata.googleReviewUrl);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load reviews settings for footer:', err);
      });
  }, []);

  // GSAP Mouse Wheel & Scroll-Accelerated Infinite Marquee
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const track = marqueeTrackRef.current;
    if (!track) return;

    let tween: gsap.core.Tween | null = null;
    let isHovered = false;

    const setupMarquee = () => {
      const group = track.querySelector(`.${styles.marqueeGroup}`) as HTMLElement | null;
      const groupWidth = group ? group.getBoundingClientRect().width : 0;
      if (!groupWidth) return;

      if (tween) tween.kill();

      gsap.set(track, { x: 0 });

      // Faster base speed (duration: 18s)
      tween = gsap.fromTo(
        track,
        { x: 0 },
        {
          x: -groupWidth,
          duration: 18,
          ease: 'none',
          repeat: -1,
        }
      );
    };

    const timer = setTimeout(setupMarquee, 50);

    const handleResize = () => {
      setupMarquee();
    };

    window.addEventListener('resize', handleResize);

    const handleMouseEnter = () => {
      isHovered = true;
      if (tween) gsap.to(tween, { timeScale: 0.6, duration: 0.25, overwrite: 'auto' });
    };

    const handleMouseLeave = () => {
      isHovered = false;
      if (tween) gsap.to(tween, { timeScale: 1, duration: 0.4, overwrite: 'auto' });
    };

    // Fast mouse wheel scroll acceleration on hover
    const handleWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaY) || Math.abs(e.deltaX) || 0;
      if (delta > 2 && tween) {
        const boost = Math.min(2.5 + delta * 0.08, 9);
        gsap.to(tween, {
          timeScale: boost,
          duration: 0.08,
          overwrite: 'auto',
          onComplete: () => {
            if (tween) {
              gsap.to(tween, {
                timeScale: isHovered ? 0.6 : 1,
                duration: 0.7,
                ease: 'power2.out',
                overwrite: 'auto',
              });
            }
          },
        });
      }
    };

    const container = track.parentElement;
    if (container) {
      container.addEventListener('mouseenter', handleMouseEnter);
      container.addEventListener('mouseleave', handleMouseLeave);
      container.addEventListener('wheel', handleWheel, { passive: true });
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      if (container) {
        container.removeEventListener('mouseenter', handleMouseEnter);
        container.removeEventListener('mouseleave', handleMouseLeave);
        container.removeEventListener('wheel', handleWheel);
      }
      if (tween) tween.kill();
    };
  }, []);

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        {(trustpilotUrl || googleReviewUrl) && (
          <div className={styles.trustpilotTopCenter}>
            {trustpilotUrl && (
              <a
                href={trustpilotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.trustpilotBtn}
              >
                <svg fill="#00b67a" viewBox="0 0 24 24" width="18" height="18" role="img" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <title>Trustpilot icon</title>
                  <path d="M12,17.964l5.214-1.321l2.179,6.714L12,17.964z M24,9.286h-9.179L12,0.643L9.179,9.286 H0l7.429,5.357l-2.821,8.643l7.429-5.357l4.571-3.286L24,9.286L24,9.286L24,9.286L24,9.286z"></path>
                </svg>
                <span>Review us on Trustpilot</span>
              </a>
            )}

            {googleReviewUrl && (
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.googleBtn}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <title>Google icon</title>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                <span>Review us on Google</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Infinite Moving Single-Line Links with Dots & Fast Scroll */}
      <div className={styles.footerContent}>
        <div ref={marqueeTrackRef} className={styles.marqueeTrack}>
          {[0, 1, 2, 3].map((setIndex) => (
            <div
              key={setIndex}
              className={styles.marqueeGroup}
              aria-hidden={setIndex > 0 ? 'true' : undefined}
            >
              {FOOTER_LINKS.map((item, i) => (
                <span key={i} className={styles.marqueeItem}>
                  <Link href={item.href} className={styles.footerLink}>
                    {item.label}
                  </Link>
                  <span className={styles.dot}>•</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Marquee Scroll Hint */}
      <div className={styles.marqueeScrollHint}>
        <svg className={styles.marqueeScrollMouseIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="7" />
          <line x1="12" y1="6" x2="12" y2="10" />
        </svg>
        <span className={styles.marqueeScrollHintText}>Scroll</span>
      </div>

      {/* House of Dahlia Signature Watermark */}
      <div className={styles.simpleLogoSection}>
        <span className={styles.copyrightText}>&copy; 2026-house of Dahlia</span>
        <h2 className={styles.simpleLogoText}>House of Dahlia</h2>
      </div>
    </footer>
  );
}
