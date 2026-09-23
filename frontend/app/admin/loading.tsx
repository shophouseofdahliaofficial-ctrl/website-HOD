export default function AdminLoading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        color: '#666',
        fontSize: '1.05rem',
        fontWeight: 500,
        backgroundColor: '#F2F1F6',
      }}
    >
      <style>{`
        @keyframes loaderSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <svg
        style={{
          animation: 'loaderSpin 0.8s linear infinite',
          width: '26px',
          height: '26px',
          color: '#AB6468',
          marginBottom: '12px'
        }}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          style={{ opacity: 0.15 }}
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span>Loading…</span>
    </div>
  );
}
