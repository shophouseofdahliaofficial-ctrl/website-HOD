'use client';

import { useEffect, useState, useRef } from 'react';
import { contentApi, SiteContent } from '@/lib/api';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import styles from './page.module.css';

/**
 * Modern Clean Contact Page featuring an Interactive 3D Canvas Globe
 */
export default function ContactPage() {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Globe Canvas States & Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ x: 0.4, y: 0.8 }); // Sphere rotation X & Y
  const lastActiveRef = useRef(Date.now()); // Tracks user interaction for auto-spin delay
  const [coordsLabel, setCoordsLabel] = useState('LAT: 0.00° / LON: 0.00°');

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

  // 3D Globe Rendering Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    // Generate Globe Dot Matrix (points evenly distributed)
    const points: { lat: number; lon: number }[] = [];
    for (let lat = -80; lat <= 80; lat += 10) {
      const rad = (lat * Math.PI) / 180;
      // Circumference at latitude determines the amount of horizontal dots
      const count = Math.round(28 * Math.cos(rad));
      for (let i = 0; i < count; i++) {
        const lon = (i * 360) / count;
        points.push({ lat, lon });
      }
    }

    // Generate wireframe rings (latitude parallels & longitude meridians)
    const rings: { lat?: number; lon?: number }[] = [];
    // Equator & Parallels
    for (let lat = -60; lat <= 60; lat += 30) {
      rings.push({ lat });
    }
    // Meridians
    for (let lon = 0; lon < 180; lon += 30) {
      rings.push({ lon });
    }

    const draw = () => {
      // Clear canvas with transparent base
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = Math.min(cx, cy) * 0.82;

      const rotX = rotationRef.current.x;
      const rotY = rotationRef.current.y;

      // Draw subtle pearl sphere background gradient (soft 3D translucent depth)
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      const grad = ctx.createRadialGradient(cx - radius / 3, cy - radius / 3, radius * 0.1, cx, cy, radius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.7, '#fafafa');
      grad.addColorStop(1, '#f0f0f0');
      ctx.fillStyle = grad;
      ctx.fill();

      // Shadow stroke
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Helper function to project 3D point (lat, lon) to 2D screen (x, y) with depth z
      const project = (lat: number, lon: number) => {
        const theta = (lat * Math.PI) / 180;
        const phi = (lon * Math.PI) / 180;

        // Base 3D coordinates on sphere
        let x = radius * Math.cos(theta) * Math.sin(phi);
        let y = radius * Math.sin(theta);
        let z = radius * Math.cos(theta) * Math.cos(phi);

        // Rotate around X-axis (Pitch)
        const y1 = y * Math.cos(rotX) - z * Math.sin(rotX);
        const z1 = y * Math.sin(rotX) + z * Math.cos(rotX);
        y = y1;
        z = z1;

        // Rotate around Y-axis (Yaw)
        const x2 = x * Math.cos(rotY) + z * Math.sin(rotY);
        const z2 = -x * Math.sin(rotY) + z * Math.cos(rotY);
        x = x2;
        z = z2;

        return {
          screenX: cx + x,
          screenY: cy - y,
          depth: z, // z > 0 is in front, z < 0 is in back
        };
      };

      // Draw wireframe rings (parallels & meridians)
      rings.forEach((ring) => {
        ctx.beginPath();
        const steps = 60;
        let isFirst = true;

        for (let i = 0; i <= steps; i++) {
          let latVal = 0;
          let lonVal = 0;

          if (ring.lat !== undefined) {
            latVal = ring.lat;
            lonVal = (i * 360) / steps;
          } else if (ring.lon !== undefined) {
            lonVal = ring.lon;
            latVal = -90 + (i * 180) / steps;
          }

          const { screenX, screenY, depth } = project(latVal, lonVal);

          // Only draw segment if in front (translucent wireframe look)
          if (depth > -5) {
            if (isFirst) {
              ctx.moveTo(screenX, screenY);
              isFirst = false;
            } else {
              ctx.lineTo(screenX, screenY);
            }
          } else {
            isFirst = true; // Break line path when clipping behind
          }
        }
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Sort dots by depth so back-side dots are drawn first
      const projectedPoints = points.map((p) => ({
        ...project(p.lat, p.lon),
        lat: p.lat,
        lon: p.lon,
      }));

      // Render dots
      projectedPoints.forEach((pt) => {
        const isFront = pt.depth > 0;
        const opacity = isFront ? 0.8 : 0.12;
        const size = isFront ? 2.5 + (pt.depth / radius) * 1.5 : 1.2;

        ctx.beginPath();
        ctx.arc(pt.screenX, pt.screenY, size, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        ctx.fill();
      });

      // Auto-spin if user has not interacted recently (delay of 1.5s)
      if (!isDraggingRef.current && Date.now() - lastActiveRef.current > 1500) {
        rotationRef.current.y += 0.0018; // auto-spin velocity
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    // Responsive Canvas Resize
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Drag Interactions to Spin the Globe
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
    lastActiveRef.current = Date.now();
  };

  const handleMouseMoveGlobal = (e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;

    prevMouseRef.current = { x: e.clientX, y: e.clientY };
    lastActiveRef.current = Date.now();

    // Adjust angles based on movement direction
    rotationRef.current.y += dx * 0.0055;
    rotationRef.current.x -= dy * 0.0055;

    // Clamp X rotation to prevent flipping upside down
    rotationRef.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, rotationRef.current.x));

    // Update coordinate display mock
    const mockLat = (rotationRef.current.x * (180 / Math.PI)).toFixed(2);
    const mockLon = (((rotationRef.current.y * (180 / Math.PI)) % 360) - 180).toFixed(2);
    setCoordsLabel(`LAT: ${mockLat}° / LON: ${mockLon}°`);
  };

  const handleMouseUpGlobal = () => {
    isDraggingRef.current = false;
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMoveGlobal);
    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => {
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !emailInput || !message) {
      setErrorMsg('All fields are required.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);

    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1200);
  };

  const resetForm = () => {
    setName('');
    setEmailInput('');
    setSubject('');
    setMessage('');
    setSubmitted(false);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '80vh',
        backgroundColor: '#f2f1f6',
        color: '#000000'
      }}>
        <LoadingSpinnerWithText text="Loading coordinates..." />
      </div>
    );
  }

  const metadata = content?.metadata || {};
  const emailVal = metadata.email || 'hello@milko.com';
  const phoneVal = metadata.phone || '+39 06 1234 567';
  const addressVal = metadata.address || 'Via dei Fori Imperiali, 00186 Rome, Italy';
  const pageTitle = content?.title || 'Contact Us';

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        
        {/* Simple Minimal Header */}
        <div className={styles.headerSection}>
          <h1 className={styles.title}>{pageTitle}</h1>
          <p className={styles.subtitle}>
            Connect with us. Drag the globe to rotate or fill out the communication form below.
          </p>
        </div>

        {/* Two-Column Layout: Left Globe, Right Form */}
        <div className={styles.layoutGrid}>
          
          {/* Left Column: 3D interactive Globe */}
          <div 
            className={styles.globeContainer}
            onMouseDown={handleMouseDown}
          >
            <canvas ref={canvasRef} className={styles.globeCanvas} />
            <div className={styles.globeOverlay}>{coordsLabel}</div>
          </div>

          {/* Right Column: Contact Form */}
          <div className={styles.contactCard}>
            {!submitted ? (
              <>
                <h2 className={styles.cardTitle}>Inquire</h2>
                <form className={styles.romanForm} onSubmit={handleSubmit}>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="name-input" className={styles.inputLabel}>Name</label>
                    <input 
                      id="name-input"
                      type="text" 
                      className={styles.stoneInput} 
                      placeholder="Your Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="email-input" className={styles.inputLabel}>Email</label>
                    <input 
                      id="email-input"
                      type="email" 
                      className={styles.stoneInput} 
                      placeholder="your.email@domain.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="subject-input" className={styles.inputLabel}>Subject</label>
                    <input 
                      id="subject-input"
                      type="text" 
                      className={styles.stoneInput} 
                      placeholder="Inquiry Topic"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="message-input" className={styles.inputLabel}>Message</label>
                    <textarea 
                      id="message-input"
                      className={`${styles.stoneInput} ${styles.stoneTextarea}`}
                      placeholder="Write your message here..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                    />
                  </div>

                  {errorMsg && <p className={styles.errorText}>{errorMsg}</p>}

                  <button 
                    type="submit" 
                    className={styles.goldButton}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <div className={styles.coinSpinner} />
                    ) : (
                      'Send Message'
                    )}
                  </button>

                </form>
              </>
            ) : (
              <div className={styles.scrollWrapper}>
                <div className={styles.scrollContainer}>
                  <div className={styles.spqrStamp}>OK</div>
                  <h3 className={styles.scrollTitle}>Message Sent</h3>
                  <p className={styles.scrollBody}>
                    Thank you. Your message has been received. Our coordination agents will contact you shortly.
                  </p>
                  <button onClick={resetForm} className={styles.goldButton}>
                    Send Another Message
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Contact Details Grid */}
        <div className={styles.detailsGrid}>
          
          {emailVal && (
            <div className={styles.detailCard}>
              <div className={styles.detailIcon}>✉</div>
              <div className={styles.detailLabel}>Email</div>
              <a href={`mailto:${emailVal}`} className={styles.detailValue}>
                {emailVal}
              </a>
            </div>
          )}

          {phoneVal && (
            <div className={styles.detailCard}>
              <div className={styles.detailIcon}>📞</div>
              <div className={styles.detailLabel}>Phone</div>
              <a href={`tel:${phoneVal}`} className={styles.detailValue}>
                {phoneVal}
              </a>
            </div>
          )}

          {addressVal && (
            <div className={styles.detailCard}>
              <div className={styles.detailIcon}>📍</div>
              <div className={styles.detailLabel}>Address</div>
              <div className={styles.detailValue}>{addressVal}</div>
            </div>
          )}

        </div>

        {/* Proclamation text */}
        {content?.content && (
          <div className={styles.proclamationCard}>
            <h2 className={styles.procTitle}>Notice</h2>
            <div 
              className={styles.procBody}
              dangerouslySetInnerHTML={{ __html: content.content.replace(/\n/g, '<br />') }}
            />
          </div>
        )}

      </div>
    </div>
  );
}
