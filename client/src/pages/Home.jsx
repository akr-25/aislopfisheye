import { useState, useEffect } from 'react'
import { getContacts, removeContact, formatRelativeTime } from '../lib/contacts.js'

export default function Home({ onCreateRoom, onJoinRoom, onTest, onCallContact }) {
  const [contacts, setContacts] = useState([])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    setContacts(getContacts())
  }, [])

  const handleRemove = (e, id) => {
    e.stopPropagation()
    removeContact(id)
    setContacts(getContacts())
  }

  const displayContacts = showAll ? contacts : contacts.slice(0, 3)

  return (
    <div className="page">
      <div className="stack stack--32 center max-400 w-full">

        {/* Brand */}
        <div className="stack stack--8 center">
          <span style={{ fontSize: 56, lineHeight: 1 }}>🐟</span>
          <h1 className="t-largeTitle">FishCall</h1>
          <p className="t-body t-secondary">Video calls with a fisheye twist.</p>
        </div>

        {/* Actions */}
        <div className="stack stack--12 w-full">
          <button className="btn btn-primary" onClick={onCreateRoom}>
            New Room
          </button>

          <div className="separator">or</div>

          <button className="btn btn-secondary" onClick={onJoinRoom}>
            Join a Room
          </button>
        </div>

        {/* Frequent Contacts */}
        {contacts.length > 0 && (
          <div className="stack stack--16 w-full">
            <div className="contacts-header">
              <span className="t-subhead t-secondary">Recent</span>
              {contacts.length > 3 && (
                <button 
                  className="btn btn-ghost" 
                  style={{ padding: '4px 8px', fontSize: 13 }}
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Show Less' : `Show All (${contacts.length})`}
                </button>
              )}
            </div>
            
            <div className="contacts-list">
              {displayContacts.map(contact => (
                <div 
                  key={contact.id} 
                  className="contact-item"
                  onClick={() => onCallContact(contact)}
                >
                  <div className="contact-avatar">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="contact-info">
                    <span className="contact-name">{contact.name}</span>
                    <span className="contact-meta">
                      {formatRelativeTime(contact.lastCall)}
                      {contact.callCount > 1 && ` · ${contact.callCount} calls`}
                    </span>
                  </div>
                  <button 
                    className="contact-remove"
                    onClick={(e) => handleRemove(e, contact.id)}
                    aria-label="Remove contact"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" 
                         stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test button */}
        <button className="btn btn-ghost" onClick={onTest}>
          Test Camera & Mic
        </button>

      </div>
    </div>
  )
}
