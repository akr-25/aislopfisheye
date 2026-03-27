# Supporting Persistent Video Calling on Mobile: Picture-in-Picture & PWA Installation

## Executive Summary

To achieve WhatsApp-like video calling behavior on mobile web, where the call persists when the browser is minimized or closed, you need to combine **Progressive Web App (PWA) installation** with **Picture-in-Picture (PiP) APIs**. However, there are significant platform limitations: the traditional video PiP API works on iOS Safari but with restrictions, while the Document Picture-in-Picture API (which allows custom UI like video call controls) is only available on desktop Chrome/Edge and not supported on any mobile browser. Your existing FishCall application already has a PWA manifest configured, so you're halfway there. The complete solution requires implementing PiP fallbacks, PWA installation prompts, and managing browser visibility states—but you should set realistic expectations as true "background calling when Chrome is closed" is not currently possible on mobile web platforms due to browser restrictions.

## Architecture Overview

The solution architecture involves three main layers:

```
┌─────────────────────────────────────────────────────┐
│              User Interface Layer                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐│
│  │ Call Screen  │  │ PiP Window   │  │ PWA Home   ││
│  │ (Full View)  │  │ (Minimized)  │  │ Screen Icon││
│  └──────────────┘  └──────────────┘  └────────────┘│
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│            Browser APIs & Features                   │
│  ┌────────────────┐  ┌────────────────────────────┐ │
│  │ Picture-in-    │  │ Page Visibility API        │ │
│  │ Picture API    │  │ (detect tab switching)     │ │
│  └────────────────┘  └────────────────────────────┘ │
│  ┌────────────────┐  ┌────────────────────────────┐ │
│  │ Media Session  │  │ Service Worker             │ │
│  │ API (controls) │  │ (offline, notifications)   │ │
│  └────────────────┘  └────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│         WebRTC & Signaling Layer                     │
│  ┌────────────────┐  ┌────────────────────────────┐ │
│  │ PeerConnection │  │ WebSocket Signaling        │ │
│  │ (video/audio)  │  │ (your server.js)           │ │
│  └────────────────┘  └────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Understanding Browser Limitations

### The Core Problem

When a user closes Chrome on mobile, **all JavaScript execution stops**. Unlike native apps, web apps cannot run in the background to maintain WebRTC connections[^1]. This is a fundamental security and battery-life design decision by mobile browsers.

**What happens when Chrome is closed on mobile:**
- All JavaScript execution terminates immediately
- WebRTC peer connections are closed
- WebSocket connections are severed
- Service Workers cannot maintain active connections
- No notifications can trigger reconnection automatically

**WhatsApp's approach:** WhatsApp uses a native app with background process permissions, allowing it to maintain network connections even when the app is not visible. This is not possible with web technologies on mobile[^2].

[^1]: MDN Web Docs, "Service Worker API," https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
[^2]: Service workers run in background but cannot maintain active real-time connections like WebRTC or WebSocket when the page is closed.

## Solution 1: Picture-in-Picture for Minimized Browser

### Traditional Video Picture-in-Picture API

The standard PiP API works when the browser is **minimized but not closed**. It allows a single `<video>` element to float on top of other apps[^3].

**Browser Support:**
- ✅ Chrome Android (partial - auto-PiP when switching apps)
- ✅ Safari iOS 14+ (fully supported)
- ✅ All desktop browsers (Chrome, Safari, Firefox, Edge)
- ❌ Samsung Internet (not supported)

**Implementation:**

```javascript
// In your CallScreen component or App.jsx
async function enablePictureInPicture(videoElement) {
  try {
    // Check if PiP is supported and enabled
    if (!document.pictureInPictureEnabled) {
      console.log('PiP not supported');
      return;
    }

    // Request PiP for the remote video element
    await videoElement.requestPictureInPicture();
    console.log('Entered Picture-in-Picture mode');

  } catch (error) {
    console.error('Failed to enter PiP:', error);
  }
}

// Listen for visibility changes to auto-trigger PiP
document.addEventListener('visibilitychange', async () => {
  const remoteVideo = document.querySelector('.call-remote-video');
  
  if (document.hidden && remoteVideo && !remoteVideo.paused) {
    // User switched apps/tabs - enter PiP automatically
    try {
      if (!document.pictureInPictureElement) {
        await remoteVideo.requestPictureInPicture();
      }
    } catch (error) {
      console.log('Auto-PiP failed:', error);
    }
  }
});

// Exit PiP when returning to the tab
document.addEventListener('visibilitychange', async () => {
  if (!document.hidden && document.pictureInPictureElement) {
    await document.exitPictureInPicture();
  }
});

// Listen to PiP events
remoteVideoRef.current?.addEventListener('enterpictureinpicture', (event) => {
  console.log('Entered PiP, window:', event.pictureInPictureWindow);
  // Optionally resize or adjust video
});

remoteVideoRef.current?.addEventListener('leavepictureinpicture', () => {
  console.log('Exited PiP');
});
```

**Integration with your FishCall app:**

Add a PiP button to your call controls in `/client/src/pages/CallScreen.jsx`:

```javascript
// Add to CallScreen.jsx
import { PictureInPictureIcon } from "../components/Icons.jsx";

export default function CallScreen({
  // ... existing props
  onTogglePiP, // New prop
}) {
  return (
    <div className={`call-screen${visible ? " call-screen--visible" : ""}`}>
      {/* ... existing video elements ... */}
      
      <div className="call-controls">
        <div className="call-controls-row">
          {/* ... existing controls ... */}
          
          {/* Add PiP button */}
          <button
            className="btn btn-icon"
            onClick={onTogglePiP}
            aria-label="Picture-in-Picture"
            title="Minimize to PiP"
          >
            <PictureInPictureIcon size={24} />
            <span className="btn-label">PiP</span>
          </button>
          
          {/* ... rest of controls ... */}
        </div>
      </div>
    </div>
  );
}
```

Then in your `App.jsx`, add the handler:

```javascript
const togglePictureInPicture = useCallback(async () => {
  const remoteVideo = remoteVideoRef.current;
  
  if (!remoteVideo || !document.pictureInPictureEnabled) {
    showToast('Picture-in-Picture not supported');
    return;
  }

  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await remoteVideo.requestPictureInPicture();
    }
  } catch (error) {
    showToast('Failed to toggle PiP');
    console.error('PiP error:', error);
  }
}, [showToast]);
```

[^3]: MDN Web Docs, "Picture-in-Picture API," https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API

### Document Picture-in-Picture API (Desktop Only)

This newer API allows creating a PiP window with **custom HTML controls** (not just video), perfect for video conferencing with controls for mute, camera, hangup, etc.[^4]

**Browser Support:**
- ✅ Chrome 116+ (desktop only)
- ✅ Edge 116+ (desktop only)
- ✅ Firefox 151+ (desktop only)
- ❌ Safari (not supported)
- ❌ All mobile browsers (not supported)

**Implementation for desktop:**

```javascript
async function openDocumentPiP() {
  if (!('documentPictureInPicture' in window)) {
    console.log('Document PiP not supported');
    return;
  }

  try {
    // Open PiP window with custom size
    const pipWindow = await window.documentPictureInPicture.requestWindow({
      width: 400,
      height: 300,
    });

    // Copy styles from main window
    [...document.styleSheets].forEach((styleSheet) => {
      try {
        const cssRules = [...styleSheet.cssRules]
          .map((rule) => rule.cssText)
          .join('');
        const style = document.createElement('style');
        style.textContent = cssRules;
        pipWindow.document.head.appendChild(style);
      } catch (e) {
        // External stylesheets might have CORS issues
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = styleSheet.type;
        link.media = styleSheet.media;
        link.href = styleSheet.href;
        pipWindow.document.head.appendChild(link);
      }
    });

    // Move your call screen UI to the PiP window
    const callContainer = document.querySelector('.call-screen');
    pipWindow.document.body.append(callContainer);

    // Handle window close - move UI back
    pipWindow.addEventListener('pagehide', () => {
      const mainContainer = document.querySelector('#root');
      mainContainer.append(callContainer);
    });

  } catch (error) {
    console.error('Document PiP failed:', error);
  }
}
```

**Important limitation:** Document PiP only works on **desktop**. For mobile, you must fall back to the traditional video PiP API[^5].

[^4]: Chrome Developers, "Document Picture-in-Picture API," https://developer.chrome.com/docs/web-platform/document-picture-in-picture
[^5]: Can I Use, "DocumentPictureInPicture API," https://caniuse.com/mdn-api_documentpictureinpicture (shows no mobile support as of 2026)

## Solution 2: Progressive Web App Installation

### Current State of Your Manifest

Your FishCall app already has a basic PWA manifest at `/public/manifest.json`:

```json
{
  "name": "FishCall",
  "short_name": "FishCall",
  "description": "Video calls with a fisheye twist",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#007AFF",
  "orientation": "portrait",
  "icons": [...]
}
```

This is **good**, but you can enhance it further.

### Improving Your PWA Manifest

**Add required members for better compatibility:**

```json
{
  "name": "FishCall",
  "short_name": "FishCall",
  "description": "Video calls with a fisheye twist 🐟",
  "start_url": "/",
  "id": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#007AFF",
  "orientation": "portrait",
  "categories": ["communication", "social"],
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-maskable-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/call-screen.png",
      "sizes": "1170x2532",
      "type": "image/png",
      "label": "Video call in progress"
    }
  ]
}
```

**Why these additions matter:**
- `id`: Unique identifier for your PWA (prevents reinstallation)
- `categories`: Helps discovery in app stores
- `purpose: "maskable"`: Creates better icons on Android adaptive icons[^6]
- `screenshots`: Shown in install prompt on Android (Chrome 90+)[^7]

[^6]: Web.dev, "Adaptive icon support in PWAs," https://web.dev/articles/maskable-icon
[^7]: MDN Web Docs, "Progressive Web Apps: Making PWAs installable," https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable

### Add to Home Screen: Platform-Specific Behavior

#### Android (Chrome, Edge, Samsung Internet)

**Install criteria:**
- ✅ Web app manifest with required fields
- ✅ Served over HTTPS (you have this)
- ✅ Service worker (optional but recommended)
- ✅ User engagement signal (varies)

**Installation trigger:**
Chrome automatically shows an install banner when criteria are met. You can also trigger it manually with `beforeinstallprompt`.

**Custom install button implementation:**

```javascript
// Add to App.jsx
const [deferredPrompt, setDeferredPrompt] = useState(null);
const [showInstallButton, setShowInstallButton] = useState(false);

useEffect(() => {
  // Capture the beforeinstallprompt event
  const handler = (e) => {
    // Prevent the default mini-infobar
    e.preventDefault();
    // Save the event for later
    setDeferredPrompt(e);
    // Show your custom install button
    setShowInstallButton(true);
  };

  window.addEventListener('beforeinstallprompt', handler);

  return () => {
    window.removeEventListener('beforeinstallprompt', handler);
  };
}, []);

const handleInstallClick = async () => {
  if (!deferredPrompt) return;

  // Show the install prompt
  deferredPrompt.prompt();

  // Wait for the user's response
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`Install ${outcome}`);

  // Clear the deferredPrompt
  setDeferredPrompt(null);
  setShowInstallButton(false);
};

// In your Home page component:
{showInstallButton && (
  <button onClick={handleInstallClick} className="install-button">
    📱 Add FishCall to Home Screen
  </button>
)}
```

**Note:** `beforeinstallprompt` is not supported on iOS[^8].

[^8]: MDN Web Docs, "Window: beforeinstallprompt event," https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event

#### iOS & iPadOS (Safari 14+)

**Install process:**
iOS does **not** show automatic install prompts. Users must manually:
1. Tap the Share button (box with arrow)
2. Select "Add to Home Screen"
3. Confirm

**Your role:** Provide clear instructions to iOS users.

**Implementation - iOS install instructions:**

```javascript
// Detect iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;

// Show instructions for iOS users
{isIOS && !isInStandaloneMode && (
  <div className="ios-install-banner">
    <p>📱 Install FishCall for the best experience:</p>
    <ol>
      <li>Tap the Share button <span style={{fontSize: '1.2em'}}>⎙</span></li>
      <li>Select "Add to Home Screen"</li>
      <li>Tap "Add"</li>
    </ol>
  </div>
)}
```

**iOS PWA behavior after installation:**
- Runs in standalone mode (no browser UI)
- Has its own task in the app switcher
- Can use camera/microphone permissions
- Still subject to browser background limitations (no background execution)

**Important iOS limitations:**
- No `beforeinstallprompt` event
- No push notifications support
- WebRTC works but requires user permission each session
- Service workers limited (max 50MB cache)[^9]

[^9]: Firt, Maximiliano, "PWA in 2021," https://firt.dev/pwa-2021

### Service Worker for Offline Support (Optional Enhancement)

While service workers don't enable background calling, they provide offline caching and better app-like experience[^10].

**Basic service worker for FishCall:**

Create `/public/service-worker.js`:

```javascript
const CACHE_NAME = 'fishcall-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  // Add your static assets
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip WebSocket and WebRTC requests
  if (event.request.url.startsWith('ws://') || 
      event.request.url.startsWith('wss://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

**Register in your HTML:**

Update `/client/index.html`:

```html
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(reg => console.log('SW registered:', reg))
        .catch(err => console.log('SW registration failed:', err));
    });
  }
</script>
```

[^10]: MDN Web Docs, "Service Worker API," https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

## Solution 3: Enhance Call Persistence with Visibility API

### Detect Tab Switches and App Minimization

Use the Page Visibility API to detect when the user switches tabs or minimizes the browser, then automatically trigger PiP[^11].

```javascript
// Add to App.jsx
useEffect(() => {
  const handleVisibilityChange = async () => {
    const isInCall = screen === 'call';
    const remoteVideo = remoteVideoRef.current;

    if (document.hidden && isInCall && remoteVideo && !document.pictureInPictureElement) {
      // User switched away - enter PiP
      try {
        await remoteVideo.requestPictureInPicture();
        console.log('Auto-entered PiP due to visibility change');
      } catch (error) {
        console.log('Auto-PiP failed:', error);
      }
    } else if (!document.hidden && document.pictureInPictureElement) {
      // User returned - exit PiP
      try {
        await document.exitPictureInPicture();
        console.log('Auto-exited PiP - user returned');
      } catch (error) {
        console.log('Auto exit PiP failed:', error);
      }
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [screen]);
```

**Behavior:**
- When user switches to another tab: video continues in PiP
- When user returns to tab: PiP closes, full screen returns
- When user closes browser: **connection terminates** (unavoidable)

[^11]: MDN Web Docs, "Page Visibility API," https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API

## Solution 4: Media Session API for System Controls

The Media Session API adds media controls to the notification tray and lock screen. While primarily for audio/video playback, it enhances the user experience during calls[^12].

```javascript
// Set up Media Session when call starts
function setupMediaSession(peerNickname) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `Call with ${peerNickname}`,
      artist: 'FishCall',
      album: 'Video Call',
      artwork: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ]
    });

    // Set playback state
    navigator.mediaSession.playbackState = 'playing';

    // Handle system controls
    navigator.mediaSession.setActionHandler('pause', () => {
      // Mute or pause video
      toggleMute();
    });

    navigator.mediaSession.setActionHandler('play', () => {
      // Unmute or resume video
      toggleMute();
    });

    // Video conferencing actions (Chrome 85+)
    navigator.mediaSession.setActionHandler('hangup', () => {
      hangUp();
    });

    navigator.mediaSession.setActionHandler('togglecamera', () => {
      toggleCamera();
    });

    navigator.mediaSession.setActionHandler('togglemicrophone', () => {
      toggleMute();
    });
  }
}

// Call when entering call screen
useEffect(() => {
  if (screen === 'call' && peerInfoRef.current) {
    setupMediaSession(peerInfoRef.current.nickname);
  }
}, [screen]);
```

**Browser support:**
- ✅ Chrome Android (notification controls)
- ✅ Safari iOS (lock screen controls)
- ✅ All desktop browsers
- Video conferencing actions (hangup, togglecamera, togglemicrophone) are Chrome 85+ only[^13]

[^12]: Chrome Developers, "Media Session API," https://developer.chrome.com/blog/media-session
[^13]: MDN Web Docs, "MediaSession," https://developer.mozilla.org/en-US/docs/Web/API/MediaSession

## Complete Implementation Guide

### Step 1: Update Your Manifest

Replace `/public/manifest.json` with enhanced version (shown in Section 2.2).

Generate proper icon sizes:
```bash
# Use a tool like PWA Asset Generator
npx pwa-asset-generator public/icon-original.png public/icons \
  --background "#007AFF" \
  --icon-only \
  --type png
```

### Step 2: Add PiP Support

1. Create PiP icon in `/client/src/components/Icons.jsx`:

```javascript
export function PictureInPictureIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/>
    </svg>
  );
}
```

2. Add PiP toggle to `App.jsx` (code shown in Section 1.1).

3. Add button to `CallScreen.jsx` (code shown in Section 1.1).

### Step 3: Add Install Prompt

1. Add state and event listener in `App.jsx` (code shown in Section 2.3).

2. Add install button to your `Home.jsx`:

```javascript
// In Home.jsx
export default function Home({ 
  // ... existing props
  showInstallButton, 
  onInstallClick 
}) {
  return (
    <div className="home">
      {showInstallButton && (
        <button onClick={onInstallClick} className="btn btn-primary install-btn">
          📱 Install FishCall
        </button>
      )}
      {/* ... rest of home screen ... */}
    </div>
  );
}
```

### Step 4: Add Visibility Handling

Add automatic PiP on tab switch (code shown in Section 3).

### Step 5: Add Media Session

Set up Media Session API when call starts (code shown in Section 4).

### Step 6: Add Service Worker (Optional)

Create and register service worker (code shown in Section 2.4).

### Step 7: Test on Devices

**Android Chrome:**
1. Visit your site over HTTPS
2. Click "Add to Home Screen" or your custom install button
3. Launch from home screen
4. Start a call
5. Switch to another app - PiP should auto-activate
6. Press home button - call continues in PiP
7. Close Chrome from app switcher - **call will terminate**

**iOS Safari:**
1. Visit your site over HTTPS
2. Tap Share → Add to Home Screen
3. Launch from home screen
4. Start a call
5. Switch to another app - PiP should work (iOS 14+)
6. Press home button - call continues in PiP
7. Swipe up to close Safari - **call will terminate**

## Browser Compatibility Matrix

| Feature | Chrome Android | Safari iOS | Chrome Desktop | Safari Desktop | Firefox |
|---------|---------------|------------|----------------|----------------|---------|
| **Video PiP API** | Partial (auto) | ✅ iOS 14+ | ✅ | ✅ macOS 13.1+ | Partial |
| **Document PiP** | ❌ | ❌ | ✅ Chrome 116+ | ❌ | ✅ Firefox 151+ |
| **PWA Install** | ✅ (auto prompt) | ✅ (manual) | ✅ | ✅ macOS 14+ | ❌ |
| **beforeinstallprompt** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Service Worker** | ✅ | ✅ (limited) | ✅ | ✅ | ✅ |
| **Media Session** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Page Visibility** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Background Execution** | ❌ | ❌ | ❌ | ❌ | ❌ |

**Key takeaway:** No mobile browser supports true background execution for WebRTC calls[^14].

[^14]: Can I Use, "Picture-in-Picture," https://caniuse.com/picture-in-picture

## Limitations and Workarounds

### What You CANNOT Do (Web Platform Limitations)

1. **Keep WebRTC connection alive when browser is closed**
   - Limitation: All JS execution stops
   - Workaround: None on mobile web. Native app required.

2. **Auto-reconnect from notification**
   - Limitation: No background WebSocket/WebRTC on mobile
   - Workaround: Push notifications can open app, but cannot maintain active calls

3. **True background calling like WhatsApp**
   - Limitation: Native apps have background permissions
   - Workaround: Best you can do is PiP when minimized (not closed)

### What You CAN Do

1. **PiP when user switches apps** ✅
   - Video continues in floating window
   - Works as long as browser process is alive

2. **Save and resume call state** ✅
   - Store room ID in localStorage
   - Show "Reconnect" button when user reopens
   - Implement in your existing rejoin logic (already present in `server.js`)

3. **Install as standalone app** ✅
   - Feels more app-like
   - Own icon on home screen
   - Standalone window (no browser chrome)

4. **Offline UI and caching** ✅
   - Service worker caches app shell
   - Works without network for UI
   - WebRTC still requires network for calls

## Advanced: Reconnection Flow

Enhance your existing rejoin logic to handle interrupted calls:

```javascript
// In App.jsx

// Save call state before potential disconnection
useEffect(() => {
  if (screen === 'call' && roomCode) {
    localStorage.setItem('activeCall', JSON.stringify({
      roomId: roomCode,
      timestamp: Date.now(),
    }));
  } else {
    localStorage.removeItem('activeCall');
  }
}, [screen, roomCode]);

// Check for interrupted call on app launch
useEffect(() => {
  const activeCallStr = localStorage.getItem('activeCall');
  if (activeCallStr) {
    try {
      const { roomId, timestamp } = JSON.parse(activeCallStr);
      const ageMinutes = (Date.now() - timestamp) / 1000 / 60;
      
      // Only prompt to rejoin if call was recent (< 5 minutes)
      if (ageMinutes < 5) {
        setToast({
          message: `Reconnect to call in room ${roomId}?`,
          action: () => {
            // Trigger rejoin
            setLastRoomId(roomId);
            setCanRejoin(true);
            setScreen('preview');
          }
        });
      } else {
        // Call too old, clear it
        localStorage.removeItem('activeCall');
      }
    } catch (e) {
      localStorage.removeItem('activeCall');
    }
  }
}, []); // Run once on mount
```

## Testing Checklist

- [ ] PWA manifest validates (use Chrome DevTools > Application > Manifest)
- [ ] HTTPS is configured (required for all features)
- [ ] Icons are correct sizes (192x192, 512x512 minimum)
- [ ] Install prompt appears on Android Chrome
- [ ] App installs to home screen (Android)
- [ ] Manual "Add to Home Screen" works (iOS)
- [ ] App opens in standalone mode after installation
- [ ] PiP activates when switching apps
- [ ] PiP button works manually
- [ ] Call continues in PiP window
- [ ] Video remains visible in PiP
- [ ] Call reconnects after brief disconnection
- [ ] Media controls appear in notification (Android)
- [ ] Media controls appear on lock screen (iOS)
- [ ] Service worker caches assets (if implemented)
- [ ] App works offline (UI only, no calls)

## Recommended User Flow

Based on limitations, here's the optimal UX:

1. **First visit:**
   - Prompt user to install PWA
   - Explain that installation improves call persistence
   - Show platform-specific instructions (iOS vs Android)

2. **During call:**
   - Show PiP button prominently
   - Auto-trigger PiP when user switches apps
   - Show toast: "Call continues in Picture-in-Picture"

3. **If connection lost:**
   - Detect WebSocket disconnection
   - Show "Connection lost" UI immediately
   - Offer "Reconnect" button
   - Auto-attempt reconnection (with backoff)

4. **If user returns after closing:**
   - Check localStorage for recent call
   - Show notification: "You were in a call. Reconnect?"
   - One-tap rejoin using your existing rejoin flow

## Security Considerations

1. **Camera/Microphone permissions persist in PWA**
   - iOS: Permissions reset each session
   - Android: Permissions persist after grant

2. **HTTPS is mandatory**
   - getUserMedia requires secure context
   - PiP requires secure context
   - PWA requires HTTPS (except localhost)

3. **Service Worker scope**
   - Serve from root (`/service-worker.js`) for full site control
   - Don't cache WebSocket/WebRTC requests

## Performance Optimization

1. **Lazy-load PiP code**
   ```javascript
   const enablePiP = async () => {
     const { requestPictureInPicture } = await import('./pip-helper.js');
     await requestPictureInPicture(videoRef.current);
   };
   ```

2. **Reduce PiP video quality**
   ```javascript
   videoElement.addEventListener('enterpictureinpicture', () => {
     // Reduce bandwidth in PiP mode
     const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
     const params = sender.getParameters();
     params.encodings[0].maxBitrate = 500000; // 500 kbps
     sender.setParameters(params);
   });
   ```

3. **Optimize service worker cache**
   - Cache only critical assets
   - Use stale-while-revalidate for non-critical
   - Set max cache size limits

## Alternative: Native App Development

If you absolutely need background calling like WhatsApp, consider:

1. **React Native** - Write once, deploy to iOS & Android
   - Can use same JS/React knowledge
   - Full native permissions including background
   - Requires separate App Store submissions

2. **Capacitor** - Wrap your PWA as native app
   - Reuse your existing web code
   - Add native plugins for background
   - Easiest migration path from your current PWA

3. **Flutter** - Cross-platform native framework
   - High performance
   - Good WebRTC packages available
   - Complete rewrite required

4. **Trusted Web Activity (Android only)**
   - Wraps your PWA in native container
   - Limited background capabilities (same as PWA)
   - Easiest path to Play Store

## Conclusion

While web technologies have come far, true WhatsApp-like background calling remains impossible on mobile browsers due to fundamental platform restrictions. The best web-based solution combines:

1. **PWA installation** - App-like experience
2. **Picture-in-Picture** - Call persistence when minimized (not closed)
3. **Visibility detection** - Auto-trigger PiP on tab switch
4. **Media Session API** - System-level controls
5. **Smart reconnection** - Resume calls after interruption

Your FishCall app is well-positioned to implement these features. The main gap is that when users **close the browser entirely**, the call will terminate—this is unavoidable without a native app.

**Recommended next steps:**
1. Implement PiP support (highest impact, works today)
2. Add install prompt and improve manifest
3. Test on real devices (Android & iOS)
4. Set user expectations clearly ("Call continues when minimized, not when closed")
5. Consider native app development if background calling is critical

## Additional Resources

**Official Documentation:**
- [MDN: Picture-in-Picture API](https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API)
- [Chrome: Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture)
- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev: Add to Home Screen](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Add_to_home_screen)

**Testing Tools:**
- [Lighthouse PWA Audit](https://developers.google.com/web/tools/lighthouse)
- [PWA Builder](https://www.pwabuilder.com/) - Test and package PWAs
- [Maskable.app](https://maskable.app/) - Test maskable icons

**Code Examples:**
- [Chrome Media Session Samples](https://googlechrome.github.io/samples/media-session/)
- [Document PiP Demo](https://chrome.dev/document-picture-in-picture-api)
- [MDN PiP Example](https://mdn.github.io/dom-examples/picture-in-picture/)

## Confidence Assessment

**High Confidence (90-100%):**
- Browser compatibility data
- PiP API implementation details
- PWA manifest requirements
- Background execution limitations

**Medium Confidence (70-90%):**
- Platform-specific quirks and edge cases
- Exact behavior of auto-PiP on different Android versions
- Service worker performance implications

**Lower Confidence (50-70%):**
- Future browser capabilities (APIs under development)
- iOS Safari implementation details (Apple doesn't publish detailed specs)

**Assumptions Made:**
- Your app is served over HTTPS (required for all features)
- You want to maintain web-first approach (vs native app)
- Target audience uses modern mobile browsers (last 2 years)
- Background calling parity with WhatsApp is aspirational, not mandatory

## Footnotes

(All footnotes are inline in the document above with [^N] format)
