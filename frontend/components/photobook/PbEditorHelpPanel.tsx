'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { photobookApi } from '@/lib/api/photobook';
import { useToast } from '@/contexts/ToastContext';
import PbThumbScrollbar from './PbThumbScrollbar';
import styles from '../ProductDetailsModal.module.css';

const PB_FEEDBACK_ISSUES = [
  { id: 'cant_upload_images', label: "Can't upload images" },
  { id: 'cant_add_stickers', label: "Can't add stickers" },
  { id: 'canvas_error', label: 'Error in canvas' },
  { id: 'cant_save_project', label: "Can't save project" },
  { id: 'pages_layout_issue', label: 'Pages / layout issue' },
  { id: 'text_typography_issue', label: 'Text / typography issue' },
  { id: 'other', label: 'Other' },
] as const;

function FeedbackStarIcon() {
  return (
    <svg className={styles.pbFeedbackStarIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557L3.04 10.385a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z" />
    </svg>
  );
}

function FeedbackMenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function HelpMenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

type PbTipHandlers = {
  onMouseEnter: (e: ReactMouseEvent) => void;
  onMouseMove?: (e: ReactMouseEvent) => void;
  onMouseLeave: () => void;
};

type Props = {
  darkMode?: boolean;
  productId?: number | string;
  projectId?: string;
  pbTip?: (text: string, align?: 'right' | 'bottom' | 'cursor') => PbTipHandlers;
};

export default function PbEditorHelpPanel({ darkMode = false, productId, projectId, pbTip }: Props) {
  const { showToast } = useToast();
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const helpMenuRef = useRef<HTMLDivElement>(null);
  const feedbackScrollRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [thankYouOpen, setThankYouOpen] = useState(false);
  const [issueType, setIssueType] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetFeedbackForm = useCallback(() => {
    setIssueType('');
    setRating(0);
    setHoverRating(0);
    setMessage('');
    setThankYouOpen(false);
  }, []);

  const closeFeedback = useCallback(() => {
    setFeedbackOpen(false);
    resetFeedbackForm();
  }, [resetFeedbackForm]);

  const updateMenuPosition = useCallback(() => {
    const btn = helpButtonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 168;
    setMenuPosition({
      top: rect.bottom + 8,
      left: Math.max(12, rect.right - menuWidth),
    });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (helpButtonRef.current?.contains(target)) return;
      if (helpMenuRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    // Defer listener so the opening click does not immediately close the menu.
    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown, true);
    }, 0);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const openFeedback = () => {
    setMenuOpen(false);
    setThankYouOpen(false);
    setFeedbackOpen(true);
  };

  const openHelp = () => {
    setMenuOpen(false);
    window.open('https://www.instagram.com/myscribble.in/', '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueType) {
      showToast('Please select where you are facing an issue', 'error');
      return;
    }
    if (rating < 1) {
      showToast('Please rate your experience', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await photobookApi.submitEditorFeedback({
        productId,
        projectId,
        issueType,
        rating,
        message: message.trim() || undefined,
      });
      setThankYouOpen(true);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Failed to submit feedback';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoverRating || rating;

  const helpMenuPortal = menuOpen && menuPosition && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={helpMenuRef}
          className={[
            styles.pbHeaderHelpMenu,
            darkMode ? styles.pbHeaderHelpMenuDark : '',
          ].filter(Boolean).join(' ')}
          role="menu"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <button
            type="button"
            role="menuitem"
            className={styles.pbHeaderHelpMenuItem}
            onClick={openFeedback}
          >
            <span className={styles.pbHeaderHelpMenuIcon} aria-hidden="true">
              <FeedbackMenuIcon />
            </span>
            <span>Feedback</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.pbHeaderHelpMenuItem}
            onClick={openHelp}
          >
            <span className={styles.pbHeaderHelpMenuIcon} aria-hidden="true">
              <HelpMenuIcon />
            </span>
            <span>Help</span>
          </button>
        </div>,
        document.body,
      )
    : null;

  const feedbackModal = feedbackOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          className={styles.pbFeedbackOverlay}
          role="presentation"
          data-lenis-prevent
          onClick={closeFeedback}
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className={[
              styles.pbFeedbackSheet,
              darkMode ? styles.pbFeedbackSheetDark : '',
            ].filter(Boolean).join(' ')}
            role="dialog"
            aria-modal="true"
            aria-labelledby={thankYouOpen ? 'pb-feedback-thanks-title' : 'pb-feedback-title'}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.pbFeedbackCloseBtn}
              onClick={closeFeedback}
              aria-label="Close feedback"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {thankYouOpen ? (
              <div className={styles.pbFeedbackThankYou}>
                <div className={styles.pbFeedbackThankYouIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="36" height="36">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 id="pb-feedback-thanks-title" className={styles.pbFeedbackTitle}>Thank you!</h2>
                <p className={styles.pbFeedbackThankYouText}>
                  Your feedback has been submitted. We appreciate you helping us improve the photobook editor.
                </p>
                <button
                  type="button"
                  className={styles.pbFeedbackSubmitBtn}
                  onClick={closeFeedback}
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className={styles.pbFeedbackSheetHeader}>
                  <h2 id="pb-feedback-title" className={styles.pbFeedbackTitle}>Send feedback</h2>
                  <p className={styles.pbFeedbackSubtitle}>
                    Tell us what went wrong so we can improve the photobook editor.
                  </p>
                </div>

                <div className={styles.pbFeedbackScrollHost}>
                  <div
                    ref={feedbackScrollRef}
                    className={`${styles.pbFeedbackSheetScroll} ${styles.pbNativeScrollHidden}`}
                    data-lenis-prevent
                  >
                    <form onSubmit={handleSubmit} className={styles.pbFeedbackForm}>
                      <fieldset className={styles.pbFeedbackFieldset}>
                        <legend className={styles.pbFeedbackLegend}>In which part are you facing an error?</legend>
                        <div className={styles.pbFeedbackRadioGroup}>
                          {PB_FEEDBACK_ISSUES.map((issue) => (
                            <label key={issue.id} className={styles.pbFeedbackRadioLabel}>
                              <input
                                type="radio"
                                name="pb-feedback-issue"
                                value={issue.id}
                                checked={issueType === issue.id}
                                onChange={() => setIssueType(issue.id)}
                                className={styles.pbFeedbackRadioInput}
                              />
                              <span className={styles.pbFeedbackRadioText}>{issue.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <div className={styles.pbFeedbackField}>
                        <span className={styles.pbFeedbackLegend}>Rate your experience</span>
                        <div
                          className={styles.pbFeedbackStars}
                          data-level={displayRating >= 1 && displayRating <= 5 ? displayRating : undefined}
                          role="radiogroup"
                          aria-label="Star rating"
                        >
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              className={[
                                styles.pbFeedbackStarBtn,
                                star <= displayRating ? styles.pbFeedbackStarBtnActive : '',
                              ].filter(Boolean).join(' ')}
                              onClick={() => setRating(star)}
                              onMouseEnter={() => setHoverRating(star)}
                              onMouseLeave={() => setHoverRating(0)}
                              aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                              aria-pressed={rating === star}
                            >
                              <FeedbackStarIcon />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className={styles.pbFeedbackField}>
                        <label htmlFor="pb-feedback-message" className={styles.pbFeedbackLegend}>
                          Additional details (optional)
                        </label>
                        <textarea
                          id="pb-feedback-message"
                          className={styles.pbFeedbackTextarea}
                          rows={4}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Describe what happened..."
                          maxLength={4000}
                        />
                      </div>

                      <button
                        type="submit"
                        className={styles.pbFeedbackSubmitBtn}
                        disabled={submitting}
                      >
                        {submitting ? 'Submitting…' : 'Submit feedback'}
                      </button>
                    </form>
                  </div>
                  <PbThumbScrollbar scrollRef={feedbackScrollRef} />
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div
        className={[
          styles.pbHeaderHelpWrap,
          darkMode ? styles.pbHeaderHelpWrapDark : '',
        ].filter(Boolean).join(' ')}
      >
        <button
          ref={helpButtonRef}
          type="button"
          className={[
            styles.photobookIconButton,
            menuOpen ? styles.photobookIconButtonActive : '',
          ].filter(Boolean).join(' ')}
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Help and feedback"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          {...(pbTip ? pbTip('Help & feedback') : {})}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>
      </div>
      {helpMenuPortal}
      {feedbackModal}
    </>
  );
}
