'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient, contentApi } from '@/lib/api';
import styles from './HelpFab.module.css';

const REVIEW_US_URL =
  'https://www.google.com/search?q=milko+gwalior&sca_esv=8fdea6dbd6add952&authuser=3&sxsrf=ANbL-n7qfx2M_iJY6Dk6JYLRfKEGrnK91w%3A1777917729569&source=hp&ei=Id_4afLiH-6q4-EPrrmjiQ0&iflsig=AFdpzrgAAAAAafjtMdqwAiRFfJiXKjlPPoicbxX6o5Sg&oq=milko&gs_lp=Egdnd3Mtd2l6IgVtaWxrbyoCCAAyBBAjGCcyCxAAGIAEGIoFGJECMgsQABiABBiKBRiRAjIKEC4YgAQYigUYQzIKEC4YgAQYigUYQzIFEAAYgAQyBRAAGIAEMgUQABiABDILEC4YgAQYxwEYrwEyBRAAGIAESP4NUABYqgRwAHgAkAEAmAGPAaABigWqAQMwLjW4AQHIAQD4AQGYAgWgArYFwgIREC4YgAQYigUYkQIYxwEY0QPCAg4QLhiABBixAxjHARjRA8ICDhAAGIAEGIoFGLEDGIMBwgIOEC4YgAQYigUYsQMYgwHCAgsQABiABBixAxiDAcICCBAuGIAEGLEDwgIOEAAYgAQYigUYkQIYsQPCAhMQLhiABBiKBRhDGMcBGK8BGI4FwgIKEAAYgAQYigUYQ8ICCBAAGIAEGLEDmAMA4gMFEgExIECSBwMwLjWgB8pIsgcDMC41uAe2BcIHBTItNC4xyAcigAgB&sclient=gws-wiz#lrd=0x3976c12bef6ae93f:0x8427baeae2ab4794,3,,,,';

type MenuItem =
  | { label: string; kind: 'internal'; href: string; icon: React.ReactNode }
  | { label: string; kind: 'action'; actionId: 'review' | 'feedback'; icon: React.ReactNode };

function HelpIcon() {
  return (
    <svg
      className={styles.toggleIcon}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.11241 7.82201C9.44756 6.83666 10.5551 6 12 6C13.7865 6 15 7.24054 15 8.5C15 9.75946 13.7865 11 12 11C11.4477 11 11 11.4477 11 12L11 14C11 14.5523 11.4477 15 12 15C12.5523 15 13 14.5523 13 14L13 12.9082C15.203 12.5001 17 10.7706 17 8.5C17 5.89347 14.6319 4 12 4C9.82097 4 7.86728 5.27185 7.21894 7.17799C7.0411 7.70085 7.3208 8.26889 7.84366 8.44673C8.36653 8.62458 8.93457 8.34488 9.11241 7.82201ZM12 20C12.8285 20 13.5 19.3284 13.5 18.5C13.5 17.6716 12.8285 17 12 17C11.1716 17 10.5 17.6716 10.5 18.5C10.5 19.3284 11.1716 20 12 20Z"
        fill="currentColor"
      />
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

/**
 * Desktop-only floating help control (bottom-right). Hidden on viewports ≤768px.
 */
export default function HelpFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [trustpilotUrl, setTrustpilotUrl] = useState<string>('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('contact@myscribble.in');

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const [feedbackEmail, setFeedbackEmail] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Load reviews URLs and Contact details on mount
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
        console.error('Failed to load reviews settings for HelpFab:', err);
      });

    contentApi.getByType('contact')
      .then((data) => {
        if (data && data.metadata && data.metadata.email) {
          setContactEmail(data.metadata.email);
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

  if (pathname === '/coming-soon') {
    return null;
  }

  const MENU: MenuItem[] = [
    { label: 'Contact', kind: 'internal', href: '/contact', icon: <PhoneIcon /> },
    { label: 'Review us', kind: 'action', actionId: 'review', icon: <StarIcon /> },
    { label: 'Feedback', kind: 'action', actionId: 'feedback', icon: <FeedbackIcon /> },
  ];

  return (
    <>
      <div className={styles.root} ref={rootRef} data-open={open}>
        <div
          className={styles.panel}
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
            <ul className={styles.menu} aria-labelledby="help-fab-title">
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
          className={styles.toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={open ? 'help-fab-menu' : undefined}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Help menu open' : 'Open help menu'}
          title={open ? 'Help menu open' : 'Need help?'}
        >
          <HelpIcon />
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
