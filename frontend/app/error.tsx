'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
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
      <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>
        Something went wrong
      </h2>
      <p style={{ marginBottom: '1.5rem', color: '#666' }}>
        We hit an error. You can try again.
      </p>
      <button
        onClick={reset}
        style={{
          padding: '0.5rem 1.25rem',
          fontSize: '1rem',
          background: '#1a1a1a',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
