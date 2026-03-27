# How to Add Notifications for Calling and Missed Calls in FishCall

## Executive Summary

FishCall currently lacks notification support for incoming calls and missed call tracking. To implement this feature, you need to: (1) request notification permissions from users, (2) handle the `incoming-call` WebSocket message type that the server already sends, (3) display browser notifications when calls arrive, (4) track missed calls when users don't accept within a timeout period, and (5) optionally add a Service Worker for background notifications when the app isn't in focus. The server already has the infrastructure (`call-peer` and `incoming-call` messages) but the client doesn't handle these events yet[^1].

## Prerequisites

Before implementing notifications, ensure:

- The app is served over HTTPS (required for Notifications API on mobile)[^2]
- The manifest.json is properly configured (already done)[^3]
- Users understand they'll be prompted for notification permissions
- The WebSocket connection remains active to receive incoming call events

## Implementation Steps

### Step 1: Add Notification Permission Request

Add a notification permission request function that users can trigger. This should be called in response to a user gesture (e.g., clicking a button on the home screen).

**Where to implement:** `/Users/akumar/Documents/experimental/aislopvcfish/client/src/App.jsx` or create a new utility file `/Users/akumar/Documents/experimental/aislopvcfish/client/src/lib/notifications.js`

```javascript
// lib/notifications.js
export async function requestNotificationPermission() {
  // Check if notifications are supported
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return 'unsupported';
  }

  // Check current permission status
  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  // Request permission
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
}

export function checkNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}
```

**Add a button to Home.jsx:**

```javascript
// pages/Home.jsx - add after line 99
<button 
  className="btn btn-ghost" 
  onClick={async () => {
    const permission = await requestNotificationPermission();
    if (permission === 'granted') {
      showToast('Notifications enabled');
    } else if (permission === 'denied') {
      showToast('Notifications blocked. Enable in browser settings.');
    }
  }}
>
  Enable Notifications
</button>
```

### Step 2: Handle Incoming Call Messages

The server already sends `incoming-call` messages when someone calls a peer[^1], but the client doesn't handle them. Add this handler to the WebSocket message switch statement.

**Location:** `/Users/akumar/Documents/experimental/aislopvcfish/client/src/App.jsx:229-281`

Add this case to the `handleWSMessage` function after line 275:

```javascript
case "incoming-call": {
  // Show notification for incoming call
  const callerName = msg.from?.nickname || 'Someone';
  const callerUuid = msg.from?.uuid;
  const roomId = msg.roomId;
  
  // Show notification
  showIncomingCallNotification(callerName, roomId, callerUuid);
  
  // Show in-app UI for accepting/declining
  setIncomingCall({
    roomId,
    from: { name: callerName, uuid: callerUuid }
  });
  setScreen('incoming-call');
  break;
}

case "peer-offline": {
  showToast('User is offline');
  break;
}

case "call-declined": {
  showToast('Call declined');
  setScreen('home');
  break;
}
```

### Step 3: Create Notification Display Function

Create a function to display browser notifications for incoming calls.

**Add to `/Users/akumar/Documents/experimental/aislopvcfish/client/src/lib/notifications.js`:**

```javascript
export function showIncomingCallNotification(callerName, roomId, callerUuid) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }

  const notification = new Notification('Incoming Call', {
    body: `${callerName} is calling...`,
    icon: '/manifest.json', // Use the fish emoji icon
    tag: `call-${roomId}`, // Prevents duplicate notifications
    requireInteraction: true, // Keep notification visible until user acts
    data: {
      roomId,
      callerUuid,
      callerName,
      timestamp: Date.now()
    },
    actions: [
      { action: 'accept', title: 'Accept' },
      { action: 'decline', title: 'Decline' }
    ]
  });

  // Play a sound (optional - you'd need to add an audio file)
  // const audio = new Audio('/notification-sound.mp3');
  // audio.play().catch(e => console.log('Could not play sound:', e));

  return notification;
}

export function closeNotification(roomId) {
  // Notifications are automatically closed when clicked
  // But you can track and manually close if needed
}
```

### Step 4: Create Incoming Call Screen

Create a new page component to show when receiving an incoming call.

**Create new file:** `/Users/akumar/Documents/experimental/aislopvcfish/client/src/pages/IncomingCall.jsx`

```javascript
import { useEffect, useState } from 'react';

export default function IncomingCall({ from, roomId, onAccept, onDecline }) {
  const [elapsed, setElapsed] = useState(0);
  const TIMEOUT = 30; // 30 seconds to answer

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(prev => {
        if (prev >= TIMEOUT) {
          onDecline(); // Auto-decline after timeout
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onDecline]);

  return (
    <div className="page">
      <div className="stack stack--32 center max-400">
        {/* Caller info */}
        <div className="stack stack--16 center">
          <div className="contact-avatar" style={{ fontSize: 64, width: 120, height: 120 }}>
            {from.name.charAt(0).toUpperCase()}
          </div>
          <div className="stack stack--4 center">
            <h1 className="t-title1">{from.name}</h1>
            <p className="t-body t-secondary">Incoming call...</p>
          </div>
        </div>

        {/* Timer */}
        <div className="t-subhead t-tertiary">
          {TIMEOUT - elapsed}s remaining
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 24, width: '100%' }}>
          <button 
            className="btn btn-secondary" 
            onClick={onDecline}
            style={{ flex: 1, background: 'var(--red)', color: 'white' }}
          >
            Decline
          </button>
          <button 
            className="btn btn-primary" 
            onClick={onAccept}
            style={{ flex: 1 }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 5: Wire Up Incoming Call Handlers in App.jsx

Update the App component to handle incoming call state and actions.

**Add state in `/Users/akumar/Documents/experimental/aislopvcfish/client/src/App.jsx`:**

```javascript
// Add after line 38
const [incomingCall, setIncomingCall] = useState(null); // { roomId, from: { name, uuid } }
```

**Add handlers:**

```javascript
// Add after line 391
const acceptIncomingCall = useCallback(() => {
  if (!incomingCall) return;
  
  const ws = connectWS();
  const send = () => ws.send(JSON.stringify({ 
    type: 'accept-call', 
    roomId: incomingCall.roomId 
  }));
  
  if (ws.readyState === 1) send();
  else ws.addEventListener('open', send, { once: true });
  
  // Navigate to preview to configure devices before joining
  setPendingAction({ type: 'accept-call', roomId: incomingCall.roomId });
  setScreen('preview');
  setIncomingCall(null);
}, [incomingCall, connectWS]);

const declineIncomingCall = useCallback(() => {
  if (!incomingCall) return;
  
  const ws = connectWS();
  const send = () => ws.send(JSON.stringify({ 
    type: 'decline-call', 
    roomId: incomingCall.roomId 
  }));
  
  if (ws.readyState === 1) send();
  else ws.addEventListener('open', send, { once: true });
  
  // Track as missed call
  trackMissedCall(incomingCall.from);
  
  setIncomingCall(null);
  setScreen('home');
}, [incomingCall, connectWS]);
```

**Add to render section (after line 528):**

```javascript
{screen === 'incoming-call' && incomingCall && (
  <IncomingCall
    from={incomingCall.from}
    roomId={incomingCall.roomId}
    onAccept={acceptIncomingCall}
    onDecline={declineIncomingCall}
  />
)}
```

**Import the new component at the top:**

```javascript
import IncomingCall from "./pages/IncomingCall.jsx";
import { showIncomingCallNotification, requestNotificationPermission } from "./lib/notifications.js";
```

### Step 6: Track Missed Calls

Add missed call tracking to the contacts system.

**Update `/Users/akumar/Documents/experimental/aislopvcfish/client/src/lib/contacts.js`:**

```javascript
// Add after line 105
/**
 * Track a missed call
 * @param {Object} from - Caller info { uuid, name }
 */
export function trackMissedCall(from) {
  if (!from?.id && !from?.uuid) return;
  
  try {
    const missedKey = 'fishcall_missed_calls';
    const data = localStorage.getItem(missedKey);
    const missed = data ? JSON.parse(data) : [];
    
    const callerId = from.id || from.uuid;
    const existing = missed.find(m => m.id === callerId);
    
    if (existing) {
      existing.count = (existing.count || 1) + 1;
      existing.lastMissed = Date.now();
    } else {
      missed.unshift({
        id: callerId,
        name: from.name || `User-${callerId.slice(0, 4)}`,
        count: 1,
        lastMissed: Date.now()
      });
    }
    
    // Keep only last 20 missed calls
    const trimmed = missed.slice(0, 20);
    localStorage.setItem(missedKey, JSON.stringify(trimmed));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get missed calls
 */
export function getMissedCalls() {
  try {
    const data = localStorage.getItem('fishcall_missed_calls');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Clear a specific missed call or all
 */
export function clearMissedCall(id) {
  try {
    if (!id) {
      localStorage.removeItem('fishcall_missed_calls');
      return;
    }
    
    const missed = getMissedCalls().filter(m => m.id !== id);
    localStorage.setItem('fishcall_missed_calls', JSON.stringify(missed));
  } catch {
    // Ignore
  }
}
```

**Display missed calls on Home screen:**

Update `/Users/akumar/Documents/experimental/aislopvcfish/client/src/pages/Home.jsx`:

```javascript
// Add to imports
import { getMissedCalls, clearMissedCall } from '../lib/contacts.js'

// Add state
const [missedCalls, setMissedCalls] = useState([])

// Update useEffect
useEffect(() => {
  setContacts(getContacts())
  setMissedCalls(getMissedCalls())
}, [])

// Add before contacts section (around line 44)
{missedCalls.length > 0 && (
  <div className="stack stack--12 w-full">
    <div className="contacts-header">
      <span className="t-subhead t-secondary" style={{ color: 'var(--red)' }}>
        Missed Calls ({missedCalls.length})
      </span>
      <button 
        className="btn btn-ghost" 
        style={{ padding: '4px 8px', fontSize: 13 }}
        onClick={() => {
          clearMissedCall();
          setMissedCalls([]);
        }}
      >
        Clear All
      </button>
    </div>
    
    <div className="contacts-list">
      {missedCalls.slice(0, 3).map(missed => (
        <div 
          key={missed.id} 
          className="contact-item"
          onClick={() => {
            onCallContact({ id: missed.id, name: missed.name });
            clearMissedCall(missed.id);
            setMissedCalls(getMissedCalls());
          }}
        >
          <div className="contact-avatar" style={{ background: 'var(--red)' }}>
            {missed.name.charAt(0).toUpperCase()}
          </div>
          <div className="contact-info">
            <span className="contact-name">{missed.name}</span>
            <span className="contact-meta" style={{ color: 'var(--red)' }}>
              {missed.count} missed · {formatRelativeTime(missed.lastMissed)}
            </span>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

### Step 7: Add Service Worker for Background Notifications (Optional)

For notifications when the app is not active, implement a Service Worker. This is more complex but provides better UX.

**Create `/Users/akumar/Documents/experimental/aislopvcfish/client/public/sw.js`:**

```javascript
// Service Worker for FishCall notifications
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(clients.claim());
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data;
  
  if (action === 'accept') {
    // Open the app and accept the call
    event.waitUntil(
      clients.openWindow(`/?accept=${data.roomId}`)
    );
  } else if (action === 'decline') {
    // Just close - could send decline message if connection exists
    console.log('Call declined from notification');
  } else {
    // Default click - open app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle push messages (if you implement push server)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    
    if (data.type === 'incoming-call') {
      const options = {
        body: `${data.from.nickname} is calling...`,
        icon: '/icon-192.png',
        badge: '/badge-96.png',
        tag: `call-${data.roomId}`,
        requireInteraction: true,
        data: data,
        actions: [
          { action: 'accept', title: 'Accept' },
          { action: 'decline', title: 'Decline' }
        ]
      };
      
      event.waitUntil(
        self.registration.showNotification('Incoming Call', options)
      );
    }
  } catch (error) {
    console.error('Error handling push:', error);
  }
});
```

**Register Service Worker in `/Users/akumar/Documents/experimental/aislopvcfish/client/src/main.jsx`:**

```javascript
// Add after line 5
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        console.log('SW registered:', registration);
      })
      .catch(error => {
        console.log('SW registration failed:', error);
      });
  });
}
```

**Update Vite config to copy sw.js:**

Edit `/Users/akumar/Documents/experimental/aislopvcfish/client/vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html',
      }
    }
  },
  publicDir: 'public', // This ensures sw.js gets copied
})
```

### Step 8: Handle Call Acceptance from URL

If the user clicks "Accept" from a notification, handle the URL parameter.

**Update UUID init effect in App.jsx around line 72:**

```javascript
useEffect(() => {
  let uuid = localStorage.getItem("fishcall_uuid");
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem("fishcall_uuid", uuid);
  }
  uuidRef.current = uuid;

  // Check for URL parameters
  const params = new URLSearchParams(window.location.search);
  const joinCode = params.get("join");
  const acceptRoomId = params.get("accept");
  
  if (acceptRoomId) {
    // Clear URL param
    window.history.replaceState({}, "", window.location.pathname);
    // Accept the call
    setPendingAction({ type: 'accept-call', roomId: acceptRoomId });
    setScreen("preview");
  } else if (joinCode) {
    // Clear URL param
    window.history.replaceState({}, "", window.location.pathname);
    // Go to preview with pending join action
    setPendingAction({ type: "join", code: joinCode.toUpperCase() });
    setScreen("preview");
  }
}, []);
```

### Step 9: Update Preview Screen Handler

Update `handlePreviewReady` to handle accept-call actions:

```javascript
// In App.jsx around line 400
const handlePreviewReady = useCallback(
  (stream, settings) => {
    // Use the stream from preview
    localStreamRef.current = stream;
    setAudioEnabled(settings.audioEnabled);
    setVideoEnabled(settings.videoEnabled);

    // Execute the pending action
    if (pendingAction === "create") {
      createRoom();
    } else if (pendingAction?.type === "join") {
      joinRoom(pendingAction.code);
    } else if (pendingAction?.type === "accept-call") {
      // Accept the incoming call
      const ws = connectWS();
      const send = () => ws.send(JSON.stringify({ 
        type: 'accept-call', 
        roomId: pendingAction.roomId 
      }));
      if (ws.readyState === 1) send();
      else ws.addEventListener('open', send, { once: true });
    }
    setPendingAction(null);
  },
  [pendingAction, createRoom, joinRoom, connectWS],
);
```

### Step 10: Add CSS for Notification Elements

Add styles for the incoming call screen and missed calls indicator:

**Add to `/Users/akumar/Documents/experimental/aislopvcfish/client/src/index.css`:**

```css
/* Incoming call screen styles */
.contact-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--blue);
  color: white;
  font-size: 20px;
  font-weight: 600;
  flex-shrink: 0;
}

/* Missed call indicator */
.missed-indicator {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--red);
  border: 2px solid var(--background);
}
```

## Testing the Implementation

1. **Test notification permissions:**
   - Open the app and click "Enable Notifications"
   - Verify the browser prompts for permission
   - Check that permission state is saved

2. **Test incoming calls:**
   - Open two browser windows/devices
   - Ensure both are connected (register UUID)
   - From one device, call the other using `call-peer` message
   - Verify notification appears on receiving device
   - Verify in-app incoming call screen shows

3. **Test accept/decline:**
   - Accept a call and verify it connects
   - Decline a call and verify it's tracked as missed
   - Check that declined calls appear in missed calls list

4. **Test missed calls:**
   - Let an incoming call timeout (30 seconds)
   - Verify it appears in missed calls on home screen
   - Click a missed call entry and verify it initiates a new call
   - Clear missed calls and verify list empties

5. **Test notifications when app is background:**
   - Minimize or switch tabs
   - Receive an incoming call
   - Verify notification appears in system tray
   - Click notification and verify app opens

6. **Test Service Worker (if implemented):**
   - Close the app completely
   - Have someone call you
   - Verify push notification arrives (requires push server setup)
   - Click action buttons in notification

## Additional Considerations

### Call Status Tracking

Consider adding more detailed call history beyond just missed calls:

```javascript
// In contacts.js
export function trackCallHistory(peerId, peerName, type, duration = 0) {
  // type: 'incoming', 'outgoing', 'missed'
  // Store in localStorage with timestamp
  const historyKey = 'fishcall_call_history';
  const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
  
  history.unshift({
    peerId,
    peerName,
    type,
    duration,
    timestamp: Date.now()
  });
  
  // Keep last 100 calls
  localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 100)));
}
```

### Notification Sound

Add a ringtone for incoming calls:

1. Add an audio file to `/Users/akumar/Documents/experimental/aislopvcfish/client/public/ringtone.mp3`
2. Play it when receiving a call:

```javascript
let ringtoneAudio = null;

export function playRingtone() {
  if (!ringtoneAudio) {
    ringtoneAudio = new Audio('/ringtone.mp3');
    ringtoneAudio.loop = true;
  }
  ringtoneAudio.play().catch(e => console.log('Cannot play ringtone:', e));
}

export function stopRingtone() {
  if (ringtoneAudio) {
    ringtoneAudio.pause();
    ringtoneAudio.currentTime = 0;
  }
}
```

Call these in the incoming call handlers.

### Vibration API

For mobile devices, add vibration:

```javascript
if ('vibrate' in navigator) {
  // Vibrate pattern: vibrate 200ms, pause 100ms, repeat
  navigator.vibrate([200, 100, 200, 100, 200]);
}
```

### Do Not Disturb

Allow users to temporarily disable notifications:

```javascript
export function setDoNotDisturb(enabled) {
  localStorage.setItem('fishcall_dnd', enabled ? 'true' : 'false');
}

export function isDoNotDisturb() {
  return localStorage.getItem('fishcall_dnd') === 'true';
}

// Check before showing notifications
if (!isDoNotDisturb()) {
  showIncomingCallNotification(callerName, roomId);
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         User's Device                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Browser / PWA                         │    │
│  │                                                     │    │
│  │  ┌──────────────┐         ┌──────────────────┐   │    │
│  │  │  App.jsx     │◀────────│ WebSocket Client │   │    │
│  │  │              │         └────────▲──────────┘   │    │
│  │  │ - incoming-  │                  │               │    │
│  │  │   call state │                  │               │    │
│  │  │ - handlers   │         incoming-call            │    │
│  │  └──────┬───────┘         message                  │    │
│  │         │                                           │    │
│  │         ▼                                           │    │
│  │  ┌──────────────┐         ┌──────────────────┐   │    │
│  │  │ Incoming     │         │ notifications.js │   │    │
│  │  │ Call Screen  │◀────────│                  │   │    │
│  │  │              │         │ - showNotif()    │   │    │
│  │  └──────────────┘         │ - requestPerm()  │   │    │
│  │         │                 └──────────────────┘   │    │
│  │         │                                           │    │
│  │    accept/decline                                   │    │
│  │         │                                           │    │
│  │         ▼                                           │    │
│  │  ┌──────────────┐         ┌──────────────────┐   │    │
│  │  │ contacts.js  │         │ Service Worker   │   │    │
│  │  │              │         │                  │   │    │
│  │  │ - trackMissed│         │ - background     │   │    │
│  │  │ - getMissed  │         │   notifications  │   │    │
│  │  └──────────────┘         └──────────────────┘   │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘   │
│                           ▲                                 │
│                           │                                 │
│              Notification.requestPermission()               │
│              new Notification()                             │
│              registration.showNotification()                │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐  │
│  │         Operating System Notification Center        │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
                    WebSocket Messages
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Signaling Server                         │
│                      (server.js)                             │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  WebSocket Message Handlers                        │    │
│  │                                                     │    │
│  │  case "call-peer":                                 │    │
│  │    - Create room                                   │    │
│  │    - Send "incoming-call" to target peer           │    │
│  │                                                     │    │
│  │  case "accept-call":                               │    │
│  │    - Join guest to room                            │    │
│  │    - Send "peer-joined" to host                    │    │
│  │                                                     │    │
│  │  case "decline-call":                              │    │
│  │    - Send "call-declined" to host                  │    │
│  │    - Delete room                                   │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Call Flow Diagram

```
Caller Device              Signaling Server           Callee Device
     │                           │                          │
     │  call-peer                │                          │
     │──────────────────────────>│                          │
     │                           │                          │
     │  room-created             │                          │
     │<──────────────────────────│                          │
     │                           │                          │
     │                           │  incoming-call           │
     │                           │─────────────────────────>│
     │                           │                          │
     │                           │                    ┌─────┴─────┐
     │                           │                    │ Show      │
     │                           │                    │ Notif &   │
     │                           │                    │ UI        │
     │                           │                    └─────┬─────┘
     │                           │                          │
     │                           │                   User clicks
     │                           │                    Accept/Decline
     │                           │                          │
     │                           │  accept-call             │
     │                           │<─────────────────────────│
     │                           │                          │
     │  peer-joined              │  room-joined             │
     │<──────────────────────────│─────────────────────────>│
     │                           │                          │
     │                    WebRTC negotiation                │
     │<─────────────────────────────────────────────────────>│
     │                           │                          │
     │                     Media flows P2P                  │
     │<═════════════════════════════════════════════════════>│
     │                           │                          │

Alternative: User Declines or Timeout
     │                           │                          │
     │                           │  decline-call            │
     │                           │<─────────────────────────│
     │                           │                          │
     │  call-declined            │                    ┌─────┴─────┐
     │<──────────────────────────│                    │ Track as  │
     │                           │                    │ Missed    │
     │                           │                    └───────────┘
     │                           │                          │
```

## Confidence Assessment

**High Confidence:**
- Web Notifications API implementation pattern (documented standard)[^4]
- Server infrastructure already supports call signaling[^1]
- Manifest.json is properly configured for PWA[^3]
- LocalStorage-based tracking matches existing contacts pattern[^5]

**Medium Confidence:**
- Service Worker implementation complexity - requires additional testing on different browsers
- Notification UX patterns may need refinement based on user feedback
- Background notification reliability varies by OS/browser

**Low Confidence:**
- Push notification server infrastructure (not implemented, would require additional backend work)
- Exact notification sound/vibration patterns for best UX
- Cross-platform notification appearance consistency

**Assumptions Made:**
- Users will grant notification permissions when prompted
- The app will remain connected via WebSocket to receive incoming calls
- Missed calls after 30 seconds is an acceptable timeout
- Simple localStorage tracking is sufficient (no server-side call history needed)

## Footnotes

[^1]: `/Users/akumar/Documents/experimental/aislopvcfish/server.js:116-133` - Server already implements `call-peer` message type that sends `incoming-call` to target peer with roomId and caller info (uuid, nickname)

[^2]: `/Users/akumar/Documents/experimental/aislopvcfish/client/index.html:12-14` - App includes PWA meta tags (apple-mobile-web-app-capable, theme-color) but requires HTTPS for getUserMedia and Notifications API on mobile

[^3]: `/Users/akumar/Documents/experimental/aislopvcfish/client/public/manifest.json:1-22` - Manifest includes name, icons, display mode (standalone), and theme colors required for PWA installation

[^4]: [MDN Web Docs - Using the Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API) - Standard browser API for displaying system notifications with permission model

[^5]: `/Users/akumar/Documents/experimental/aislopvcfish/client/src/lib/contacts.js:35-61` - Existing contacts system uses localStorage with JSON serialization for storing contact data (id, name, lastCall, callCount)

[^6]: `/Users/akumar/Documents/experimental/aislopvcfish/client/src/App.jsx:229-281` - WebSocket message handler currently handles room-created, room-joined, peer-joined, signal, peer-left, peer-info, and error messages but not incoming-call

[^7]: [MDN Web Docs - ServiceWorkerRegistration.showNotification()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification) - Service Worker API for showing notifications with action buttons and navigation options

[^8]: `/Users/akumar/Documents/experimental/aislopvcfish/README.md:115-120` - Project already implements client-side contact storage with no server-side persistence, same pattern should apply to missed calls
