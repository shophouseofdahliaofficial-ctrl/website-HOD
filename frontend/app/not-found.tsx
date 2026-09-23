'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

const LEFT_NUMBERS = Array.from({ length: 404 - 350 }, (_, i) => 350 + i); // 350 -> 403
const RIGHT_NUMBERS = Array.from({ length: 440 - 404 }, (_, i) => 405 + i); // 405 -> 440

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="not-found-container">
      {/* Number Line 350 -> 440 Centered on 404 */}
      <div className="number-line-container">
        {/* Left Wing (350 ... 403) */}
        <div className="number-line-side number-line-left">
          {LEFT_NUMBERS.map((num) => {
            const dist = 404 - num;
            const opacity = Math.max(0.015, Math.pow(0.60, dist));
            // 20% decrease on each preceding step
            const scale = Math.max(0.12, Number((1 - dist * 0.20).toFixed(2)));

            return (
              <span
                key={num}
                className="number-item"
                style={{
                  opacity,
                  fontSize: `${(scale * 100).toFixed(0)}%`,
                }}
              >
                {num}
              </span>
            );
          })}
        </div>

        {/* Focal Center 404 */}
        <span className="number-item number-item-center">
          404
        </span>

        {/* Right Wing (405 ... 440) */}
        <div className="number-line-side number-line-right">
          {RIGHT_NUMBERS.map((num) => {
            const dist = num - 404;
            const opacity = Math.max(0.015, Math.pow(0.60, dist));
            // 20% decrease on each succeeding step
            const scale = Math.max(0.12, Number((1 - dist * 0.20).toFixed(2)));

            return (
              <span
                key={num}
                className="number-item"
                style={{
                  opacity,
                  fontSize: `${(scale * 100).toFixed(0)}%`,
                }}
              >
                {num}
              </span>
            );
          })}
        </div>
      </div>

      <div className="content-wrapper">
        <h2 className="error-title">Oops! This page went on vacation</h2>
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
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 82vh;
          padding: 4rem 1.5rem 3rem 1.5rem;
          background: #ffffff05;
          overflow: hidden;
          font-family: var(--font-inter), sans-serif;
          text-align: center;
          box-sizing: border-box;
        }

        /* Number Line Ruler Strip */
        .number-line-container {
          width: 100vw;
          margin-left: calc(50% - 50vw);
          margin-right: calc(50% - 50vw);
          font-size: clamp(4.5rem, 11vw, 7.5rem);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          margin-bottom: 2.5rem;
          mask-image: linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%);
          -webkit-mask-image: linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%);
          user-select: none;
        }

        .number-line-side {
          display: flex;
          align-items: center;
          gap: clamp(0.75rem, 1.8vw, 1.6rem);
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }

        .number-line-left {
          justify-content: flex-end;
        }

        .number-line-right {
          justify-content: flex-start;
        }

        .number-item {
          font-family: var(--font-inter), sans-serif;
          font-weight: 700;
          color: #1a1a1e;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          letter-spacing: -0.02em;
          flex-shrink: 0;
          transition: all 0.25s ease;
        }

        .number-item-center {
          font-size: 100%;
          font-weight: 800;
          color: #111111;
          letter-spacing: -0.02em;
          margin: 0 clamp(0.75rem, 1.8vw, 1.6rem);
          flex-shrink: 0;
          line-height: 1;
          display: inline-block;
        }

        .content-wrapper {
          max-width: 500px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          z-index: 2;
        }

        .error-title {
          font-size: 1.65rem;
          font-weight: 700;
          color: #1a1a1e;
          margin: 0 0 0.85rem 0;
          letter-spacing: -0.5px;
        }

        .error-message {
          font-size: 0.98rem;
          line-height: 1.6;
          color: #62626e;
          margin-bottom: 2.25rem;
          padding: 0 0.5rem;
        }

        /* Buttons & Actions */
        .action-buttons {
          display: flex;
          gap: 0.85rem;
          width: 100%;
          max-width: 360px;
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
          font-weight: 500;
          text-decoration: none;
          transition: background 0.25s, transform 0.25s, box-shadow 0.25s;
          box-shadow: 0 4px 12px rgba(26, 26, 30, 0.08);
        }

        .primary-btn:hover {
          background: #000000;
          
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
          font-weight: 500;
          cursor: pointer;
          transition: background 0.25s, border-color 0.25s, transform 0.25s;
        }

        .secondary-btn:hover {
          background: rgba(0, 0, 0, 0.03);
          border-color: #a0a0ab;
          
        }

        .secondary-btn:active {
          background: rgba(0, 0, 0, 0.05);
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .number-line-container {
            font-size: clamp(2.8rem, 10vw, 3.8rem);
            margin-bottom: 2rem;
          }

          .number-line-side {
            gap: 0.75rem;
          }

          .number-item-center {
            margin: 0 0.75rem;
          }
        }

        @media (max-width: 480px) {
          .not-found-container {
            padding: 2.5rem 1rem 2rem 1rem;
            min-height: 75vh;
          }

          .number-line-container {
            font-size: clamp(2rem, 10vw, 2.8rem);
            margin-bottom: 1.75rem;
            mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
            -webkit-mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
          }

          .number-line-side {
            gap: 0.6rem;
          }

          .number-item-center {
            margin: 0 0.6rem;
          }

          .error-title {
            font-size: 1.35rem;
          }

          .error-message {
            font-size: 0.9rem;
            margin-bottom: 1.75rem;
            padding: 0;
          }

          .action-buttons {
            flex-direction: column;
            width: 100%;
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
