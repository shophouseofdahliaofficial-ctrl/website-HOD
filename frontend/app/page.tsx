'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import Logo from '@/components/Logo';
import ScrambleText from '@/components/ScrambleText';
import Circular3DOrbitShowcase from '@/components/Circular3DOrbitShowcase';
import SitePreloader from '@/components/SitePreloader';
import HomeMenuSidebar from '@/components/HomeMenuSidebar';
import styles from './page.module.css';

/**
 * Clean & Simple GSAP Homepage
 * - Hero: #530000 with centered "House Of Dahlia", top-right links, and scroll indicator
 * - Sticky Top Nav with smooth inverted colors over white section
 * - Smooth scroll down transition into a full white page section
 */
export default function HomePage() {
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [isInverted, setIsInverted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuTriggerRect, setMenuTriggerRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const topNavRef = useRef<HTMLElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextSectionRef = useRef<HTMLElement>(null);
  const pixelCanvasRef = useRef<HTMLCanvasElement>(null);
  const phase3SectionRef = useRef<HTMLElement>(null);
  const phase3PixelCanvasRef = useRef<HTMLCanvasElement>(null);

  // Strictly lock scroll to top of Phase 1 while preloader is running
  useEffect(() => {
    if (!isPreloaded) {
      window.scrollTo(0, 0);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const blockScroll = (e: Event) => {
        e.preventDefault();
      };

      window.addEventListener('wheel', blockScroll, { passive: false });
      window.addEventListener('touchmove', blockScroll, { passive: false });

      return () => {
        document.body.style.overflow = prevOverflow;
        window.removeEventListener('wheel', blockScroll);
        window.removeEventListener('touchmove', blockScroll);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isPreloaded]);

  const handleVideoTrigger = () => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 0;
    video.playbackRate = 1.0;
    video.play().catch(() => {});

    // Smooth elegant fade-in as pixel mask reaches 95% of screen
    gsap.fromTo(
      video,
      { opacity: 0 },
      {
        opacity: 0.45,
        duration: 1.6,
        ease: 'power2.out',
      }
    );

    let isFadingOut = false;
    const TARGET_TIME = 7.0;
    const SLOWDOWN_START = 5.8;

    const monitorPlayback = () => {
      if (video && !video.paused) {
        const time = video.currentTime;

        // Trigger smooth fade-out as video approaches 7s
        if (time >= SLOWDOWN_START && !isFadingOut) {
          isFadingOut = true;
          gsap.to(video, {
            opacity: 0,
            duration: 1.4,
            ease: 'power2.out',
            onComplete: () => {
              if (video) {
                video.pause();
              }
            },
          });
        }

        if (time >= TARGET_TIME) {
          try {
            video.playbackRate = 1.0;
          } catch {}
          video.pause();
          return;
        }

        // Smoothly ramp down speed from 1.0x to 0.2x between 5.8s and 7.0s
        if (time >= SLOWDOWN_START) {
          const progress = (time - SLOWDOWN_START) / (TARGET_TIME - SLOWDOWN_START);
          const newRate = Math.max(0.18, 1.0 - Math.pow(progress, 1.5) * 0.82);
          try {
            video.playbackRate = newRate;
          } catch {}
        }
      }

      requestAnimationFrame(monitorPlayback);
    };

    requestAnimationFrame(monitorPlayback);
  };

  // Subtle interactive mouse parallax floating effect on hover
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const xToVideo = gsap.quickTo(video, 'x', { duration: 1.2, ease: 'power2.out' });
    const yToVideo = gsap.quickTo(video, 'y', { duration: 1.2, ease: 'power2.out' });

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const xPercent = (clientX / innerWidth - 0.5) * 2;
      const yPercent = (clientY / innerHeight - 0.5) * 2;

      // Subtle float movement across x and y
      xToVideo(xPercent * 20);
      yToVideo(yPercent * 20);
    };

    const handleMouseLeave = () => {
      xToVideo(0);
      yToVideo(0);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Track scroll for dynamic nav color inversion, center title squeeze, and procedural pixel square transition
  useEffect(() => {
    // Fast pseudo-random generator
    const pseudoRandom = (seed: number) => {
      const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
      return x - Math.floor(x);
    };

    let lastPixelState = -1; // 0: clear, 1: transitioning, 2: solid
    let lastPhase3State = -1; // 0: clear, 1: transitioning, 2: solid

    const renderPixelTransition = () => {
      const canvas = pixelCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const scrollY = window.scrollY || window.pageYOffset;
      const vh = window.innerHeight || 800;

      // When fully at top (0px scroll), completely clear
      if (scrollY <= 0) {
        if (lastPixelState !== 0) {
          const width = (canvas.width = canvas.offsetWidth || window.innerWidth);
          const height = (canvas.height = canvas.offsetHeight || vh);
          ctx.clearRect(0, 0, width, height);
          lastPixelState = 0;
        }
        return;
      }

      // Smooth progression: baseline ascends from the bottom (rows) all the way to top (0)
      const scrollRatio = Math.min(1.0, scrollY / (vh * 0.9));
      
      // If fully covered in white and already past transition threshold, fill solid once and return
      if (scrollRatio >= 1.0) {
        if (lastPixelState !== 2) {
          const width = (canvas.width = canvas.offsetWidth || window.innerWidth);
          const height = (canvas.height = canvas.offsetHeight || vh);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          lastPixelState = 2;
        }
        return;
      }

      lastPixelState = 1;
      const width = (canvas.width = canvas.offsetWidth || window.innerWidth);
      const height = (canvas.height = canvas.offsetHeight || vh);
      ctx.clearRect(0, 0, width, height);

      const PIXEL_SIZE = 14;
      const cols = Math.ceil(width / PIXEL_SIZE);
      const rows = Math.ceil(height / PIXEL_SIZE);

      // Gradual emergence factor to guarantee 0 height at scrollY = 0 and smooth exit when scrolling back up
      const emergence = Math.min(1.0, scrollY / 180);

      ctx.fillStyle = '#ffffff';

      for (let c = 0; c < cols; c++) {
        // Multi-frequency organic stepped noise curve matching reference image
        const wave1 = Math.sin(c * 0.28) * 0.25;
        const wave2 = Math.sin(c * 0.08 + 1.8) * 0.38;
        const randomSpike = (pseudoRandom(c * 7 + 13) - 0.5) * 0.45;
        const colOffset = wave1 + wave2 + randomSpike;

        // Base row calculation: starts exactly at rows (invisible) and ascends smoothly with scroll
        const baselineRow = rows - Math.floor(scrollRatio * (rows + 15));
        const jaggedOffset = Math.floor(colOffset * 10 * emergence);
        const startRow = Math.max(0, Math.min(rows, baselineRow - jaggedOffset));

        // Draw solid column pixels down to the bottom
        for (let r = startRow; r < rows; r++) {
          ctx.fillRect(c * PIXEL_SIZE, r * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
        }

        // Procedural floating pixel bits / dithered stair-steps above the boundary
        if (startRow < rows && emergence > 0.05) {
          for (let r = Math.max(0, startRow - 4); r < startRow; r++) {
            const distanceAbove = startRow - r;
            const spawnChance = Math.max(0, (0.6 - distanceAbove * 0.15) * emergence);
            if (pseudoRandom(c * 43 + r * 67) < spawnChance) {
              ctx.fillRect(c * PIXEL_SIZE, r * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
            }
          }
        }
      }
    };

    const renderPhase3PixelTransition = () => {
      const canvas = phase3PixelCanvasRef.current;
      const phase3Section = phase3SectionRef.current;
      if (!canvas || !phase3Section) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = phase3Section.getBoundingClientRect();
      const vh = window.innerHeight || 800;

      // Only start pixel emergence as Phase 3 actually begins entering the viewport (rect.top < vh)
      if (rect.top >= vh * 1.05) {
        if (lastPhase3State !== 0) {
          const width = (canvas.width = canvas.offsetWidth || window.innerWidth);
          const height = (canvas.height = canvas.offsetHeight || vh);
          ctx.clearRect(0, 0, width, height);
          lastPhase3State = 0;
        }
        return;
      }

      const scrollRatio = Math.min(1.0, Math.max(0, (vh - rect.top) / (vh * 0.85)));

      if (scrollRatio <= 0) {
        if (lastPhase3State !== 0) {
          const width = (canvas.width = canvas.offsetWidth || window.innerWidth);
          const height = (canvas.height = canvas.offsetHeight || vh);
          ctx.clearRect(0, 0, width, height);
          lastPhase3State = 0;
        }
        return;
      }

      // If fully covered in Phase 3 (#530000), fill solid once and return
      if (scrollRatio >= 1.0) {
        if (lastPhase3State !== 2) {
          const width = (canvas.width = canvas.offsetWidth || window.innerWidth);
          const height = (canvas.height = canvas.offsetHeight || vh);
          ctx.fillStyle = '#530000';
          ctx.fillRect(0, 0, width, height);
          lastPhase3State = 2;
        }
        return;
      }

      lastPhase3State = 1;
      const width = (canvas.width = canvas.offsetWidth || window.innerWidth);
      const height = (canvas.height = canvas.offsetHeight || vh);
      ctx.clearRect(0, 0, width, height);

      const PIXEL_SIZE = 14;
      const cols = Math.ceil(width / PIXEL_SIZE);
      const rows = Math.ceil(height / PIXEL_SIZE);
      const emergence = Math.min(1.0, scrollRatio * 2.8);

      ctx.fillStyle = '#530000';

      for (let c = 0; c < cols; c++) {
        const wave1 = Math.sin(c * 0.28) * 0.25;
        const wave2 = Math.sin(c * 0.08 + 1.8) * 0.38;
        const randomSpike = (pseudoRandom(c * 11 + 23) - 0.5) * 0.45;
        const colOffset = wave1 + wave2 + randomSpike;

        const baselineRow = rows - Math.floor(scrollRatio * (rows + 15));
        const jaggedOffset = Math.floor(colOffset * 10 * emergence);
        const startRow = Math.max(0, Math.min(rows, baselineRow - jaggedOffset));

        for (let r = startRow; r < rows; r++) {
          ctx.fillRect(c * PIXEL_SIZE, r * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
        }

        if (startRow < rows && emergence > 0.05) {
          for (let r = Math.max(0, startRow - 4); r < startRow; r++) {
            const distanceAbove = startRow - r;
            const spawnChance = Math.max(0, (0.6 - distanceAbove * 0.15) * emergence);
            if (pseudoRandom(c * 47 + r * 71) < spawnChance) {
              ctx.fillRect(c * PIXEL_SIZE, r * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
            }
          }
        }
      }
    };

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const vh = window.innerHeight || 800;

      // Pause Hero video when scrolled down past Phase 1 to free mobile GPU/decoder
      const video = videoRef.current;
      if (video) {
        if (scrollY > vh * 0.95) {
          if (!video.paused) {
            video.pause();
          }
        }
      }

      // Smoothly bend and squeeze center title with strong 3D perspective
      if (titleRef.current) {
        const scrollRatio = Math.min(1, Math.max(0, scrollY / vh));
        const scaleX = Math.max(0.2, 1 - scrollRatio * 0.8);
        const scaleY = Math.max(0.55, 1 - scrollRatio * 0.45);
        const tiltX = scrollRatio * 62; // Deep 3D backward bend
        titleRef.current.style.transform = `perspective(380px) rotateX(${tiltX.toFixed(2)}deg) scaleX(${scaleX.toFixed(4)}) scaleY(${scaleY.toFixed(4)})`;
      }

      // Promptly disappear the "Scroll down" indicator as Phase 1 begins scrolling down
      if (scrollIndicatorRef.current) {
        const indicatorOpacity = Math.max(0, 1 - scrollY / 80);
        scrollIndicatorRef.current.style.opacity = indicatorOpacity.toFixed(3);
        scrollIndicatorRef.current.style.transform = `translate3d(0, ${(scrollY * 0.3).toFixed(1)}px, 0)`;
        scrollIndicatorRef.current.style.pointerEvents = indicatorOpacity < 0.05 ? 'none' : 'auto';
      }

      if (nextSectionRef.current && phase3SectionRef.current) {
        const nextRect = nextSectionRef.current.getBoundingClientRect();
        const phase3Rect = phase3SectionRef.current.getBoundingClientRect();
        // Invert nav colors only when over the white Phase 2 section
        // Switch back to white text and hide center logo as Phase 3 (#530000) pixels emerge
        setIsInverted(nextRect.top <= 80 && phase3Rect.top > vh * 0.7);
      } else if (nextSectionRef.current) {
        const rect = nextSectionRef.current.getBoundingClientRect();
        setIsInverted(rect.top <= 80);
      }

      renderPixelTransition();
      renderPhase3PixelTransition();
    };

    const handleResize = () => {
      lastPixelState = -1;
      lastPhase3State = -1;
      renderPixelTransition();
      renderPhase3PixelTransition();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleScrollDown = () => {
    nextSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={styles.pageWrapper}>
      {!isPreloaded && (
        <SitePreloader
          onComplete={() => setIsPreloaded(true)}
          onVideoTrigger={handleVideoTrigger}
        />
      )}

      {/* Top Header: Collections (Top-Left), Logo (Middle), Menu (Top-Right) */}
      <header
        ref={topNavRef}
        className={`${styles.topHeader} ${isInverted ? styles.invertedNav : ''}`}
      >
        <div className={styles.headerLeft}>
          <Link href="/products" className={styles.navLink}>
            <ScrambleText text="Collections" />
          </Link>
        </div>

        <div className={styles.headerCenter}>
          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`${styles.centerLogo} ${isInverted ? styles.visibleLogo : ''}`}
            aria-label="House Of Dahlia Home"
          >
            <Logo imageClassName={styles.customLogoImg} />
          </Link>
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.navLinkButton}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuTriggerRect({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
              });
              setIsMenuOpen(true);
            }}
            aria-label="Toggle menu"
          >
            <ScrambleText text="Menu" />
          </button>
        </div>
      </header>

      {/* Smooth Expanding 40% Width Menu Panel with 6 Items in Big Text */}
      <HomeMenuSidebar
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        triggerRect={menuTriggerRect}
      />

      {/* 1. Hero Fullscreen Section (#530000) */}
      <section id="phase-1-section" className={styles.heroSection}>
        {/* Dull Background Video */}
        <video
          ref={videoRef}
          className={styles.heroVideo}
          muted
          playsInline
          preload="auto"
        >
          <source src="/cretae_a_video_in_back.mp4" type="video/mp4" />
        </video>
        <div className={styles.videoOverlay} />

        {/* Centered Main Title */}
        <div className={styles.canvasNotice}>
          <h1 ref={titleRef} className={styles.title}>
            House Of Dahlia
          </h1>
        </div>

        {/* Bottom Center Scroll Indicator */}
        <div
          ref={scrollIndicatorRef}
          className={styles.scrollIndicator}
          onClick={handleScrollDown}
          role="button"
          tabIndex={0}
          aria-label="Scroll down to content"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleScrollDown();
            }
          }}
        >
          <svg
            className={styles.scrollArrow}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
          <span className={styles.scrollText}>
            <ScrambleText text="Scroll down" />
          </span>
        </div>
      </section>

      {/* 2. White Section (Phase 2) Revealed on Scroll Down */}
      <section id="phase-2-section" ref={nextSectionRef} className={styles.whiteSection}>
        {/* Leading Procedural Pixel Square Crest */}
        <div className={styles.pixelTransitionContainer}>
          <canvas ref={pixelCanvasRef} className={styles.pixelTransitionCanvas} />
        </div>

        {/* 3D Circular Orbit Carousel in Phase 2 */}
        <div className={styles.whiteContentContainer}>
          <Circular3DOrbitShowcase />
        </div>
      </section>

      {/* Leading Procedural Phase 3 #530000 Pixel Square Crest */}
      <div className={styles.phase3PixelTransitionContainer}>
        <canvas ref={phase3PixelCanvasRef} className={styles.phase3PixelCanvas} />
      </div>

      {/* 3. Phase 3 Fullscreen Footer Section (#530000) */}
      <section id="phase-3-section" ref={phase3SectionRef} className={styles.phase3Section}>
        <div className={styles.phase3Content}>
          {/* Centered Large Brand Heading */}
          <div className={styles.phase3TopHero}>
            <h2 className={styles.phase3BrandHeading}>
              House Of Dahlia
            </h2>
          </div>

          {/* Horizontal Dot-Separated Links Lineup (as in Image 2) */}
          <nav className={styles.phase3HorizontalLinks} aria-label="Footer links">
            <span className={styles.phase3LinkItem}>
              <Link href="/size-guide" className={styles.phase3Link}>
                Size Guide
              </Link>
              <span className={styles.phase3Dot} aria-hidden="true">•</span>
            </span>

            <span className={styles.phase3LinkItem}>
              <Link href="/faqs" className={styles.phase3Link}>
                FAQs
              </Link>
              <span className={styles.phase3Dot} aria-hidden="true">•</span>
            </span>

            <span className={styles.phase3LinkItem}>
              <Link href="/stories" className={styles.phase3Link}>
                Stories
              </Link>
              <span className={styles.phase3Dot} aria-hidden="true">•</span>
            </span>

            <span className={styles.phase3LinkItem}>
              <Link href="/contact" className={styles.phase3Link}>
                Contact Us
              </Link>
              <span className={styles.phase3Dot} aria-hidden="true">•</span>
            </span>

            <span className={styles.phase3LinkItem}>
              <Link href="/privacy" className={styles.phase3Link}>
                Privacy
              </Link>
              <span className={styles.phase3Dot} aria-hidden="true">•</span>
            </span>

            <span className={styles.phase3LinkItem}>
              <Link href="/terms" className={styles.phase3Link}>
                Terms
              </Link>
              <span className={styles.phase3Dot} aria-hidden="true">•</span>
            </span>

            <span className={styles.phase3LinkItem}>
              <Link href="/dashboard" className={styles.phase3Link}>
                My Account
              </Link>
              <span className={styles.phase3Dot} aria-hidden="true">•</span>
            </span>

            <span className={styles.phase3LinkItem}>
              <Link href="/cart" className={styles.phase3Link}>
                Cart
              </Link>
              <span className={styles.phase3Dot} aria-hidden="true">•</span>
            </span>

            <span className={styles.phase3LinkItem}>
              <Link href="/returns" className={styles.phase3Link}>
                Returns & Exchanges
              </Link>
            </span>
          </nav>

          {/* Bottom Bar */}
          <div className={styles.phase3BottomBar}>
            <span>© 2026 House Of Dahlia. All rights reserved.</span>
            <button
              type="button"
              className={styles.phase3BackToTop}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Back to top
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
