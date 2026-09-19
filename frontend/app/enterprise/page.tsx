'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './page.module.css';



interface InquiryForm {
  name: string;
  email: string;
  company: string;
  phone: string;
  message: string;
}

const Cube = ({ index, row, col }: { index: number; row: number; col: number }) => {
  const baseColors = [
    '#ffd3e0', // Soft Pink
    '#ffe5cc', // Soft Orange
    '#ffccd3', // Soft Red
    '#e4dbff', // Soft Violet
    '#dbeafe', // Soft Blue
    '#cffafe', // Soft Cyan
    '#ccfbf1', // Soft Teal
    '#fef3c7'  // Soft Yellow
  ];
  const vibrantColors = ['#ff0055', '#ff5e00', '#ff0000', '#bd00ff', '#00ff66', '#00f0ff', '#d4ff00'];
  
  const baseColor = baseColors[(row + col) % baseColors.length];
  const [currentColor, setCurrentColor] = useState(baseColor);
  const [isHovered, setIsHovered] = useState(false);
  const [delay] = useState(() => Math.random() * 1.8 + 0.2);

  // Synchronize currentColor with baseColor when baseColor changes (e.g. on viewport resize)
  useEffect(() => {
    if (!isHovered) {
      setCurrentColor(baseColor);
    }
  }, [baseColor, isHovered]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    const randomVibrant = vibrantColors[Math.floor(Math.random() * vibrantColors.length)];
    setCurrentColor(randomVibrant);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCurrentColor(baseColor);
  };

  return (
    <motion.div
      className={styles.cube}
      initial={{ opacity: 0 }}
      animate={{ 
        opacity: isHovered ? 1.0 : 0.0, 
      }}
      transition={
        isHovered
          ? { duration: 0 } // Instant transform/color change on hover
          : { 
              default: { duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: delay },
              backgroundColor: { duration: 1.8, ease: 'easeOut' }
            }
      }
      style={{
        backgroundColor: currentColor,
        pointerEvents: 'auto',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    />
  );
};

export default function EnterprisePage() {
  const [cols, setCols] = useState(16);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 600) {
        setCols(8);
      } else if (window.innerWidth <= 900) {
        setCols(12);
      } else {
        setCols(16);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [form, setForm] = useState<InquiryForm>({
    name: '',
    email: '',
    company: '',
    phone: '',
    message: '',
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('https://formsubmit.co/ajax/contact@myscribble.in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (response.ok && (data.success === 'true' || data.success === true)) {
        setSubmitted(true);
      } else {
        throw new Error(data.message || 'Failed to submit inquiry.');
      }
    } catch (err: any) {
      console.error('Failed to submit enterprise inquiry:', err);
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleReset = () => {
    setForm({
      name: '',
      email: '',
      company: '',
      phone: '',
      message: '',
    });
    setError(null);
    setSubmitted(false);
  };




  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.titleWrapper}>
            {/* Background interactive cubes grid */}
            <div className={styles.cubesGrid}>
              {Array.from({ length: 96 }).map((_, index) => {
                const row = Math.floor(index / cols);
                const col = index % cols;
                return (
                  <Cube key={index} index={index} row={row} col={col} />
                );
              })}
            </div>
            {/* Top horizontal line: draws left to right */}
            <motion.div
              className={`${styles.gridLine} ${styles.lineTop}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 3.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              style={{ position: 'absolute', transformOrigin: 'left' }}
            />

            {/* Bottom horizontal line: draws right to left */}
            <motion.div
              className={`${styles.gridLine} ${styles.lineBottom}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 3.5, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
              style={{ position: 'absolute', transformOrigin: 'right' }}
            />

            {/* Left vertical line: draws top to bottom */}
            <motion.div
              className={`${styles.gridLine} ${styles.lineLeft}`}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 3.5, ease: [0.22, 1, 0.36, 1], delay: 0.6 }}
              style={{ position: 'absolute', left: 0, right: 'auto', transformOrigin: 'top' }}
            />

            {/* Right vertical line: draws bottom to top */}
            <motion.div
              className={`${styles.gridLine} ${styles.lineRight}`}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 3.5, ease: [0.22, 1, 0.36, 1], delay: 0.8 }}
              style={{ position: 'absolute', right: 0, left: 'auto', transformOrigin: 'bottom' }}
            />

            <motion.h1
              className={styles.heroTitle}
              initial={{ opacity: 0, y: -25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 2.0, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
            >
              Build, create, and grow with <em>Scribble</em>.
            </motion.h1>
          </div>

          <motion.p
            className={styles.heroDescription}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 2.0, ease: [0.22, 1, 0.36, 1], delay: 0.8 }}
          >
            Empower your brand, delight your team, or integrate our dynamic creative engine into your own platform.
          </motion.p>
        </div>
      </section>

      {/* Bento Features Grid */}
      <section className={styles.grid}>
        {/* Card 1: Corporate */}
        <div className={`${styles.card} ${styles.cardCustomization}`}>
          <div className={styles.cardHeader}>
            <h3 className={styles.bentoTitle}>Corporate</h3>
            <p className={styles.bentoDescription}>
              Custom workspace kits, onboarding gifts, and branded stationery that elevate your company culture.
            </p>
          </div>
          <div className={styles.corporateImageWrapper}>
            <img src="/corporate.png" alt="Corporate" className={styles.corporateImg} />
          </div>
        </div>

        {/* Card 2: Wellness Retreats, Therapists & Psychologists */}
        <div className={`${styles.card} ${styles.cardScheduling}`}>
          <div className={styles.bentoTextLeft}>
            <h3 className={styles.bentoTitle}>Wellness Retreats, Therapists & Psychologists</h3>
            <p className={styles.bentoDescription}>
              Guided mindfulness journals, gratitude diaries, and reflection cards that support emotional well-being.
            </p>
          </div>
          <div className={styles.wellnessImageWrapper}>
            <img src="/brain.png" alt="Wellness" className={styles.wellnessImg} />
          </div>
        </div>

        {/* Card 3: Schools & Universities */}
        <div className={`${styles.card} ${styles.cardWallet}`}>
          <div className={styles.studyImageWrapper}>
            <img src="/study.png" alt="Schools & Universities" className={styles.studyImg} />
          </div>
          <div className={styles.cardHeader}>
            <h3 className={styles.bentoTitle}>Schools & Universities</h3>
            <p className={styles.bentoDescription}>
              Interactive academic planners, custom journals, and graduation souvenirs designed to inspire students.
            </p>
          </div>
        </div>

        {/* Card 4: NGOs */}
        <div className={`${styles.card} ${styles.cardInbox}`}>
          <div className={styles.cardHeader}>
            <h3 className={styles.bentoTitle}>NGOs</h3>
            <p className={styles.bentoDescription}>
              Charity event cards, donor appreciation notebooks, and impact journals that amplify your mission.
            </p>
          </div>
          <div className={styles.careImageWrapper}>
            <img src="/care.png" alt="NGO Care" className={styles.careImg} />
          </div>
        </div>

        {/* Card 5: Event Organizers (Wedding, Hotels & Resorts) */}
        <div className={`${styles.card} ${styles.cardSendGifts}`}>
          <div className={styles.eventsImageWrapper}>
            <img src="/events.png" alt="Events" className={styles.eventsImg} />
          </div>
          <div className={styles.bentoTextLeft}>
            <h3 className={styles.bentoTitle}>Event Organizers (Wedding, Hotels & Resorts)</h3>
            <p className={styles.bentoDescription}>
              Premium guest registries, custom wedding invitations, and luxury resort stationery that make moments memorable.
            </p>
          </div>
        </div>

        {/* Card 6: Startups */}
        <div className={`${styles.card} ${styles.cardReminders}`}>
          <div className={styles.cardHeader}>
            <h3 className={styles.bentoTitle}>Startups</h3>
            <p className={styles.bentoDescription}>
              Agile planners, customized team merchandise, and dynamic SDK integrations for fast-growing companies.
            </p>
          </div>
          <div className={styles.startupImageWrapper}>
            <img src="/startup.png" alt="Startups" className={styles.startupImg} />
          </div>
        </div>
      </section>

      {/* Inquiry Form Section */}
      <section className={styles.formSection}>
        <AnimatePresence>
          {!submitted && (
            <motion.div
              key="sidebar"
              className={styles.formSidebar}
              exit={{
                width: 0,
                paddingLeft: 0,
                paddingRight: 0,
                paddingTop: 0,
                paddingBottom: 0,
                opacity: 0,
                x: '-100%',
              }}
              transition={{ duration: 1.2, ease: [0.25, 1, 0.5, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className={styles.sidebarInner}>
                <div>
                  <h2 className={styles.sidebarTitle}>
                    Let's create <em>together</em>.
                  </h2>
                  <p className={styles.sidebarText}>
                    Tell us about your project or integration goals, and our partnerships team will reach out with tailor-made solutions.
                  </p>
                </div>
                <div className={styles.contactDetails}>
                  <div className={styles.contactDetailItem}>
                    <span className={styles.detailIcon}>✉️</span>
                    <a href="mailto:contact@myscribble.in" className={styles.detailText}>contact@myscribble.in</a>
                  </div>
                  <div className={styles.contactDetailItem}>
                    <span className={styles.detailIcon}>🏢</span>
                    <span className={styles.detailText}>Scribble Studios, Inc.</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div layout className={styles.formContainer}>
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleSubmit}
              >
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="name" className={styles.label}>Full Name</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={form.name}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="email" className={styles.label}>Work Email</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={form.email}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="jane@company.com"
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="company" className={styles.label}>Company Name</label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      required
                      value={form.company}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="phone" className={styles.label}>Phone Number</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      required
                      value={form.phone}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="+91 XXXXX XXXXX"
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="message" className={styles.label}>Area of Interest</label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    value={form.message}
                    onChange={handleInputChange}
                    className={styles.textarea}
                    placeholder="Describe your design concepts, timelines, or integration requirements..."
                  />
                </div>

                {error && (
                  <div className={styles.errorMsg}>
                    ⚠️ {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={styles.submitBtn}
                >
                  {loading ? 'Submitting...' : 'Submit Inquiry'}
                </button>
              </motion.form>

            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={styles.successContainer}
              >
                <div className={styles.successIcon}>
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className={styles.successTitle}>Thank You!</h3>
                <p className={styles.successText}>
                  Your enterprise inquiry has been successfully received. A Scribble partnership representative will get back to you within 24 business hours.
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className={styles.resetBtn}
                >
                  Submit Another Inquiry
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>
    </div>
  );
}
