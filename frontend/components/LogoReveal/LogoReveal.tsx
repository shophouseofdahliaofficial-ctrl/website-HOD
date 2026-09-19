'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import styles from './LogoReveal.module.css';

const LOGO_SRC = '/scribble-logo-bw.png';

export default function LogoReveal() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fallbackImgRef = useRef<HTMLImageElement | null>(null);
  const scrollDownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || !fallbackImgRef.current) return;

    gsap.registerPlugin(ScrollTrigger);

    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top top',
      end: '+=150%',
      pin: true,
      pinSpacing: true,
      scrub: 0.1,
      onUpdate: (self) => {
        if (fallbackImgRef.current) {
          const scale = 1 + self.progress * 8;
          const opacity = 1 - Math.max(0, (self.progress - 0.8) / 0.2);
          fallbackImgRef.current.style.transform = `scale(${scale})`;
          fallbackImgRef.current.style.opacity = `${opacity}`;
        }
        if (scrollDownRef.current) {
          const textOpacity = Math.max(0, 1 - self.progress * 8);
          const textOffsetY = self.progress * 30;
          scrollDownRef.current.style.opacity = `${textOpacity}`;
          scrollDownRef.current.style.transform = `translateX(-50%) translateY(${textOffsetY}px)`;
        }
      },
    });

    return () => {
      trigger.kill();
    };
  }, []);

  return (
    <section
      ref={containerRef}
      className={styles.heroContainer}
      aria-label="Homepage Opening Reveal"
    >
      <div className={styles.fallbackContainer}>
        <img
          ref={fallbackImgRef}
          src={LOGO_SRC}
          alt="Scribble Brand Logo"
          className={`${styles.fallbackLogo} ${styles.fallbackLogoVisible}`}
        />
      </div>

      {/* Bottom Center "Scroll Down" Text Indicator */}
      <div
        ref={scrollDownRef}
        className={`${styles.scrollDownWrapper} ${styles.scrollDownVisible}`}
      >
        <span className={styles.scrollDownText}>Scroll Down</span>
        <svg
          className={styles.scrollDownIcon}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </div>
    </section>
  );
}

