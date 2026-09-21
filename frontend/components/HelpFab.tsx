'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient, contentApi } from '@/lib/api';
import styles from './HelpFab.module.css';

const REVIEW_US_URL =
  'https://www.google.com/search?q=milko+gwalior&sca_esv=8fdea6dbd6add952&authuser=3&sxsrf=ANbL-n7qfx2M_iJY6Dk6JYLRfKEGrnK91w%3A1777917729569&source=hp&ei=Id_4afLiH-6q4-EPrrmjiQ0&iflsig=AFdpzrgAAAAAafjtMdqwAiRFfJiXKjlPPoicbxX6o5Sg&oq=milko&gs_lp=Egdnd3Mtd2l6IgVtaWxrbyoCCAAyBBAjGCcyCxAAGIAEGIoFGJECMgsQABiABBiKBRiRAjIKEC4YgAQYigUYQzIKEC4YgAQYigUYQzIFEAAYgAQyBRAAGIAEMgUQABiABDILEC4YgAQYxwEYrwEyBRAAGIAESP4NUABYqgRwAHgAkAEAmAGPAaABigWqAQMwLjW4AQHIAQD4AQGYAgWgArYFwgIREC4YgAQYigUYkQIYxwEY0QPCAg4QLhiABBixAxjHARjRA8ICDhAAGIAEGIoFGLEDGIMBwgIOEC4YgAQYigUYsQMYgwHCAgsQABiABBixAxiDAcICCBAuGIAEGLEDwgIOEAAYgAQYigUYkQIYsQPCAhMQLhiABBiKBRhDGMcBGK8BGI4FwgIKEAAYgAQYigUYQ8ICCBAAGIAEGLEDmAMA4gMFEgExIECSBwMwLjWgB8pIsgcDMC41uAe2BcIHBTItNC4xyAcigAgB&sclient=gws-wiz#lrd=0x3976c12bef6ae93f:0x8427baeae2ab4794,3,,,,';

type MenuItem =
  | { label: string; kind: 'internal'; href: string; icon: React.ReactNode }
  | { label: string; kind: 'external'; href: string; icon: React.ReactNode }
  | { label: string; kind: 'action'; actionId: 'review' | 'feedback'; icon: React.ReactNode };

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className || styles.toggleIcon}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2ZM12.04 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.04 20.16C10.66 20.16 9.3 19.81 8.08 19.14L7.79 18.97L4.68 19.79L5.51 16.76L5.32 16.46C4.58 15.18 4.19 13.72 4.19 11.91C4.19 7.37 7.89 3.67 12.04 3.67ZM8.53 7.33C8.37 7.33 8.1 7.39 7.87 7.64C7.65 7.89 7.01 8.49 7.01 9.71C7.01 10.93 7.9 12.11 8.02 12.28C8.15 12.44 9.77 14.94 12.25 16.01C12.84 16.27 13.3 16.42 13.66 16.53C14.25 16.72 14.79 16.69 15.22 16.63C15.7 16.56 16.68 16.03 16.89 15.45C17.1 14.87 17.1 14.38 17.04 14.27C16.97 14.17 16.81 14.11 16.56 13.98C16.31 13.86 15.09 13.26 14.86 13.18C14.64 13.09 14.47 13.05 14.31 13.3C14.14 13.55 13.67 14.11 13.52 14.27C13.38 14.44 13.23 14.46 12.98 14.34C12.74 14.21 11.94 13.95 11 13.11C10.26 12.46 9.77 11.65 9.62 11.41C9.48 11.16 9.6 11.02 9.73 10.89C9.84 10.78 9.97 10.6 10.1 10.45C10.22 10.31 10.26 10.2 10.34 10.04C10.43 9.87 10.38 9.73 10.32 9.61C10.26 9.48 9.77 8.27 9.56 7.78C9.36 7.29 9.15 7.36 9 7.35L8.53 7.33Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className={styles.itemIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className={styles.itemIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function FeedbackIcon() {
  return (
    <svg className={styles.itemIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function formatWhatsAppLink(raw?: string): string {
  if (!raw || !raw.trim()) return 'https://wa.me/';
  const trimmed = raw.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const cleanDigits = trimmed.replace(/[^\d]/g, '');
  return cleanDigits ? `https://wa.me/${cleanDigits}` : 'https://wa.me/';
}

/**
 * Desktop-only floating help control (bottom-right). Hidden on viewports ≤768px.
 */
export default function HelpFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuListRef = useRef<HTMLUListElement>(null);
  const isFirstRender = useRef(true);

  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [whatsappNumber, setWhatsappNumber] = useState<string>('');
  const [trustpilotUrl, setTrustpilotUrl] = useState<string>('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('contact@myscribble.in');

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const [feedbackEmail, setFeedbackEmail] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Load reviews URLs, WhatsApp support number and Contact details on mount
  useEffect(() => {
    // 1. Help support number (WhatsApp / Telegram from Admin panel)
    contentApi.getByType('help_support')
      .then((data) => {
        if (data && data.isActive && data.metadata && data.metadata.helpSupportNumber) {
          setWhatsappNumber(data.metadata.helpSupportNumber);
        }
      })
      .catch((err) => {
        console.error('Failed to load help_support settings for HelpFab:', err);
      });

    // 2. Reviews settings
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
        console.error('Failed to load reviews settings for HelpFab:', err);
      });

    // 3. Contact details
    contentApi.getByType('contact')
      .then((data) => {
        if (data && data.metadata) {
          if (data.metadata.email) {
            setContactEmail(data.metadata.email);
          }
          if (data.metadata.whatsapp) {
            setWhatsappNumber((prev) => prev || data.metadata.whatsapp);
          } else if (data.metadata.phone) {
            setWhatsappNumber((prev) => prev || data.metadata.phone);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load contact info for HelpFab:', err);
      });
  }, []);

  // Prefill email if logged in
  useEffect(() => {
    if (isAuthenticated && user?.email) {
      setFeedbackEmail(user.email);
    } else {
      setFeedbackEmail('');
    }
  }, [user, isAuthenticated, feedbackOpen]);

  // GSAP Smooth Expansion & Collapse Animation
  useEffect(() => {
    if (!rootRef.current || !toggleRef.current || !panelRef.current) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!open) {
        gsap.set(rootRef.current, {
          width: 46,
          height: 46,
          borderRadius: 999,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        });
        gsap.set(toggleRef.current, {
          opacity: 1,
          scale: 1,
          rotation: 0,
          pointerEvents: 'auto',
          display: 'flex',
        });
        gsap.set(panelRef.current, {
          opacity: 0,
          scale: 0.94,
          y: 8,
          pointerEvents: 'none',
          display: 'none',
        });
      }
      return;
    }

    const tl = gsap.timeline();

    if (open) {
      // 1. Calculate natural content height so container wraps text precisely
      panelRef.current.style.display = 'block';
      panelRef.current.style.visibility = 'hidden';
      const naturalHeight = panelRef.current.offsetHeight || panelRef.current.scrollHeight || 180;
      panelRef.current.style.visibility = 'visible';

      // 2. Hide toggle icon smoothly
      tl.to(toggleRef.current, {
        opacity: 0,
        scale: 0.5,
        rotation: -45,
        duration: 0.18,
        ease: 'power2.in',
        onComplete: () => {
          if (toggleRef.current) toggleRef.current.style.pointerEvents = 'none';
        },
      })
      // 3. Expand root container morphing into menu box with exact content height
      .to(
        rootRef.current,
        {
          width: 230,
          height: naturalHeight,
          boxShadow: '0 16px 42px rgba(0, 0, 0, 0.16)',
          duration: 0.35,
          ease: 'power3.out',
        },
        '-=0.08'
      )
      .to(
        rootRef.current,
        {
          borderRadius: 20,
          duration: 0.32,
          ease: 'power2.out',
        },
        '<'
      )
      // 4. Reveal panel smoothly
      .call(() => {
        if (panelRef.current) {
          panelRef.current.style.pointerEvents = 'auto';
        }
      })
      .to(
        panelRef.current,
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.22,
          ease: 'power2.out',
        },
        '-=0.15'
      );

      // 4. Stagger menu items into view
      if (menuListRef.current) {
        const items = menuListRef.current.querySelectorAll('li');
        tl.fromTo(
          items,
          { opacity: 0, y: 10, scale: 0.96 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            stagger: 0.04,
            duration: 0.22,
            ease: 'power2.out',
          },
          '-=0.15'
        );
      }
    } else {
      // Closing timeline
      const items = menuListRef.current ? menuListRef.current.querySelectorAll('li') : [];
      if (items.length > 0) {
        tl.to(items, {
          opacity: 0,
          y: 6,
          stagger: -0.02,
          duration: 0.12,
          ease: 'power2.in',
        });
      }

      tl.to(
        panelRef.current,
        {
          opacity: 0,
          scale: 0.94,
          y: 8,
          duration: 0.16,
          ease: 'power2.in',
          onComplete: () => {
            if (panelRef.current) {
              panelRef.current.style.display = 'none';
              panelRef.current.style.pointerEvents = 'none';
            }
          },
        },
        '<'
      )
      .to(
        rootRef.current,
        {
          width: 46,
          height: 46,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          duration: 0.32,
          ease: 'power3.inOut',
        },
        '-=0.06'
      )
      .to(
        rootRef.current,
        {
          borderRadius: 999,
          duration: 0.32,
          ease: 'power2.inOut',
        },
        '<'
      )
      .call(() => {
        if (toggleRef.current) {
          toggleRef.current.style.display = 'flex';
          toggleRef.current.style.pointerEvents = 'auto';
        }
      })
      .fromTo(
        toggleRef.current,
        { opacity: 0, scale: 0.5, rotation: 45 },
        {
          opacity: 1,
          scale: 1,
          rotation: 0,
          duration: 0.22,
          ease: 'back.out(1.5)',
        },
        '-=0.12'
      );
    }

    return () => {
      tl.kill();
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const closeFeedbackModal = () => {
    setFeedbackOpen(false);
    setFeedbackMessage('');
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackEmail.trim() || !feedbackMessage.trim()) {
      showToast('Please fill out all fields.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/api/feedback', {
        email: feedbackEmail.trim(),
        message: feedbackMessage.trim(),
      });
      showToast('Thank you for your feedback!', 'success');
      closeFeedbackModal();
    } catch (err: any) {
      console.error('Failed to submit feedback:', err);
      showToast(err?.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (pathname?.startsWith('/auth') || pathname === '/coming-soon') {
    return null;
  }

  const MENU: MenuItem[] = [
    {
      label: 'WhatsApp',
      kind: 'external',
      href: formatWhatsAppLink(whatsappNumber),
      icon: <WhatsAppIcon className={styles.itemIcon} />,
    },
    { label: 'Contact', kind: 'internal', href: '/contact', icon: <PhoneIcon /> },
    { label: 'Review us', kind: 'action', actionId: 'review', icon: <StarIcon /> },
    { label: 'Feedback', kind: 'action', actionId: 'feedback', icon: <FeedbackIcon /> },
  ];

  return (
    <>
      <div className={styles.root} ref={rootRef} data-open={open}>
        <div
          className={styles.panel}
          ref={panelRef}
          id="help-fab-menu"
          role="menu"
          aria-label="Help options"
          aria-hidden={!open}
        >
          <div className={styles.title} id="help-fab-title">
            <span>Need help?</span>
            <button type="button" className={styles.panelClose} onClick={close} aria-label="Close help menu">
              ×
            </button>
          </div>
          <ul className={styles.menu} ref={menuListRef} aria-labelledby="help-fab-title">
            {MENU.map((item) => (
              <li key={item.label} role="none">
                {item.kind === 'internal' ? (
                  <Link
                    href={item.href}
                    className={styles.link}
                    role="menuitem"
                    onClick={close}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                ) : item.kind === 'external' ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.link}
                    role="menuitem"
                    onClick={close}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    className={styles.link}
                    role="menuitem"
                    onClick={() => {
                      close();
                      if (item.actionId === 'review') {
                        setReviewOpen(true);
                      } else if (item.actionId === 'feedback') {
                        setFeedbackOpen(true);
                      }
                    }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          ref={toggleRef}
          className={styles.toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={open ? 'help-fab-menu' : undefined}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Help menu open' : 'Open help menu'}
          title={open ? 'Help menu open' : 'Need help?'}
        >
          <WhatsAppIcon />
        </button>
      </div>

      {/* Feedback Modal */}
      {feedbackOpen && (
        <div className={styles.modalOverlay} onClick={closeFeedbackModal}>
          <div className={styles.modalPanel} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalCloseBtn} onClick={closeFeedbackModal} aria-label="Close">×</button>
            <h3 className={styles.modalTitle}>Share Feedback</h3>
            <p className={styles.modalSubtitle}>Your feedback helps us improve our service.</p>
            
            <form onSubmit={handleFeedbackSubmit} className={styles.feedbackForm}>
              <div className={styles.formGroup}>
                <label htmlFor="feedback-email" className={styles.formLabel}>Email Address</label>
                <input
                  id="feedback-email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={feedbackEmail}
                  onChange={(e) => setFeedbackEmail(e.target.value)}
                  className={styles.formInput}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="feedback-message" className={styles.formLabel}>Your Message</label>
                <textarea
                  id="feedback-message"
                  required
                  rows={4}
                  placeholder="How can we help you? Write your feedback here..."
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  className={styles.formTextarea}
                />
              </div>
              
              <div className={styles.modalActions}>
                <button type="submit" className={styles.btnSubmit} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Us Modal */}
      {reviewOpen && (
        <div className={styles.modalOverlay} onClick={() => setReviewOpen(false)}>
          <div className={styles.modalPanel} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalCloseBtn} onClick={() => setReviewOpen(false)} aria-label="Close">×</button>
            <h3 className={styles.modalTitle}>Review Us</h3>
            <p className={styles.modalSubtitle}>We would love to know how we did. Choose a platform to write your review:</p>
            
            <div className={styles.reviewPlatforms}>
              <a
                href={trustpilotUrl || 'https://www.trustpilot.com'}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.reviewBtn} ${styles.btnTrustpilot}`}
                onClick={() => setReviewOpen(false)}
              >
                <svg className={styles.platformIcon} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
                Review on Trustpilot
              </a>
              
              <a
                href={googleReviewUrl || REVIEW_US_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.reviewBtn} ${styles.btnGoogle}`}
                onClick={() => setReviewOpen(false)}
              >
                <svg className={styles.platformIcon} viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
                Review on Google
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
