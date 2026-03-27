import { useState, useEffect } from 'react'
import { CallEndedIcon } from '../components/Icons.jsx'

export default function CallEnded({ onHome, onRejoin, canRejoin, roomId }) {
  const [timeLeft, setTimeLeft] = useState(30)

  useEffect(() => {
    if (!canRejoin) return
    
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer)
          return 0
        }
        return t - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [canRejoin])

  return (
    <div className="page">
      <div className="stack stack--32 center max-400">

        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'var(--surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--label-secondary)',
        }}>
          <CallEndedIcon size={36} />
        </div>

        <div className="stack stack--8 center">
          <h1 className="t-title1">Call Ended</h1>
          <p className="t-body t-secondary">The other person left the call.</p>
        </div>

        <div className="stack stack--12 w-full">
          {canRejoin && timeLeft > 0 && (
            <button className="btn btn-primary" onClick={() => onRejoin(roomId)}>
              Rejoin Room
              <span className="rejoin-timer">({timeLeft}s)</span>
            </button>
          )}
          
          <button 
            className={canRejoin && timeLeft > 0 ? "btn btn-secondary" : "btn btn-primary"} 
            onClick={onHome}
          >
            Back to Home
          </button>
        </div>

      </div>
    </div>
  )
}
