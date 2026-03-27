import { useState } from 'react'
import { CopyIcon, CheckIcon } from '../components/Icons.jsx'

export default function WaitingRoom({ roomCode, onCancel }) {
  const [copiedType, setCopiedType] = useState(null) // 'code' | 'url' | null

  const getRoomUrl = () => {
    const base = window.location.origin
    return `${base}?join=${roomCode}`
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopiedType('code')
      setTimeout(() => setCopiedType(null), 2000)
    }).catch(() => {})
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(getRoomUrl()).then(() => {
      setCopiedType('url')
      setTimeout(() => setCopiedType(null), 2000)
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
            Share this with your friend
          </p>
        </div>

        {/* Code badge */}
        <div className="room-code-badge">
          <div className="room-code-text">{roomCode}</div>
        </div>

        {/* Copy buttons */}
        <div className="share-options">
          <button className="share-btn" onClick={handleCopyCode}>
            {copiedType === 'code' ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
            <span>{copiedType === 'code' ? 'Copied!' : 'Copy Code'}</span>
          </button>
          
          <div className="share-divider" />
          
          <button className="share-btn" onClick={handleCopyUrl}>
            {copiedType === 'url' ? <CheckIcon size={18} /> : <LinkIcon size={18} />}
            <span>{copiedType === 'url' ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>

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

function LinkIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" 
         stroke="currentColor" strokeWidth="1.75" 
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}
