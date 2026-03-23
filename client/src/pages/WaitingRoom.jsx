import { useState } from 'react'

export default function WaitingRoom({ roomCode, onCancel }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="page">
      {/* Back */}
      <div className="nav-bar">
        <button className="nav-back btn" onClick={onCancel}>
          <svg width="10" height="17" viewBox="0 0 10 17" fill="none" aria-hidden>
            <path d="M9 1L1.5 8.5L9 16" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Cancel
        </button>
      </div>

      <div className="stack stack--32 center max-400">

        {/* Heading */}
        <div className="stack stack--8 center">
          <h1 className="t-title1">Room Created</h1>
          <p className="t-body t-secondary">
            Share this code with your friend
          </p>
        </div>

        {/* Code badge */}
        <div className="room-code-badge">
          <div className="room-code-text">{roomCode}</div>
          <p className="room-code-hint">Tap the code to copy</p>
        </div>

        {/* Copy button */}
        <button className="copy-btn btn" onClick={handleCopy}>
          {copied ? (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M2 8L6.5 12.5L14 4" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <rect x="5.5" y="5.5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10.5 5.5V3.5A1.5 1.5 0 0 0 9 2H3.5A1.5 1.5 0 0 0 2 3.5V9A1.5 1.5 0 0 0 3.5 10.5H5.5"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Copy Code
            </>
          )}
        </button>

        {/* Waiting indicator */}
        <div className="stack stack--12 center">
          <div className="waiting-indicator">
            <div className="waiting-dot" />
            <div className="waiting-dot" />
            <div className="waiting-dot" />
          </div>
          <p className="t-subhead t-secondary">Waiting for someone to join…</p>
        </div>

      </div>
    </div>
  )
}
