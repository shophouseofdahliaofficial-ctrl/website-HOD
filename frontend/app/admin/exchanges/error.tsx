'use client';

import { useEffect } from 'react';

export default function AdminExchangesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin Exchanges error:', error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', color: '#0f172a' }}>
        Unable to load exchanges
      </h2>
      <p style={{ marginBottom: '1.5rem', color: '#64748b' }}>
        An unexpected error occurred while rendering the exchange requests.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          padding: '0.6rem 1.4rem',
          fontSize: '0.95rem',
          fontWeight: 600,
          background: '#00835d',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  );
}
