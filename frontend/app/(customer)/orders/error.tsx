'use client';

import { useEffect } from 'react';

export default function OrdersListError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Orders list error:', error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h2 style={{ marginBottom: '1rem', fontSize: '1.4rem', color: '#111827' }}>
        Unable to load orders
      </h2>
      <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
        We encountered a problem loading your orders list.
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
        Try Again
      </button>
    </div>
  );
}
