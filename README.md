# FishCall

FishCall is a 1:1 WebRTC video-calling app with:
- realtime fisheye video processing (always on, max strength),
- optional helium voice modulation,
- room-code and share-link flows,
- reconnect/rejoin support,
- pre-join preview and device test flow,
- client-side recent contacts.

This project is optimized for fast, playful calls while keeping signaling simple and contact data local to the user’s browser.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Feature Deep Dive](#feature-deep-dive)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [Environment & Deployment](#environment--deployment)
- [Troubleshooting](#troubleshooting)
- [Privacy & Data Handling](#privacy--data-handling)
- [Known Limitations](#known-limitations)

## Architecture Overview

FishCall uses a split architecture:

1. **Client (React + Vite)**  
   Handles UI state, media capture, WebRTC peer connection lifecycle, and effects.

2. **Signaling Server (Express + ws)**  
   Handles identity registration, room creation/join/rejoin, and signaling relay (`offer`, `answer`, `candidate`).

3. **P2P Media Transport (WebRTC)**  
   Once signaling is complete, media flows directly peer-to-peer.

### Media pipeline at a glance

```
Camera + Mic
   │
   ├── Video: hidden <video> → WebGL FisheyeRenderer → <canvas>.captureStream(30)
   │
   └── Audio: raw mic track (or AudioWorklet helium-processed track)
            ↓
      RTCPeerConnection.addTrack / replaceTrack
            ↓
        Remote peer
```

## Feature Deep Dive

## 1) Fisheye video effect (always-on, max)

**Where:** `client/src/lib/fisheye.js`, `client/src/App.jsx`  

- `FisheyeRenderer` initializes a WebGL program with a barrel-distortion shader.
- Distortion strength is fixed in app flow (`setStrength(1.0)`).
- Local camera frames are rendered into canvas in an animation loop.
- Outgoing video track is sourced from `canvas.captureStream(30)`.

Why this approach:
- keeps effect deterministic (no slider variability),
- ensures both local preview and remote party see the processed stream.

## 2) Helium voice modulation

**Where:** `client/src/lib/helium.js`, `client/src/lib/helium-processor.js`

- `HeliumAudio` creates an `AudioContext` + `AudioWorkletNode`.
- Incoming mic stream is processed in the worklet for pitch shift.
- During call, audio sender track is swapped with `RTCRtpSender.replaceTrack`.
- Disabling helium restores original mic track.

Current tuning biases for intelligibility over extreme effect:
- moderate pitch factor,
- smoother grain/crossfade parameters.

## 3) Room lifecycle, reconnect, and rejoin

**Where:** `server.js`, `client/src/App.jsx`, `client/src/pages/CallEnded.jsx`

- Server tracks room participants (`host`, `guest`, plus UUID history).
- On disconnect, room is retained for a grace period (`ROOM_TIMEOUT = 30s`).
- Rejoin is allowed for prior room members via `rejoin-room`.
- Client stores last room ID and exposes rejoin CTA on call-ended screen.

Signaling events include:
- `room-created`, `room-joined`, `room-rejoined`
- `peer-joined`, `peer-rejoined`, `peer-left`
- `signal` relay

## 4) Share code + URL

**Where:** `client/src/pages/WaitingRoom.jsx`

- Waiting view shows two copy actions:
  - room code
  - full deep-link URL (`?join=ROOMID`)
- Users opening shared URL auto-enter preview flow, then join.

## 5) Pre-join preview + test flow

**Where:** `client/src/pages/PreviewScreen.jsx`, `client/src/pages/TestPage.jsx`

- Preview screen opens camera/mic before room entry.
- Video is rendered with fisheye pipeline.
- Mic level meter confirms input activity.
- Toggle controls let user mute video/audio before joining.
- Dedicated test page (`screen === "test"`) validates device/effect setup independent of room lifecycle.

## 6) Recent contacts (client-side only)

**Where:** `client/src/lib/contacts.js`, `client/src/pages/Home.jsx`, `client/src/App.jsx`

- Stored in browser `localStorage` under `fishcall_contacts`.
- Contact record: `{ id, name, lastCall, callCount }`.
- Sorted by frequency first, then recency.
- Capped list size (`MAX_CONTACTS = 10`).
- Contacts are saved on call end using peer identity from signaling (`peer-info`).

No contact data is persisted server-side.

## 7) Mobile install readiness (PWA metadata)

**Where:** `client/index.html`, `client/public/manifest.json`

- Manifest is linked for install metadata.
- Apple web-app meta tags are present.
- Theme/background metadata is included.

Note: install prompt behavior is browser/platform-controlled and may require repeated visits or user interaction.

## Project Structure

```
.
├─ server.js                     # Express + ws signaling server
├─ package.json                  # root scripts (start/build/dev)
├─ client/
│  ├─ index.html                 # app shell + manifest/meta links
│  ├─ public/manifest.json       # PWA metadata
│  └─ src/
│     ├─ App.jsx                 # main app state machine and WebRTC wiring
│     ├─ index.css               # global styles
│     ├─ components/
│     │  ├─ Icons.jsx
│     │  └─ Toast.jsx
│     ├─ lib/
│     │  ├─ fisheye.js
│     │  ├─ helium.js
│     │  ├─ helium-processor.js
│     │  └─ contacts.js
│     └─ pages/
│        ├─ Home.jsx
│        ├─ PreviewScreen.jsx
│        ├─ WaitingRoom.jsx
│        ├─ JoinRoom.jsx
│        ├─ Connecting.jsx
│        ├─ CallScreen.jsx
│        ├─ CallEnded.jsx
│        ├─ TestPage.jsx
│        └─ About.jsx
└─ public/                       # built client output served by server.js
```

## Local Development

### Prerequisites
- Node.js 18+ recommended
- npm

### Install

```bash
npm install
```

### Run (production-style server + built client)

```bash
npm run build
npm start
```

Server default: `http://localhost:3000`  
If certs are present in `certs/`, server runs with HTTPS automatically.

### Run in dev mode (client + server concurrently)

```bash
npm run dev
```

## Environment & Deployment

### Optional environment variable

- `VITE_WS_URL` (client): explicit signaling endpoint override.

If unset:
- dev defaults to `ws://localhost:3000`
- production follows current host with `ws/wss` based on page protocol.

### Deployment model

- Build client via Vite (`client/dist` output copied to top-level `public/` by existing project flow).
- Run `node server.js` for static hosting + signaling.
- For mobile camera/mic reliability, prefer HTTPS.

## Troubleshooting

### Camera/mic unavailable
- Ensure HTTPS (or localhost).
- Check browser permissions and system privacy settings.
- Verify no other app is exclusively using the camera/mic.

### Remote connection fails
- NAT/firewall restrictions may block STUN-only flows.
- Add TURN infrastructure for higher reliability across strict networks.

### No install prompt on mobile
- Prompt timing is browser-managed.
- Ensure manifest is reachable and app is served over HTTPS.
- Engage app with multiple visits/interactions; iOS often requires manual “Add to Home Screen”.

### No recent contacts visible
- Contacts appear after successful calls end.
- Check browser localStorage is not blocked/cleared.
- Verify signaling includes `peer-info` events before call teardown.

## Privacy & Data Handling

- Media transport is peer-to-peer after signaling.
- Signaling server coordinates room/session metadata only.
- Contacts and user UUID are stored locally in browser storage.
- No server-side contact persistence is implemented.

## Known Limitations

- 1:1 calls only (no mesh/SFU multiparty support).
- STUN-only connectivity by default (no TURN fallback bundled).
- PWA install UX differs across browsers and OS versions.
- Background/foreground behavior on mobile is constrained by browser runtime policies.
