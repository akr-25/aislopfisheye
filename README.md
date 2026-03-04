# 🐟 FishCall

Peer-to-peer video calling with a fisheye filter twist. Works on phones and desktops.

## Two Modes

### Serverless Mode
No server required. Share a link containing the signaling data via any messaging app. The website itself needs zero backend — just static hosting (or even `file://`).

### Quick Connect (Server Mode)
Uses a minimal WebSocket signaling server for room codes, call invites, and speed-dial of recent peers (stored in browser `localStorage`).

## Getting Started

```bash
npm install
npm start        # starts on http://localhost:3000
```

For **serverless-only** use, serve the `public/` folder with any static host.

## Tech Stack
- **WebRTC** – peer-to-peer video/audio
- **WebGL** – real-time fisheye barrel-distortion shader
- **Express + ws** – minimal signaling server (server mode only)
