'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
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
  const marqueeTrackRef = useRef<HTMLDivElement>(null);

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
