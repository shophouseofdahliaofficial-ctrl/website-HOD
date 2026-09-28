'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import styles from './page.module.css';

const BRAND_TEXT = 'Houseofdahlia.in';
const REST_TEXT = 'COMING SOON';

export default function ComingSoonPage() {
  const [isAnimating, setIsAnimating] = useState(true);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const bgVideoWrapperRef = useRef<HTMLDivElement>(null);
  const blackOverlayRef = useRef<HTMLDivElement>(null);
  const stayTunedTextRef = useRef<HTMLDivElement>(null);
  const actionWrapperRef = useRef<HTMLDivElement>(null);
  const sentenceWrapperRef = useRef<HTMLDivElement>(null);
  const restTextRef = useRef<HTMLDivElement>(null);

  // Character pop-in animation restart trigger
  const handleReplay = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(`.${styles.btnConnect}`) || (typeof window !== 'undefined' && window.scrollY > 50)) return;
    setIsAnimating(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    });
  };

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    const onScroll = () => {
      ScrollTrigger.update();
    };
    lenis.on('scroll', onScroll);

    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    const ctx = gsap.context(() => {
      const scrollTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: scrollTrackRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.5,
        },
      });

      // Phase A: "COMING SOON" & Connect Button fade out in place
      if (restTextRef.current) {
        scrollTimeline.to(
          restTextRef.current,
          {
            opacity: 0,
            duration: 0.25,
            ease: 'power1.out',
          },
          0
        );
      }

      if (actionWrapperRef.current) {
        scrollTimeline.to(
          actionWrapperRef.current,
          {
            opacity: 0,
            y: 20,
            pointerEvents: 'none',
            duration: 0.25,
            ease: 'power1.out',
          },
          0
        );
      }

      // Phase B: Text zooms in while Razor-Sharp Pure Black Mask expands over it
      if (sentenceWrapperRef.current) {
        scrollTimeline.to(
          sentenceWrapperRef.current,
          {
            scale: 2.5,
            duration: 0.75,
            ease: 'power2.inOut',
          },
          0.1
        );
      }

      if (bgVideoWrapperRef.current) {
        scrollTimeline.to(
          bgVideoWrapperRef.current,
          {
            scale: 1.15,
            opacity: 0.2,
            duration: 0.85,
            ease: 'power2.inOut',
          },
          0.1
        );
      }

      if (blackOverlayRef.current) {
        scrollTimeline.to(
          blackOverlayRef.current,
          {
            clipPath: 'circle(150% at 50% 50%)',
            duration: 0.85,
            ease: 'power2.inOut',
          },
          0.1
        );
      }

      if (stayTunedTextRef.current) {
        scrollTimeline.to(
          stayTunedTextRef.current,
          {
            opacity: 1,
            scale: 1,
            duration: 0.45,
            ease: 'power1.inOut',
          },
          0.55
        );
      }
    }, scrollTrackRef);

    return () => {
      ctx.revert();
      lenis.destroy();
      gsap.ticker.remove(tickerCallback);
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  let staggerCount = 0;

  return (
    <div className={styles.pageWrapper} onClick={handleReplay}>
      {/* Background Video Layer */}
      <div ref={bgVideoWrapperRef} className={styles.bgVideoWrapper} id="bg-video-wrapper">
        <video className={styles.bgVideo} autoPlay loop muted playsInline preload="auto">
          <source src="/IMG_4165.MP4" type="video/mp4" />
        </video>
        <div className={styles.bgOverlay} />
      </div>

      {/* Background Black Expansion Mask Layer */}
      <div ref={blackOverlayRef} id="black-expand-overlay" className={styles.blackExpandOverlay} />

      {/* Final White Stay Tuned Text Layer */}
      <div ref={stayTunedTextRef} id="stay-tuned-text" className={styles.stayTunedText}>
        Stay tuned!
      </div>

      {/* Scroll Track for Lenis + GSAP ScrollTrigger */}
      <div ref={scrollTrackRef} className={styles.scrollTrack}>
        <main className={styles.container}>
          <div className={styles.contentBox}>
            <h1 className={styles.comingSoonText}>
              <span
                ref={sentenceWrapperRef}
                className={`${styles.textSentenceWrapper} ${styles.tDigitGroup} ${
                  isAnimating ? styles.isAnimating : ''
                }`}
              >
                <div className={styles.brandDomain}>
                  {Array.from(BRAND_TEXT).map((char, i) => {
                    const currentStagger = staggerCount++;
                    return (
                      <span
                        key={`b-${i}`}
                        className={styles.tDigit}
                        data-stagger={currentStagger}
                        style={{ animationDelay: `calc(var(--digit-stagger) * ${currentStagger})` }}
                      >
                        {char}
                      </span>
                    );
                  })}
                </div>
                <div ref={restTextRef} className={styles.restText}>
                  {Array.from(REST_TEXT).map((char, i) => {
                    const currentStagger = staggerCount++;
                    return (
                      <span
                        key={`r-${i}`}
                        className={styles.tDigit}
                        data-stagger={currentStagger}
                        style={{ animationDelay: `calc(var(--digit-stagger) * ${currentStagger})` }}
                      >
                        {char}
                      </span>
                    );
                  })}
                </div>
              </span>
            </h1>

            <div ref={actionWrapperRef} className={styles.actionWrapper}>
              <a href="mailto:contact@houseofdahlia.in" className={styles.btnConnect}>
                <svg
                  className={styles.btnIcon}
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                <span>Connect</span>
              </a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
