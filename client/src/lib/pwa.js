/**
 * PWA utilities for FishCall
 * Handles Picture-in-Picture, install prompts, visibility detection, and Media Session
 */

// ── Platform detection ─────────────────────────────────────────────────────
export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
export const isAndroid = /Android/.test(navigator.userAgent);
export const isMobile = isIOS || isAndroid;
export const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
  || window.navigator.standalone === true;

// ── Picture-in-Picture ─────────────────────────────────────────────────────
export function isPiPSupported() {
  return document.pictureInPictureEnabled === true;
}

export function isDocumentPiPSupported() {
  return 'documentPictureInPicture' in window;
}

export async function enterPictureInPicture(videoElement) {
  if (!videoElement) {
    throw new Error('Video element required');
  }
  
  if (!isPiPSupported()) {
    throw new Error('Picture-in-Picture not supported');
  }
  
  // Don't enter PiP if already in PiP
  if (document.pictureInPictureElement === videoElement) {
    return document.pictureInPictureElement;
  }
  
  // Exit any existing PiP first
  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture();
  }
  
  return videoElement.requestPictureInPicture();
}

export async function exitPictureInPicture() {
  if (document.pictureInPictureElement) {
    return document.exitPictureInPicture();
  }
}

export function isInPictureInPicture() {
  return !!document.pictureInPictureElement;
}

// ── PWA Install ────────────────────────────────────────────────────────────
let deferredInstallPrompt = null;

export function initInstallPrompt(onPromptAvailable) {
  // Capture the beforeinstallprompt event (Android/Chrome only)
  const handler = (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    onPromptAvailable?.(true);
  };
  
  window.addEventListener('beforeinstallprompt', handler);
  
  // Check if app was installed
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    onPromptAvailable?.(false);
  });
  
  return () => {
    window.removeEventListener('beforeinstallprompt', handler);
  };
}

export async function showInstallPrompt() {
  if (!deferredInstallPrompt) {
    return { outcome: 'unavailable' };
  }
  
  deferredInstallPrompt.prompt();
  const result = await deferredInstallPrompt.userChoice;
  
  if (result.outcome === 'accepted') {
    deferredInstallPrompt = null;
  }
  
  return result;
}

export function canShowInstallPrompt() {
  return !!deferredInstallPrompt;
}

// ── Media Session API ──────────────────────────────────────────────────────
export function setupMediaSession({ 
  peerName = 'Someone', 
  onToggleMute,
  onToggleCamera, 
  onHangUp 
}) {
  if (!('mediaSession' in navigator)) {
    return;
  }
  
  // Set metadata
  navigator.mediaSession.metadata = new MediaMetadata({
    title: `Call with ${peerName}`,
    artist: 'FishCall',
    album: 'Video Call',
    artwork: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ]
  });
  
  navigator.mediaSession.playbackState = 'playing';
  
  // Set up action handlers
  try {
    navigator.mediaSession.setActionHandler('pause', onToggleMute);
    navigator.mediaSession.setActionHandler('play', onToggleMute);
  } catch (e) {
    // Not supported
  }
  
  // Video call specific actions (Chrome 85+)
  try {
    navigator.mediaSession.setActionHandler('hangup', onHangUp);
  } catch (e) {
    // Not supported
  }
  
  try {
    navigator.mediaSession.setActionHandler('togglemicrophone', onToggleMute);
  } catch (e) {
    // Not supported
  }
  
  try {
    navigator.mediaSession.setActionHandler('togglecamera', onToggleCamera);
  } catch (e) {
    // Not supported
  }
}

export function clearMediaSession() {
  if (!('mediaSession' in navigator)) {
    return;
  }
  
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = 'none';
  
  // Clear action handlers
  const actions = ['pause', 'play', 'hangup', 'togglemicrophone', 'togglecamera'];
  actions.forEach(action => {
    try {
      navigator.mediaSession.setActionHandler(action, null);
    } catch (e) {
      // Not supported
    }
  });
}

// ── Active Call Persistence ────────────────────────────────────────────────
const ACTIVE_CALL_KEY = 'fishcall_active_call';
const CALL_TIMEOUT_MINUTES = 5;

export function saveActiveCall(roomId) {
  if (!roomId) return;
  
  localStorage.setItem(ACTIVE_CALL_KEY, JSON.stringify({
    roomId,
    timestamp: Date.now(),
  }));
}

export function getActiveCall() {
  const data = localStorage.getItem(ACTIVE_CALL_KEY);
  if (!data) return null;
  
  try {
    const { roomId, timestamp } = JSON.parse(data);
    const ageMinutes = (Date.now() - timestamp) / 1000 / 60;
    
    if (ageMinutes > CALL_TIMEOUT_MINUTES) {
      clearActiveCall();
      return null;
    }
    
    return { roomId, ageMinutes };
  } catch {
    clearActiveCall();
    return null;
  }
}

export function clearActiveCall() {
  localStorage.removeItem(ACTIVE_CALL_KEY);
}

// ── Visibility API ─────────────────────────────────────────────────────────
export function onVisibilityChange(callback) {
  const handler = () => {
    callback(document.hidden);
  };
  
  document.addEventListener('visibilitychange', handler);
  
  return () => {
    document.removeEventListener('visibilitychange', handler);
  };
}
