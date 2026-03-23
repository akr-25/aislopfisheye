import { useState, useEffect, useRef } from 'react'

export default function Toast({ message }) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [displayMsg, setDisplayMsg] = useState('')
  const exitTimerRef = useRef(null)
  const hideTimerRef = useRef(null)

  useEffect(() => {
    if (message) {
      // Cancel any in-progress exit
      clearTimeout(exitTimerRef.current)
      clearTimeout(hideTimerRef.current)
      setExiting(false)
      setDisplayMsg(message)
      setVisible(true)
    } else if (visible) {
      // Trigger exit animation, then fully unmount
      setExiting(true)
      hideTimerRef.current = setTimeout(() => {
        setVisible(false)
        setExiting(false)
      }, 220)
    }

    return () => {
      clearTimeout(exitTimerRef.current)
      clearTimeout(hideTimerRef.current)
    }
  }, [message]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null

  return (
    <div className={`toast${exiting ? ' toast--exit' : ''}`} role="status" aria-live="polite">
      {displayMsg}
    </div>
  )
}
