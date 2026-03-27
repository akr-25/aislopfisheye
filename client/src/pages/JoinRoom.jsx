import { useState } from 'react'

export default function JoinRoom({ onJoin, onCancel }) {
  const [code, setCode] = useState('')

  const handleChange = (e) => {
    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
  }

  const handleJoin = () => {
    if (code.length < 6) return
    onJoin(code)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleJoin()
  }

  return (
    <div className="page page--top page--keyboard-safe">
      {/* Back */}
      <div className="nav-bar">
        <button className="nav-back btn" onClick={onCancel}>
          <svg width="10" height="17" viewBox="0 0 10 17" fill="none" aria-hidden>
            <path d="M9 1L1.5 8.5L9 16" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
      </div>

      <div className="stack stack--32 center max-400" style={{ marginTop: '15vh' }}>

        {/* Heading */}
        <div className="stack stack--8 center">
          <h1 className="t-title1">Join a Room</h1>
          <p className="t-body t-secondary">Enter the 6-character room code</p>
        </div>

        {/* Input + action */}
        <div className="stack stack--12 w-full">
          <input
            className="input-field input-field--code"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="______"
            maxLength={6}
            value={code}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            autoFocus
          />

          <button
            className="btn btn-primary"
            onClick={handleJoin}
            disabled={code.length < 6}
          >
            Join
          </button>
        </div>

      </div>
    </div>
  )
}
