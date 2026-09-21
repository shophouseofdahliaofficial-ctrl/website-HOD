import React from 'react';

export default function LoadingSpinner({ fullHeight = false }: { fullHeight?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: fullHeight ? '100vh' : '400px',
      width: '100%',
      color: '#666',
      gap: '10px'
    }}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 50 50"
        style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="#e0e0e0"
          strokeWidth="4"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="#ff0040"
          strokeWidth="4"
          strokeDasharray="90 150"
          strokeLinecap="round"
        />
      </svg>
      <span style={{ fontSize: 'calc(1rem - 3px)', fontWeight: 500, letterSpacing: '-0.5px' }}>Loading...</span>
      <style>{`
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
