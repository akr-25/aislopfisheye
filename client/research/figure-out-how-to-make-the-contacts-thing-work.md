# How to Make the Contacts Feature Work in FishCall

## Executive Summary

The contacts feature in FishCall is **partially implemented** but critically incomplete. While the client displays recent contacts and stores them in localStorage[^1], and the server has full signaling infrastructure for direct peer-to-peer calling[^2], the client **does not implement any UI or message handlers** for initiating, receiving, accepting, or declining direct calls to contacts. The `onCallContact` handler simply creates a new room instead of calling the contact directly[^3]. To make contacts work, you must: (1) send `call-peer` messages when contacts are clicked, (2) create an incoming call UI component, (3) handle `incoming-call`, `peer-offline`, `accept-call`, and `decline-call` message types in the client, and (4) wire the new UI into the App component's state machine.

## Confidence Assessment

**High confidence** on the root cause: The server-side signaling is complete and functional[^2], but client-side integration is missing. I verified this by:
- Examining all client source files for message handlers (none exist for direct calling)
- Comparing server message types to client message handlers
- Tracing the `onCallContact` callback from Home.jsx through App.jsx

**Medium confidence** on implementation approach: The suggested architecture follows the existing pattern (see Preview/Waiting/Connecting screens), but specific UX decisions (notification style, timeout behavior) are design choices that may need refinement.

## Architecture Overview

FishCall is a WebRTC video calling app with client-side contact management. The current architecture has three layers:

```
┌─────────────────────────────────────────────────────────┐
│                    Client (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐   │
│  │  Home    │─▶│ Preview  │─▶│ Waiting/Connecting │   │
│  │ (Lists)  │  │ (Camera) │  │    (Join Room)     │   │
│  └──────────┘  └──────────┘  └────────────────────┘   │
│       │                                                  │
│       │ [MISSING] call-peer message + incoming UI       │
│       ▼                                                  │
│  localStorage: contacts                                  │
└─────────────────────────────────────────────────────────┘
                        │ WebSocket
                        ▼
┌─────────────────────────────────────────────────────────┐
│               Signaling Server (Express + ws)            │
│  ┌──────────────┐  ┌────────────────────────────────┐  │
│  │ Peer Registry│  │  Room Management               │  │
│  │ (uuid → ws)  │  │  • create/join/rejoin-room     │  │
│  │              │  │  • [IMPLEMENTED] call-peer     │  │
│  │              │  │  • [IMPLEMENTED] accept/decline│  │
│  └──────────────┘  └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                        │ Signal relay
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  WebRTC P2P Media                        │
└─────────────────────────────────────────────────────────┘
```

## Current Implementation Status

### ✅ Working Components

1. **Contact Storage** (`client/src/lib/contacts.js`)[^1]
   - Stores contacts in `localStorage` under key `fishcall_contacts`
   - Contact model: `{ id, name, lastCall, callCount }`
   - Sorted by frequency first, then recency
   - Capped at 10 contacts (MAX_CONTACTS)
   - Provides `getContacts()`, `addContact()`, `removeContact()`, `clearContacts()`

2. **Contact Display** (`client/src/pages/Home.jsx`)[^4]
   - Renders contact list with avatars, names, and metadata
   - Shows "Recent" section with "Show All" toggle for >3 contacts
   - Each contact is clickable and calls `onCallContact(contact)`
   - Has remove button (X) to delete individual contacts

3. **Contact Saving** (`client/src/App.jsx`)[^5]
   - Saves peer info when `peer-info` message arrives from server
   - Calls `addContact()` when peer leaves or hangup occurs
   - Stores peer UUID and nickname for future reference

4. **Server Signaling Infrastructure** (`server.js`)[^2]
   - **Peer registry**: Maps UUID to WebSocket connection (line 28: `peers` Map)
   - **`call-peer` handler** (lines 116-134): Creates room, notifies target with `incoming-call`
   - **`accept-call` handler** (lines 136-160): Joins guest to room, exchanges peer info
   - **`decline-call` handler** (lines 162-169): Notifies host of `call-declined`, deletes room
   - **Peer availability check**: Returns `peer-offline` if target not connected

### ❌ Missing Components

1. **Client Message Handlers**
   - No handler for `incoming-call` message type[^6]
   - No handler for `peer-offline` message type
   - No handler for `call-declined` message type
   - These messages are sent by the server but ignored by the client

2. **Incoming Call UI Component**
   - No UI to display incoming call notifications
   - No accept/decline buttons
   - No caller information display
   - No ringtone or notification sound

3. **Direct Call Initiation**
   - `onCallContact` callback currently just creates a new room[^3]
   - Should send `{ type: "call-peer", targetUuid: contact.id }` instead
   - Does not handle `peer-offline` response

4. **State Management**
   - No screen state for incoming call (e.g., `screen === "incoming"`)
   - No storage of incoming call metadata (caller info, room ID)

## Implementation Plan

### Step 1: Create Incoming Call UI Component

Create `client/src/pages/IncomingCall.jsx`:

```jsx
import { useState, useEffect } from 'react'

export default function IncomingCall({ caller, onAccept, onDecline }) {
  const [ringing, setRinging] = useState(true)
  
  useEffect(() => {
    // Optional: Add ringtone audio here
    const timer = setTimeout(() => {
      // Auto-decline after 30 seconds
      onDecline()
    }, 30000)
    return () => clearTimeout(timer)
  }, [onDecline])

  return (
    <div className="page">
      <div className="stack stack--32 center max-400 w-full">
        
        {/* Caller Info */}
        <div className="stack stack--16 center">
          <div className="contact-avatar" style={{ 
            width: 120, 
            height: 120, 
            fontSize: 48,
            backgroundColor: 'var(--blue)' 
          }}>
            {caller.nickname?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="stack stack--4 center">
            <h1 className="t-title1">{caller.nickname || 'Unknown'}</h1>
            <p className="t-body t-secondary">FishCall incoming...</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="stack stack--12 w-full">
          <button 
            className="btn btn-primary" 
            style={{ backgroundColor: 'var(--green)' }}
            onClick={onAccept}
          >
            Accept
          </button>
          <button 
            className="btn btn-secondary" 
            style={{ backgroundColor: 'var(--red)' }}
            onClick={onDecline}
          >
            Decline
          </button>
        </div>

      </div>
    </div>
  )
}
```

### Step 2: Update WebSocket Message Handler

In `client/src/App.jsx`, add new message handlers inside `handleWSMessage` function (after line 276)[^7]:

```jsx
const handleWSMessage = useCallback(
  (msg) => {
    switch (msg.type) {
      // ... existing cases ...
      
      case "incoming-call":
        // Store incoming call info and show UI
        setIncomingCall({
          roomId: msg.roomId,
          from: msg.from
        });
        setScreen("incoming");
        break;
        
      case "peer-offline":
        // Contact is not online
        showToast("Contact is offline");
        setPendingAction(null);
        setScreen("home");
        break;
        
      case "call-declined":
        // Contact declined the call
        showToast("Call declined");
        setPendingAction(null);
        setScreen("home");
        break;
        
      // ... rest of existing cases ...
    }
  },
  [showToast, lastRoomId],
);
```

### Step 3: Add State for Incoming Calls

In `client/src/App.jsx`, add new state variable (around line 39)[^8]:

```jsx
const [incomingCall, setIncomingCall] = useState(null); // { roomId, from: { uuid, nickname } }
```

### Step 4: Implement Direct Call Function

In `client/src/App.jsx`, replace the `onCallContact` handler (lines 521-526)[^3]:

```jsx
onCallContact={(contact) => {
  // Send call-peer message to initiate direct call
  const ws = connectWS();
  const send = () => {
    ws.send(JSON.stringify({ 
      type: "call-peer", 
      targetUuid: contact.id 
    }));
  };
  if (ws.readyState === 1) send();
  else ws.addEventListener("open", send, { once: true });
  
  // Show "calling" state
  setCallStatus(`Calling ${contact.name}...`);
  setScreen("connecting");
}}
```

### Step 5: Implement Accept/Decline Handlers

Add these functions in `client/src/App.jsx` (around line 390)[^9]:

```jsx
const acceptCall = useCallback(() => {
  if (!incomingCall) return;
  const ws = connectWS();
  const send = () => {
    ws.send(JSON.stringify({ 
      type: "accept-call", 
      roomId: incomingCall.roomId 
    }));
  };
  if (ws.readyState === 1) send();
  else ws.addEventListener("open", send, { once: true });
  
  setScreen("connecting");
  setIncomingCall(null);
}, [incomingCall, connectWS]);

const declineCall = useCallback(() => {
  if (!incomingCall) return;
  const ws = wsRef.current;
  if (ws?.readyState === 1) {
    ws.send(JSON.stringify({ 
      type: "decline-call", 
      roomId: incomingCall.roomId 
    }));
  }
  setIncomingCall(null);
  setScreen("home");
}, [incomingCall]);
```

### Step 6: Add IncomingCall Screen to Render

In `client/src/App.jsx`, add import and render (around line 12 and 564)[^10]:

```jsx
// Add import at top
import IncomingCall from "./pages/IncomingCall.jsx";

// Add render in the main return block
{screen === "incoming" && incomingCall && (
  <IncomingCall
    caller={incomingCall.from}
    onAccept={acceptCall}
    onDecline={declineCall}
  />
)}
```

### Step 7: Handle Preview Flow for Direct Calls

Currently, clicking a contact goes through preview screen, but for direct calls you may want to skip preview. Two options:

**Option A: Skip preview (instant call)**
- Modify Step 4 to directly open camera and send call-peer
- Requires refactoring getCamera and setupFisheye to be callable before room join

**Option B: Keep preview (recommended for UX)**
- Modify preview flow to support "Call [Name]" action type
- Change `pendingAction` to include contact info: `{ type: 'call', contact }`
- After preview ready, send `call-peer` instead of `create-room`

Example for Option B (modify lines 521-526)[^3]:

```jsx
onCallContact={(contact) => {
  setPendingAction({ type: 'call', contact });
  setScreen("preview");
}}
```

Then in `handlePreviewReady` (around line 394)[^11]:

```jsx
const handlePreviewReady = useCallback(
  (stream, settings) => {
    localStreamRef.current = stream;
    setAudioEnabled(settings.audioEnabled);
    setVideoEnabled(settings.videoEnabled);

    if (pendingAction === "create") {
      createRoom();
    } else if (pendingAction?.type === "join") {
      joinRoom(pendingAction.code);
    } else if (pendingAction?.type === "call") {
      // New: direct call to contact
      const ws = connectWS();
      const send = () => {
        ws.send(JSON.stringify({ 
          type: "call-peer", 
          targetUuid: pendingAction.contact.id 
        }));
      };
      if (ws.readyState === 1) send();
      else ws.addEventListener("open", send, { once: true });
      setScreen("connecting");
    }
    setPendingAction(null);
  },
  [pendingAction, createRoom, joinRoom, connectWS],
);
```

And update the `actionLabel` prop (around line 535)[^12]:

```jsx
<PreviewScreen
  onReady={handlePreviewReady}
  onCancel={handlePreviewCancel}
  actionLabel={
    pendingAction === "create" 
      ? "Create Room" 
      : pendingAction?.type === "call" 
      ? `Call ${pendingAction.contact.name}` 
      : "Join Room"
  }
/>
```

## Testing Checklist

After implementing the above changes:

1. **Test contact saving**
   - [ ] Complete a call using room code
   - [ ] Verify contact appears in Recent list on Home screen
   - [ ] Check `localStorage` for `fishcall_contacts` entry

2. **Test direct calling (caller side)**
   - [ ] Click a contact from Recent list
   - [ ] Verify preview screen shows "Call [Name]" button
   - [ ] Complete preview and verify `call-peer` message sent
   - [ ] If contact offline, verify "Contact is offline" toast appears

3. **Test incoming calls (receiver side)**
   - [ ] Open app in two browser windows with different profiles
   - [ ] Complete one call to establish contact
   - [ ] From window A, click the contact
   - [ ] Verify window B shows incoming call UI with correct name
   - [ ] Test Accept button → call connects
   - [ ] Test Decline button → caller sees "Call declined" toast

4. **Test edge cases**
   - [ ] Call a contact that's offline (server returns `peer-offline`)
   - [ ] Decline an incoming call (caller should see toast)
   - [ ] Let incoming call timeout (30s auto-decline)
   - [ ] Call the same person multiple times (verify callCount increments)

## Key Files Reference

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `client/src/lib/contacts.js`[^1] | Contact storage utilities | 1-106 (complete file) |
| `client/src/pages/Home.jsx`[^4] | Contact list UI | 65 (click handler), 44-91 (contact rendering) |
| `client/src/App.jsx`[^3] | Main app state machine | 521-526 (broken onCallContact), 229-282 (message handler) |
| `server.js`[^2] | Signaling server | 116-169 (call-peer/accept/decline handlers) |

## Design Considerations

### 1. Peer Discovery
Current implementation requires users to complete at least one room-based call before a contact is saved. There's no user directory or search functionality. This is intentional for privacy (per README line 236)[^13].

### 2. Online Status
The server's `peers` Map only tracks currently connected WebSocket clients. There's no persistent online/offline status or last-seen timestamp. When calling a contact:
- If they're connected: They receive `incoming-call` notification
- If they're offline: Caller immediately receives `peer-offline`

Consider adding a UI indicator (green dot) for contacts currently online, but this requires:
- Server to broadcast online status changes
- Client to maintain a Set of online peer UUIDs
- Periodic heartbeat to keep status fresh

### 3. Call Timeout and Cleanup
The incoming call UI should auto-dismiss after ~30 seconds if not answered. The server doesn't currently implement timeout logic for pending calls (rooms created but not joined), so you may want to add:

```javascript
// In server.js, after creating room for call-peer
const cleanupTimer = setTimeout(() => {
  const room = rooms.get(id);
  if (room && !room.guest) {
    rooms.delete(id);
    if (room.host?.readyState === 1) {
      room.host.send(JSON.stringify({ type: "call-timeout" }));
    }
  }
}, 30000);
```

### 4. Notification Persistence
If the user is on a different screen (e.g., in another call), incoming calls are currently lost. Consider:
- Queueing incoming calls
- Showing a badge/notification
- Auto-declining with a "busy" message

### 5. Contact Name Editing
Users can't currently edit contact names. The name is always taken from the peer's nickname at call time. Consider adding:
- Edit button in contact list
- Display name separate from signaling nickname
- Merge logic for duplicate contacts

## Privacy & Security Notes

Per the README[^13]:
- All contact data is stored client-side in localStorage (line 236-237)
- No server-side contact persistence
- Media transport is P2P after signaling

The direct calling feature maintains this privacy model:
- Server only relays `incoming-call` messages, doesn't log call history
- Peer UUID is the only persistent identifier
- Nicknames can be randomized or user-chosen

## Assumptions Made

1. **UX Flow**: Assumed users want preview screen before direct calls (Option B in Step 7). If instant calling is preferred, implementation differs.

2. **Auto-decline**: Assumed 30-second timeout for incoming calls is acceptable. Can be adjusted in IncomingCall component.

3. **Notification Style**: Designed a full-screen incoming call UI (matches iOS style). Could be a toast/banner instead.

4. **Error Handling**: Assumed simple toast messages for errors (peer offline, call declined). Could be more elaborate modals.

5. **Contact Limit**: Maintained existing 10-contact limit. Could be made configurable or unlimited.

## Footnotes

[^1]: `client/src/lib/contacts.js:1-106` — Complete contact storage implementation with localStorage persistence, sorting logic, and utility functions.

[^2]: `server.js:116-169` — Server-side call-peer, accept-call, and decline-call message handlers. Includes peer registry lookup (line 28) and incoming-call notification dispatch (line 128).

[^3]: `client/src/App.jsx:521-526` — Current broken onCallContact implementation that creates a new room instead of calling the peer directly. Comment on line 522 acknowledges this: "For now, just create a room (contact calling needs more infra)".

[^4]: `client/src/pages/Home.jsx:44-91` — Contact list rendering with Show All toggle, click handlers calling onCallContact (line 65), and remove buttons.

[^5]: `client/src/App.jsx:258-269, 307-310` — Contact saving logic triggered by peer-left and hangup events. Uses peerInfoRef to store peer UUID and nickname from peer-info messages (line 267).

[^6]: Verified via `grep -r "incoming-call" client/src` returning no results — client has zero handlers for incoming-call, peer-offline, or call-declined message types despite server sending them.

[^7]: `client/src/App.jsx:229-282` — handleWSMessage callback containing switch statement for all WebSocket message types. Currently handles room-created, room-joined, peer-joined, signal, peer-left, peer-info, and error, but missing direct call message types.

[^8]: `client/src/App.jsx:29-39` — UI state declarations including screen, roomCode, callStatus, audioEnabled, etc. New incomingCall state should be added here.

[^9]: `client/src/App.jsx:360-391` — Section containing room action functions (createRoom, joinRoom, rejoinRoom). Accept and decline handlers should be added nearby.

[^10]: `client/src/App.jsx:1-14, 510-584` — Import statements and main render block with screen conditionals. New IncomingCall import and render block should be added.

[^11]: `client/src/App.jsx:393-410` — handlePreviewReady callback that executes pending actions after camera preview. Handles create and join, needs to handle call action.

[^12]: `client/src/App.jsx:531-537` — PreviewScreen render with actionLabel prop that displays button text. Currently only handles create vs join, needs to handle call action.

[^13]: `README.md:231-237` — Privacy & Data Handling section documenting P2P media transport, client-side contact storage, and no server-side persistence policy.
