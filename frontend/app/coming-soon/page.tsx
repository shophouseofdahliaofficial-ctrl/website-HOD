'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, contentApi } from '@/lib/api';
import styles from './page.module.css';
import { COMING_SOON_BYPASS_COOKIE } from '@/lib/utils/constants';
const BYPASS_MAX_AGE = 86400; // 24 hours

function setBypassCookie() {
  document.cookie = `${COMING_SOON_BYPASS_COOKIE}=1; path=/; max-age=${BYPASS_MAX_AGE}; samesite=lax`;
}


export default function ComingSoonPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Dynamic Content & Likes state
  const [siteContent, setSiteContent] = useState<any>(null);
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoActive, setVideoActive] = useState(false);
  const [contentActive, setContentActive] = useState(false);

  // Logged-in admins can access the site; redirect them off coming-soon
  useEffect(() => {
    if (authLoading) return;
    if (isAdmin) {
      router.replace('/');
    }
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    fetchComingSoonContent();
    if (typeof window !== 'undefined') {
      setHasLiked(!!localStorage.getItem('milko_waiting_clicked'));
    }
  }, []);

  // Delay the video loading by 1.5 seconds
  useEffect(() => {
    const loadTimer = setTimeout(() => {
      setVideoLoaded(true);
      const activeTimer = setTimeout(() => {
        setVideoActive(true);
      }, 100);
      return () => clearTimeout(activeTimer);
    }, 1500);

    return () => clearTimeout(loadTimer);
  }, []);

  // Delay center card and radial overlay fade-in by 1s
  useEffect(() => {
    const timer = setTimeout(() => {
      setContentActive(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Slow down the background video once loaded and ensure playback starts
  useEffect(() => {
    if (!videoLoaded || !videoRef.current) return;

    const video = videoRef.current;
    video.playbackRate = 0.9;

    const tryPlay = () => {
      void video.play().catch(() => {
        const resumeOnInteract = () => {
          void video.play().catch(() => {});
          window.removeEventListener('pointerdown', resumeOnInteract);
          window.removeEventListener('keydown', resumeOnInteract);
        };
        window.addEventListener('pointerdown', resumeOnInteract, { once: true });
        window.addEventListener('keydown', resumeOnInteract, { once: true });
      });
    };

    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      tryPlay();
      return;
    }

    video.addEventListener('canplay', tryPlay, { once: true });
    return () => video.removeEventListener('canplay', tryPlay);
  }, [videoLoaded, videoActive]);

  const fetchComingSoonContent = async () => {
    try {
      const data = await contentApi.getByType('coming_soon', true);
      setSiteContent(data);
      setLikes(data.metadata?.waitingCount || 0);
    } catch (err) {
      console.error('Failed to load coming soon content:', err);
    }
  };

  const handleLike = async () => {
    if (hasLiked) return;

    const previousLikes = likes;
    setLikes((prev) => prev + 1);
    setHasLiked(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('milko_waiting_clicked', 'true');
    }

    try {
      const res = await contentApi.incrementWaiting('coming_soon');
      if (typeof res.waitingCount === 'number') {
        setLikes(res.waitingCount);
      }
    } catch (err) {
      console.error('Failed to increment waitlist counter:', err);
      setLikes(previousLikes);
      setHasLiked(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('milko_waiting_clicked');
      }
    }
  };

  // Don't render this page for admins
  if (isAdmin) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    try {
      await apiClient.post<void>('/api/auth/verify-admin-password', { password });
      setBypassCookie();
      setShowModal(false);
      window.location.href = '/';
    } catch (err: any) {
      console.error('Coming soon bypass verification failed:', err);
      const message = err?.message || 'Could not verify password. Please try again.';
      if (err?.status === 0) {
        setError('Could not reach the backend. Check that the API server is running and NEXT_PUBLIC_API_BASE_URL is set correctly.');
      } else if (message.toLowerCase().includes('incorrect password')) {
        setError('Incorrect password. Use the admin panel password (ADMIN_PANEL_PASSWORD on the backend), not the database password.');
      } else {
        setError(message);
      }
      setPassword('');
      setIsVerifying(false);
    }
  };

  return (
    <div className={styles.wrapper}>

      {/* ── Fullscreen video background ────────────────────────── */}
      <div className={`${styles.videoBackground} ${contentActive ? styles.videoBackgroundActive : ''}`} aria-hidden="true">
        {videoLoaded && (
          <video
            ref={videoRef}
            className={`${styles.bgVideo} ${hasLiked ? styles.bgVideoLiked : ''} ${
              videoActive ? styles.bgVideoActive : ''
            }`}
            src="/coming-soon.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
          />
        )}
        {/* Radial overlay: transparent centre, dark pink corners */}
        <div className={`${styles.radialOverlay} ${contentActive ? styles.radialOverlayActive : ''}`} />
      </div>

      {/* ── Centre card ──────────────────────────────────────── */}
      <div className={`${styles.centerCard} ${contentActive ? styles.centerCardActive : ''}`}>
        <img
          src="/scribble-logo-photoroom.png"
          alt="Scribble Logo"
          className={styles.logo}
        />

        <h1 className={styles.title}>
          {siteContent?.title || 'Scribble is coming soon!'}
        </h1>

        <div className={styles.actionsRow}>
          <button
            type="button"
            className={`${styles.waitingBtn} ${hasLiked ? styles.waitingBtnLiked : ''}`}
            onClick={handleLike}
            disabled={hasLiked}
          >
            <svg className={styles.waitingBtnIcon} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span>{hasLiked ? 'See you soon!' : 'I am waiting'}</span>
            <span className={styles.likeCounter}>{likes}</span>
          </button>

          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setShowConnectModal(true); }}
            className={styles.connectLink}
          >
            Connect with us
          </a>
        </div>
      </div>

      {/* ── Access password link removed ─────────────────────── */}

      {/* ── Connect modal ─────────────────────────────────────── */}
      {showConnectModal && (
        <div className={styles.modalOverlay} onClick={() => setShowConnectModal(false)}>
          <div className={styles.connectModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.connectModalHeader}>
              <h2 className={styles.connectModalTitle}>Connect with us</h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setShowConnectModal(false)}
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <p className={styles.connectModalDesc}>
              Have questions, feedback, or want to partner with us? Reach out through our official channels.
            </p>

            <div className={styles.connectList}>
              <a href="mailto:contact@myscribble.in" className={styles.connectItem}>
                <div className={`${styles.connectIconWrapper} ${styles.emailWrapper}`}>
                  <svg className={styles.connectIcon} viewBox="0 0 24 24" fill="none">
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className={styles.connectInfo}>
                  <span className={styles.connectLabel}>Email Us</span>
                  <span className={styles.connectValue}>contact@myscribble.in</span>
                </div>
                <svg className={styles.connectArrow} viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>

              <a href="https://www.instagram.com/myscribble.in/" target="_blank" rel="noopener noreferrer" className={styles.connectItem}>
                <div className={`${styles.connectIconWrapper} ${styles.instaWrapper}`}>
                  <svg className={styles.connectIcon} viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zM17.5 6.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className={styles.connectInfo}>
                  <span className={styles.connectLabel}>Instagram</span>
                  <span className={styles.connectValue}>@myscribble.in</span>
                </div>
                <svg className={styles.connectArrow} viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Password modal ────────────────────────────────────── */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Access through password</h2>
            <form onSubmit={handleSubmit} className={styles.form}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className={styles.input}
                disabled={isVerifying}
                autoFocus
              />
              {error && <p className={styles.error}>{error}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)} disabled={isVerifying}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn} disabled={isVerifying || !password}>
                  {isVerifying ? 'Verifying…' : 'Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
