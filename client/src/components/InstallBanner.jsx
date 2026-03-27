import { useState } from 'react';
import { InstallIcon, ShareIcon } from './Icons.jsx';
import { isIOS, isStandalone } from '../lib/pwa.js';

export default function InstallBanner({ 
  showInstallButton, 
  onInstallClick,
  onDismiss 
}) {
  const [dismissed, setDismissed] = useState(false);
  
  // Don't show if already installed as PWA
  if (isStandalone || dismissed) {
    return null;
  }
  
  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };
  
  // iOS requires manual "Add to Home Screen" instructions
  if (isIOS) {
    return (
      <div className="install-banner install-banner--ios">
        <div className="install-banner-content">
          <div className="install-banner-icon">
            <ShareIcon size={20} />
          </div>
          <div className="install-banner-text">
            <strong>Install FishCall</strong>
            <span>Tap <ShareIcon size={14} /> then "Add to Home Screen"</span>
          </div>
        </div>
        <button 
          className="install-banner-close"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    );
  }
  
  // Android/Chrome with beforeinstallprompt support
  if (showInstallButton) {
    return (
      <div className="install-banner">
        <div className="install-banner-content">
          <div className="install-banner-icon">
            <InstallIcon size={20} />
          </div>
          <div className="install-banner-text">
            <strong>Install FishCall</strong>
            <span>Add to your home screen for the best experience</span>
          </div>
        </div>
        <div className="install-banner-actions">
          <button 
            className="btn btn-small btn-primary"
            onClick={onInstallClick}
          >
            Install
          </button>
          <button 
            className="install-banner-close"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }
  
  return null;
}
