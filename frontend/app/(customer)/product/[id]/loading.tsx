export default function ProductPageLoading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'var(--font-inter), sans-serif',
        color: '#666',
        fontSize: 'calc(1.05rem - 3px)',
        fontWeight: 500,
        letterSpacing: '-0.5px',
        backgroundColor: '#F2F1F6',
        gap: '10px',
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
          width: '22px',
          height: '22px',
          color: '#ff0040',
          marginBottom: '0px',
          flexShrink: 0
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
      <span>Loading product…</span>
    </div>
  );
}
