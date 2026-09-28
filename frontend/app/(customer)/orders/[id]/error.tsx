'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function OrderDetailsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Order details error:', error);
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
        Unable to load order details
      </h2>
      <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
        We encountered a problem loading this order. You can try refreshing or go back to your orders.
      </p>
      <div style={{ display: 'flex', gap: '1rem' }}>
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
        <Link
          href="/orders"
          style={{
            padding: '0.6rem 1.4rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            background: '#f3f4f6',
            color: '#111827',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            textDecoration: 'none',
          }}
        >
          Back to Orders
        </Link>
      </div>
    </div>
  );
}
