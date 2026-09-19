'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="not-found-container">
      {/* Dynamic Background Glow Blobs */}
      <div className="glow-blob glow-blob-1"></div>
      <div className="glow-blob glow-blob-2"></div>
      
      <div className="not-found-card">
        {/* Animated Polaroid Frame */}
        <div className="polaroid-container">
          <div className="polaroid-card">
            <div className="polaroid-image-area">
              <svg 
                className="broken-camera-icon"
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
                <line x1="1" y1="1" x2="23" y2="23" stroke="#ff0040" strokeWidth="2" />
              </svg>
            </div>
            <div className="polaroid-caption">
              Lost Moment
            </div>
          </div>
        </div>

        {/* Text Section */}
        <h1 className="error-code">404</h1>
        <h2 className="error-title">Frame Out of Bounds</h2>
        <p className="error-message">
          This page didn&apos;t print correctly. It may have been moved, exposed to too much light, or never existed in the first place.
        </p>

        {/* Action Buttons */}
        <div className="action-buttons">
          <Link href="/" className="primary-btn">
            Go back home
          </Link>
          <button 
            type="button" 
            onClick={() => router.back()} 
            className="secondary-btn"
          >
            Go back
          </button>
        </div>
      </div>

      <style>{`
        .not-found-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 85vh;
          padding: 1rem;
          background: #f2f1f6;
          overflow: hidden;
          font-family: var(--font-inter), sans-serif;
        }

        /* Ambient Glow Blobs */
        .glow-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.55;
          z-index: 1;
          pointer-events: none;
        }

        .glow-blob-1 {
          top: 15%;
          left: 20%;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(255,0,64,0.12) 0%, rgba(255,255,255,0) 70%);
        }

        .glow-blob-2 {
          bottom: 15%;
          right: 20%;
          width: 350px;
          height: 350px;
          background: radial-gradient(circle, rgba(11,156,107,0.08) 0%, rgba(255,255,255,0) 70%);
        }

        /* Neumorphic Glassmorphic Card */
        .not-found-card {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 460px;
          width: 100%;
          padding: 4rem 2.5rem 2.5rem 2.5rem;
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 28px;
          box-shadow: 
            0 30px 60px rgba(0, 0, 0, 0.04), 
            0 1px 3px rgba(0, 0, 0, 0.02),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
          text-align: center;
        }

        /* Polaroid Float Animation & Hover Tilt */
        .polaroid-container {
          margin-bottom: 2.5rem;
          perspective: 1000px;
          animation: floatAnimation 5s ease-in-out infinite;
        }

        .polaroid-card {
          width: 170px;
          background: #ffffff;
          padding: 12px 12px 22px 12px;
          border-radius: 6px;
          box-shadow: 
            0 15px 35px rgba(0,0,0,0.07),
            0 3px 10px rgba(0,0,0,0.03);
          transform: rotate(-6deg);
          transition: transform 0.45s cubic-bezier(0.165, 0.84, 0.44, 1), box-shadow 0.45s ease;
          user-select: none;
        }

        .polaroid-card:hover {
          transform: translateY(-8px) rotate(4deg) scale(1.06);
          box-shadow: 
            0 25px 45px rgba(0,0,0,0.12),
            0 5px 15px rgba(0,0,0,0.05);
        }

        .polaroid-image-area {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 140px;
          background: #f5f4f8;
          border-radius: 3px;
          color: #a0a0ab;
        }

        .broken-camera-icon {
          width: 42px;
          height: 42px;
        }

        .polaroid-caption {
          margin-top: 12px;
          font-family: var(--font-instrument-serif), Georgia, serif;
          font-style: italic;
          font-size: 1.25rem;
          color: #888893;
          letter-spacing: -0.2px;
        }

        /* Typography */
        .error-code {
          font-family: var(--font-instrument-serif), Georgia, serif;
          font-style: italic;
          font-size: 5.5rem;
          line-height: 1;
          color: #1a1a1e;
          margin: 0 0 0.5rem 0;
          font-weight: 400;
          letter-spacing: -1.5px;
        }

        .error-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1a1a1e;
          margin-bottom: 0.75rem;
          letter-spacing: -0.5px;
        }

        .error-message {
          font-size: 0.92rem;
          line-height: 1.55;
          color: #62626e;
          margin-bottom: 2.25rem;
          padding: 0 1rem;
        }

        /* Buttons & Actions */
        .action-buttons {
          display: flex;
          gap: 0.75rem;
          width: 100%;
        }

        .primary-btn {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.85rem 1.5rem;
          background: #1a1a1e;
          color: #ffffff;
          border-radius: 14px;
          font-size: 0.95rem;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.25s, transform 0.25s, box-shadow 0.25s;
          box-shadow: 0 4px 12px rgba(26, 26, 30, 0.08);
        }

        .primary-btn:hover {
          background: #000000;
          box-shadow: 0 8px 20px rgba(26, 26, 30, 0.16);
        }

        .primary-btn:active {
          background: #000000;
        }

        .secondary-btn {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.85rem 1.5rem;
          background: transparent;
          color: #4c4c56;
          border: 1px solid #d2d2db;
          border-radius: 14px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.25s, border-color 0.25s, transform 0.25s;
        }

        .secondary-btn:hover {
          background: rgba(0, 0, 0, 0.02);
          border-color: #a0a0ab;
        }

        .secondary-btn:active {
          background: rgba(0, 0, 0, 0.05);
        }

        /* Animations */
        @keyframes floatAnimation {
          0% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
          100% {
            transform: translateY(0px);
          }
        }

        /* Responsive adjustments */
        @media (max-width: 480px) {
          .not-found-card {
            padding: 3rem 1.75rem 2.5rem 1.75rem;
          }
          
          .error-code {
            font-size: 4.5rem;
          }
          
          .action-buttons {
            flex-direction: column;
            gap: 0.65rem;
          }
          
          .primary-btn, .secondary-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
