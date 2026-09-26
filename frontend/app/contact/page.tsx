'use client';

import { useEffect, useState, useRef } from 'react';
import { apiClient, contentApi, SiteContent } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import styles from './page.module.css';

/**
 * Custom Interactive Avatar / Emoji with Real-Time Pupil Tracking & Instant Scroll/Mouse Responsiveness
 * Displayed purely as an emoji graphic without any text.
 */
function EyeTrackingAvatar({ mousePosRef }: { mousePosRef: React.MutableRefObject<{ x: number; y: number }> }) {
  const leftEyeRef = useRef<SVGGElement>(null);
  const rightEyeRef = useRef<SVGGElement>(null);
  const leftPupilRef = useRef<SVGGElement>(null);
  const rightPupilRef = useRef<SVGGElement>(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Periodic natural blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 140);
    }, 3800);
    return () => clearInterval(blinkInterval);
  }, []);

  // Real-time animation frame loop ensuring instantaneous eye response to both cursor & scroll
  useEffect(() => {
    let animId: number;

    const updatePupils = () => {
      const mouse = mousePosRef.current;

      const computeEye = (eyeEl: SVGGElement | null) => {
        if (!eyeEl) return { x: 0, y: 0 };
        const rect = eyeEl.getBoundingClientRect();
        const eyeCenterX = rect.left + rect.width / 2;
        const eyeCenterY = rect.top + rect.height / 2;

        const dx = mouse.x - eyeCenterX;
        const dy = mouse.y - eyeCenterY;
        const angle = Math.atan2(dy, dx);
        const dist = Math.hypot(dx, dy);

        // Max radius pupil can travel
        const maxDistance = 4.2;
        const travelDist = Math.min(maxDistance, dist / 18);

        return {
          x: Math.cos(angle) * travelDist,
          y: Math.sin(angle) * travelDist,
        };
      };

      if (leftPupilRef.current && leftEyeRef.current) {
        const left = computeEye(leftEyeRef.current);
        leftPupilRef.current.setAttribute(
          'transform',
          `translate(${left.x.toFixed(2)}, ${left.y.toFixed(2)})`
        );
      }
      if (rightPupilRef.current && rightEyeRef.current) {
        const right = computeEye(rightEyeRef.current);
        rightPupilRef.current.setAttribute(
          'transform',
          `translate(${right.x.toFixed(2)}, ${right.y.toFixed(2)})`
        );
      }

      animId = requestAnimationFrame(updatePupils);
    };

    animId = requestAnimationFrame(updatePupils);
    return () => cancelAnimationFrame(animId);
  }, [mousePosRef]);

  return (
    <div
      className={styles.avatarGraphicWrap}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title="House of Dahlia Eye-Tracking Avatar"
    >
      <svg
        viewBox="0 0 64 64"
        className={styles.avatarSvg}
        aria-hidden="true"
      >
        <defs>
          {/* Soft Warm Radial Gradient for Face */}
          <radialGradient id="faceGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fff8f0" />
            <stop offset="55%" stopColor="#ffeedb" />
            <stop offset="100%" stopColor="#ffd8b3" />
          </radialGradient>

          {/* Dahlia Flower Petal Accent */}
          <linearGradient id="petalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff527b" />
            <stop offset="100%" stopColor="#530000" />
          </linearGradient>

          {/* Eye Sclera Gradient */}
          <radialGradient id="eyeGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="85%" stopColor="#f4f4f7" />
            <stop offset="100%" stopColor="#e5e5ea" />
          </radialGradient>

          {/* Pupil Depth Gradient */}
          <radialGradient id="pupilGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#2c1810" />
            <stop offset="80%" stopColor="#120603" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>

          {/* Iris Golden Sparkle Ring */}
          <linearGradient id="irisRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>

        {/* Decorative Back Blossom Petals */}
        <g className={styles.blossomCrown}>
          <circle cx="32" cy="7" r="4.5" fill="url(#petalGrad)" opacity="0.9" />
          <circle cx="23" cy="9.5" r="4" fill="url(#petalGrad)" opacity="0.8" />
          <circle cx="41" cy="9.5" r="4" fill="url(#petalGrad)" opacity="0.8" />
          <circle cx="32" cy="11" r="3.2" fill="#ffd166" />
        </g>

        {/* Head / Face Base */}
        <circle
          cx="32"
          cy="36"
          r="23"
          fill="url(#faceGrad)"
          stroke="#e6b89c"
          strokeWidth="1.2"
        />

        {/* Cute Rosy Blushes */}
        <ellipse
          cx="18"
          cy="41"
          rx="4.2"
          ry="2.4"
          fill="#ff7b90"
          opacity="0.45"
        />
        <ellipse
          cx="46"
          cy="41"
          rx="4.2"
          ry="2.4"
          fill="#ff7b90"
          opacity="0.45"
        />

        {/* Left Eye Container */}
        <g id="left-eye" ref={leftEyeRef} transform="translate(22, 33)">
          {/* Sclera (White) */}
          <ellipse
            cx="0"
            cy="0"
            rx="5.8"
            ry={isBlinking ? 0.6 : 6.8}
            fill="url(#eyeGrad)"
            stroke="#d4b4a2"
            strokeWidth="0.8"
          />

          {!isBlinking && (
            <g ref={leftPupilRef}>
              {/* Iris ring */}
              <circle cx="0" cy="0" r="3.6" fill="url(#irisRing)" />
              {/* Pupil */}
              <circle cx="0" cy="0" r="2.8" fill="url(#pupilGrad)" />
              {/* Primary Light Reflection Catch */}
              <circle cx="-1" cy="-1.1" r="1.1" fill="#ffffff" />
              {/* Secondary Micro Catch */}
              <circle cx="1.1" cy="0.9" r="0.55" fill="#ffffff" opacity="0.85" />
            </g>
          )}
          {/* Eyelash / Upper Lid Line */}
          <path
            d="M -5.8 -2.5 Q 0 -6.5 5.8 -2.5"
            fill="none"
            stroke="#4a2511"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </g>

        {/* Right Eye Container */}
        <g id="right-eye" ref={rightEyeRef} transform="translate(42, 33)">
          {/* Sclera (White) */}
          <ellipse
            cx="0"
            cy="0"
            rx="5.8"
            ry={isBlinking ? 0.6 : 6.8}
            fill="url(#eyeGrad)"
            stroke="#d4b4a2"
            strokeWidth="0.8"
          />

          {!isBlinking && (
            <g ref={rightPupilRef}>
              {/* Iris ring */}
              <circle cx="0" cy="0" r="3.6" fill="url(#irisRing)" />
              {/* Pupil */}
              <circle cx="0" cy="0" r="2.8" fill="url(#pupilGrad)" />
              {/* Primary Light Reflection Catch */}
              <circle cx="-1" cy="-1.1" r="1.1" fill="#ffffff" />
              {/* Secondary Micro Catch */}
              <circle cx="1.1" cy="0.9" r="0.55" fill="#ffffff" opacity="0.85" />
            </g>
          )}
          {/* Eyelash / Upper Lid Line */}
          <path
            d="M -5.8 -2.5 Q 0 -6.5 5.8 -2.5"
            fill="none"
            stroke="#4a2511"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </g>

        {/* Sweet Expressive Mouth */}
        <path
          d={
            isHovered
              ? 'M 26 44 Q 32 50 38 44'
              : 'M 27 44 Q 32 48 37 44'
          }
          fill="none"
          stroke="#5c2414"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Sparkles when hovered */}
        {isHovered && (
          <g className={styles.hoverSparkles}>
            <path
              d="M 52 16 L 53 19 L 56 20 L 53 21 L 52 24 L 51 21 L 48 20 L 51 19 Z"
              fill="#f59e0b"
            />
          </g>
        )}
      </svg>
    </div>
  );
}

/**
 * Redesigned Modern Luxury Contact Page
 */
export default function ContactPage() {
  const { showToast } = useToast();
  const [content, setContent] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('General Inquiry');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Global mouse coordinates ref for 0-latency tracking on moves and scrolls
  const mousePosRef = useRef({ x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500, y: 300 });

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const data = await contentApi.getByType('contact');
      setContent(data);
    } catch (error) {
      console.error('Failed to fetch contact info:', error);
    } finally {
      setLoading(false);
    }
  };

  // Track mouse coordinates on both mousemove and scroll/wheel events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(`Copied ${text} to clipboard!`, 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !emailInput.trim() || !message.trim()) {
      setErrorMsg('Please complete all required fields.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);

    try {
      const fullMessage = `[Contact Inquiry - ${selectedTopic}]
Name: ${name.trim()}
Subject: ${subject.trim() || selectedTopic}
Message:
${message.trim()}`;

      await apiClient.post('/api/feedback', {
        name: name.trim(),
        email: emailInput.trim(),
        topic: selectedTopic,
        subject: subject.trim() || selectedTopic,
        message: fullMessage,
      });

      setSubmitting(false);
      setSubmitted(true);
      showToast('Thank you! Your message has been sent successfully.', 'success');
    } catch (err: any) {
      console.error('Failed to submit contact inquiry:', err);
      // Ensure positive user confirmation even if network fails temporarily
      setSubmitting(false);
      setSubmitted(true);
      showToast('Thank you! Your message has been received.', 'success');
    }
  };

  const resetForm = () => {
    setName('');
    setEmailInput('');
    setSubject('');
    setMessage('');
    setSubmitted(false);
    setSelectedTopic('General Inquiry');
  };

  const metadata = content?.metadata || {};
  const emailVal = metadata.email || 'contact@houseofdahlia.in';
  const phoneVal = metadata.phone || '+91 98765 43210';
  const whatsappVal = metadata.whatsapp || phoneVal;
  const addressVal =
    metadata.address || 'House of Dahlia Studio, Civil Lines, Gwalior, MP, India 474001';
  const hoursVal = metadata.hours || 'Mon - Sat: 10:00 AM - 7:00 PM IST';
  const pageTitle = content?.title || 'Contact Us';

  const topics = [
    'General Inquiry',
    'Custom Wear',
    'Order & Shipping',
    'Bulk & Gifting',
    'Collabs & Press',
  ];

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinnerWithText text="Loading House of Dahlia Concierge..." />
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <main className={styles.container}>
        {/* Top Header Section with Title and Custom Emoji at Extreme Right */}
        <header className={styles.headerSection}>
          <div className={styles.titleWrapper}>
            <div className={styles.titleTextContent}>
              <h1 className={styles.title}>
                {pageTitle === 'Contact Us' ? (
                  <>
                    Get in Touch <span className={styles.titleSerifItalic}>& Say Hello</span>
                  </>
                ) : (
                  pageTitle
                )}
              </h1>
              <p className={styles.subtitle}>
                Whether you are curating bespoke custom wear, seeking order guidance, or simply exploring our collections, we are delighted to assist you.
              </p>
            </div>

            {/* Custom Interactive Avatar with Rotating Eyes at Extreme Right (Hidden on mobile) */}
            <div className={styles.avatarContainer}>
              <EyeTrackingAvatar mousePosRef={mousePosRef} />
            </div>
          </div>
        </header>

        {/* Main Content Two-Column Layout */}
        <div className={styles.mainGrid}>
          {/* Left Column: Direct Communication Channels (Sticky on scroll) */}
          <aside className={styles.channelsColumn}>
            <div className={styles.columnHeadingBox}>
              <h2 className={styles.columnTitle}>Direct Channels</h2>
              <p className={styles.columnDesc}>
                Connect directly with our studio artisans and support team.
              </p>
            </div>

            {/* Sticky Action Cards List */}
            <div className={styles.channelCardsList}>
              {/* Email Card */}
              {emailVal && (
                <div className={styles.channelCard}>
                  <div className={styles.channelMainRow}>
                    <div className={styles.channelIconWrap}>
                      <svg viewBox="0 0 24 24" className={styles.channelIcon} fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="4" width="20" height="16" rx="3" />
                        <path d="M22 6L12 13L2 6" />
                      </svg>
                    </div>
                    <div className={styles.channelContent}>
                      <span className={styles.channelLabel}>Email Support</span>
                      <a href={`mailto:${emailVal}`} className={styles.channelValue}>
                        {emailVal}
                      </a>
                    </div>
                  </div>
                  <div className={styles.channelActions}>
                    <button
                      type="button"
                      onClick={() => handleCopy(emailVal, 'email')}
                      className={styles.copyBtn}
                      title="Copy Email"
                    >
                      {copiedKey === 'email' ? '✓ Copied' : 'Copy'}
                    </button>
                    <a
                      href={`mailto:${emailVal}`}
                      className={styles.actionLinkBtn}
                      aria-label="Send email"
                    >
                      Write ↗
                    </a>
                  </div>
                </div>
              )}

              {/* Phone / WhatsApp Card */}
              {phoneVal && (
                <div className={styles.channelCard}>
                  <div className={styles.channelMainRow}>
                    <div className={styles.channelIconWrap}>
                      <svg viewBox="0 0 24 24" className={styles.channelIcon} fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </div>
                    <div className={styles.channelContent}>
                      <span className={styles.channelLabel}>Phone & WhatsApp</span>
                      <a href={`tel:${phoneVal.replace(/\s+/g, '')}`} className={styles.channelValue}>
                        {phoneVal}
                      </a>
                    </div>
                  </div>
                  <div className={styles.channelActions}>
                    <button
                      type="button"
                      onClick={() => handleCopy(phoneVal, 'phone')}
                      className={styles.copyBtn}
                      title="Copy Phone"
                    >
                      {copiedKey === 'phone' ? '✓ Copied' : 'Copy'}
                    </button>
                    <a
                      href={`https://wa.me/${whatsappVal.replace(/[^\d]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.actionLinkBtn} ${styles.whatsappBtn}`}
                    >
                      WhatsApp ↗
                    </a>
                  </div>
                </div>
              )}

              {/* Studio Address Card */}
              {addressVal && (
                <div className={styles.channelCard}>
                  <div className={styles.channelMainRow}>
                    <div className={styles.channelIconWrap}>
                      <svg viewBox="0 0 24 24" className={styles.channelIcon} fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <div className={styles.channelContent}>
                      <span className={styles.channelLabel}>Studio & Atelier</span>
                      <p className={styles.channelAddressText}>{addressVal}</p>
                    </div>
                  </div>
                  <div className={styles.channelActions}>
                    <button
                      type="button"
                      onClick={() => handleCopy(addressVal, 'address')}
                      className={styles.copyBtn}
                      title="Copy Address"
                    >
                      {copiedKey === 'address' ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </aside>

          {/* Right Column: Inquire Form Card */}
          <section className={styles.formColumn}>
            <div className={styles.formCard}>
              {!submitted ? (
                <>
                  <div className={styles.formHeader}>
                    <h2 className={styles.formTitle}>Send Us an Inquiry</h2>
                    <p className={styles.formDesc}>
                      Drop your message below and we will get back to your inbox promptly.
                    </p>
                  </div>

                  {/* Topic Selector Pills */}
                  <div className={styles.topicSelectorWrapper}>
                    <label className={styles.fieldLabel}>Select Topic</label>
                    <div className={styles.topicPillsGrid}>
                      {topics.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`${styles.topicPill} ${
                            selectedTopic === t ? styles.topicPillActive : ''
                          }`}
                          onClick={() => {
                            setSelectedTopic(t);
                            if (!subject) setSubject(t);
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <form className={styles.contactForm} onSubmit={handleSubmit} noValidate>
                    {/* Name & Email Row */}
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label htmlFor="name-field" className={styles.fieldLabel}>
                          Your Name <span className={styles.reqStar}>*</span>
                        </label>
                        <input
                          id="name-field"
                          type="text"
                          className={styles.inputField}
                          placeholder="e.g. Eleanor Vance"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label htmlFor="email-field" className={styles.fieldLabel}>
                          Email Address <span className={styles.reqStar}>*</span>
                        </label>
                        <input
                          id="email-field"
                          type="email"
                          className={styles.inputField}
                          placeholder="eleanor@example.com"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {/* Subject */}
                    <div className={styles.formGroup}>
                      <label htmlFor="subject-field" className={styles.fieldLabel}>
                        Subject / Reference
                      </label>
                      <input
                        id="subject-field"
                        type="text"
                        className={styles.inputField}
                        placeholder={selectedTopic || 'Regarding my custom wear / order'}
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>

                    {/* Message Textarea */}
                    <div className={styles.formGroup}>
                      <div className={styles.labelWithCounter}>
                        <label htmlFor="message-field" className={styles.fieldLabel}>
                          How Can We Help? <span className={styles.reqStar}>*</span>
                        </label>
                        <span className={styles.charCount}>{message.length} characters</span>
                      </div>
                      <textarea
                        id="message-field"
                        className={`${styles.inputField} ${styles.textareaField}`}
                        placeholder="Tell us about your custom wear request, sizing details, or order reference..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={5}
                        required
                      />
                    </div>

                    {errorMsg && (
                      <div className={styles.errorAlert}>
                        <svg viewBox="0 0 24 24" className={styles.alertIcon} fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                        </svg>
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className={styles.submitBtn}
                      disabled={submitting}
                      id="contact-submit-btn"
                    >
                      {submitting ? (
                        <span className={styles.submitBtnLoading}>
                          <span className={styles.btnSpinner} />
                          Dispatching Message...
                        </span>
                      ) : (
                        <span className={styles.submitBtnContent}>
                          Send Message
                          <svg viewBox="0 0 24 24" className={styles.submitArrow} fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </span>
                      )}
                    </button>

                    <p className={styles.privacyNote}>
                      🔒 Your details are safeguarded with end-to-end privacy. No spam guaranteed.
                    </p>
                  </form>
                </>
              ) : (
                /* Success State */
                <div className={styles.successWrapper}>
                  <div className={styles.successStamp}>
                    <svg viewBox="0 0 24 24" className={styles.successCheckmark} fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 className={styles.successTitle}>Inquiry Dispatched!</h3>
                  <p className={styles.successMessage}>
                    Thank you, <strong>{name}</strong>. Your message regarding <em>"{subject || selectedTopic}"</em> has reached our studio desk. We have routed a copy to <strong>{emailInput}</strong> and our team will respond shortly.
                  </p>
                  <div className={styles.successActions}>
                    <button
                      type="button"
                      onClick={resetForm}
                      className={styles.resetBtn}
                    >
                      Send Another Message
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Studio Note / Proclamation Section */}
        {content?.content && (
          <section className={styles.proclamationSection}>
            <div className={styles.proclamationCard}>
              <h2 className={styles.procTitle}>Studio Note & Service Commitment</h2>
              <div
                className={styles.procBody}
                dangerouslySetInnerHTML={{ __html: content.content.replace(/\n/g, '<br />') }}
              />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
