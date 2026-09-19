'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import Logo from './Logo';
import { contentApi } from '@/lib/api';
import styles from './Footer.module.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [trustpilotUrl, setTrustpilotUrl] = useState<string>('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string>('');
  const logoTextRef = useRef<HTMLDivElement>(null);
  const lettersRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    contentApi.getByType('reviews')
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

  useEffect(() => {
    const container = logoTextRef.current;
    if (!container) return;
    const elements = lettersRef.current.filter(Boolean);
    if (elements.length === 0) return;

    // Set initial hidden state so letters don't show before footer is scrolled into view
    gsap.set(elements, {
      y: 65,
      opacity: 0,
      rotateX: -70,
      filter: 'blur(10px)',
    });

    let hasTriggered = false;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTriggered) {
            hasTriggered = true;

            // Trigger GSAP entrance animation when footer is scrolled into view
            gsap.fromTo(
              elements,
              {
                y: 65,
                opacity: 0,
                rotateX: -70,
                filter: 'blur(10px)',
              },
              {
                y: 0,
                opacity: 1,
                rotateX: 0,
                filter: 'blur(0px)',
                duration: 1.15,
                stagger: 0.06,
                ease: 'power3.out',
                onComplete: () => {
                  // Continuous floating wave animation
                  gsap.to(elements, {
                    y: -12,
                    duration: 2.2,
                    ease: 'sine.inOut',
                    repeat: -1,
                    yoyo: true,
                    stagger: {
                      each: 0.1,
                      repeat: -1,
                      yoyo: true,
                    },
                  });
                },
              }
            );

            observer.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleLogoHover = () => {
    const elements = lettersRef.current.filter(Boolean);
    if (elements.length === 0) return;

    gsap.to(elements, {
      y: -20,
      rotateZ: (i) => (i % 2 === 0 ? -7 : 7),
      duration: 0.32,
      stagger: 0.04,
      ease: 'back.out(2)',
      yoyo: true,
      repeat: 1,
    });
  };

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
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>Review us on Google</span>
              </a>
            )}
          </div>
        )}

        <div className={styles.footerContent}>
          <ul className={styles.linksList}>
            <li>
              <Link href="/products">Products</Link>
            </li>
            <li>
              <Link href="/about">About Us</Link>
            </li>
          </ul>

          <ul className={styles.linksList}>
            <li>
              <Link href="/orders">Orders</Link>
            </li>
            <li>
              <Link href="/contact">Contact</Link>
            </li>
          </ul>

          <ul className={styles.linksList}>
            <li>
              <Link href="/privacy">Privacy Policy</Link>
            </li>
            <li>
              <Link href="/terms">Terms & Conditions</Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Full-width 3D Tilted Center Scribble Text */}
      <div className={styles.bigLogoSection}>
        <div className={styles.bigLogoPerspective}>
          <div
            ref={logoTextRef}
            className={styles.bigLogoText}
            onMouseEnter={handleLogoHover}
          >
            {'scribble'.split('').map((char, index) => (
              <span
                key={index}
                ref={(el) => {
                  lettersRef.current[index] = el;
                }}
                className={styles.bigLogoChar}
              >
                {char}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.container}>
        {/* Copyright */}
        <div className={styles.copyright}>
          <p>© 2025-{currentYear} myscribble.in. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
