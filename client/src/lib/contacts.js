/**
 * contacts.js — Client-side contact storage
 * 
 * Stores recent contacts in localStorage for quick access.
 * No data is sent to the server.
 */

const STORAGE_KEY = 'fishcall_contacts'
const MAX_CONTACTS = 10

/**
 * Get all stored contacts, sorted by most recent
 * @returns {Array<{id: string, name: string, lastCall: number, callCount: number}>}
 */
export function getContacts() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    const contacts = JSON.parse(data)
    // Sort by call count (frequent) then by recency
    return contacts.sort((a, b) => {
      if (b.callCount !== a.callCount) return b.callCount - a.callCount
      return b.lastCall - a.lastCall
    })
  } catch {
    return []
  }
}

/**
 * Add or update a contact after a call
 * @param {string} id - Unique identifier (their UUID)
 * @param {string} name - Display name
 */
export function addContact(id, name) {
  if (!id) return
  
  try {
    const contacts = getContacts()
    const existing = contacts.find(c => c.id === id)
    
    if (existing) {
      existing.name = name || existing.name
      existing.lastCall = Date.now()
      existing.callCount = (existing.callCount || 1) + 1
    } else {
      contacts.unshift({
        id,
        name: name || `User-${id.slice(0, 4)}`,
        lastCall: Date.now(),
        callCount: 1
      })
    }
    
    // Keep only the most recent/frequent contacts
    const trimmed = contacts.slice(0, MAX_CONTACTS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Remove a contact
 * @param {string} id - Contact ID to remove
 */
export function removeContact(id) {
  try {
    const contacts = getContacts().filter(c => c.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear all contacts
 */
export function clearContacts() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

/**
 * Format relative time
 * @param {number} timestamp
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
  const now = Date.now()
  const diff = now - timestamp
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}
