export default function Connecting({ onCancel }) {
  return (
    <div className="page">
      <div className="nav-bar">
        <button className="nav-back btn" onClick={onCancel}>
          <svg width="10" height="17" viewBox="0 0 10 17" fill="none" aria-hidden>
            <path d="M9 1L1.5 8.5L9 16" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Cancel
        </button>
      </div>

      <div className="stack stack--24 center max-400">
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.12)',
            borderTopColor: 'var(--blue)',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <div className="stack stack--8 center">
          <h2 className="t-title2">Connecting…</h2>
          <p className="t-body t-secondary">Waiting for the host to pick up</p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
