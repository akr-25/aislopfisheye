/**
 * Icons.jsx — Stroke-based SVG icon components
 * All icons: 24×24 viewBox, 1.75 stroke width, round caps & joins
 */

const svg = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '1.75',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function MicIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

export function MicOffIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M18.89 13.23A7.49 7.49 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 4.9" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.34" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

export function VideoIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

export function VideoOffIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
      <line x1="2" y1="2" x2="22" y2="22" />
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

export function FlipCameraIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
      <path d="M1 4v6h6" />
      <path d="M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10" />
      <path d="M3.51 15a9 9 0 0 0 14.85 3.36L23 14" />
    </svg>
  )
}

export function PhoneOffIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg} strokeWidth="1.9">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45
               12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2
               19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.43 8.85
               a2 2 0 0 1 1.64-1.98 12.84 12.84 0 0 0 2.82-.7
               2 2 0 0 1 2.11.45l1.27 1.27a16 16 0 0 0 2.6 3.41" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  )
}

export function BalloonIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
      {/* balloon body */}
      <path d="M12 2C8.1 2 5 5.4 5 9.5S8.1 17 12 17s7-3.4 7-7.5S15.9 2 12 2z" />
      {/* knot */}
      <path d="M10.5 17c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5" />
      {/* string */}
      <line x1="12" y1="18.5" x2="12" y2="22" />
    </svg>
  )
}

export function ChevronLeftIcon({ size = 11 }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 10 17" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1L1.5 8.5L9 16" />
    </svg>
  )
}

export function CopyIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function CheckIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg} strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function FisheyeIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
      <circle cx="12" cy="12" r="10" />
      <ellipse cx="12" cy="12" rx="4" ry="8" />
      <ellipse cx="12" cy="12" rx="8" ry="4" />
    </svg>
  )
}

export function HeliumIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
      <path d="M12 2C8.5 2 6 5.5 6 9.5C6 13.5 8.5 16 12 16C15.5 16 18 13.5 18 9.5C18 5.5 15.5 2 12 2Z" />
      <path d="M10 16L9 22" />
      <path d="M14 16L15 22" />
      <path d="M12 16V19" />
    </svg>
  )
}

export function PhoneEndIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export function PictureInPictureIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <rect x="12" y="9" width="8" height="6" rx="1" ry="1" fill="currentColor" fillOpacity="0.3" />
    </svg>
  )
}

export function InstallIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export function ShareIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

export function MicLevelIcon({ size = 22, level = 0 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg}>
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
      {level > 0 && <rect x="10" y={14 - level * 10} width="4" height={level * 10} rx="1" fill="currentColor" opacity="0.5" />}
    </svg>
  )
}

export function CallEndedIcon({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svg} strokeWidth="1.5">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45
               12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2
               19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.43 8.85
               a2 2 0 0 1 1.64-1.98 12.84 12.84 0 0 0 2.82-.7
               2 2 0 0 1 2.11.45l1.27 1.27a16 16 0 0 0 2.6 3.41" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  )
}
