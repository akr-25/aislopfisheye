import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  FlipCameraIcon,
  PhoneEndIcon,
  HeliumIcon,
  PictureInPictureIcon,
} from "../components/Icons.jsx";
import { isPiPSupported } from "../lib/pwa.js";

export default function CallScreen({
  visible,
  remoteVideoRef,
  localCanvasRef,
  localHiddenVideoRef,
  callStatus,
  audioEnabled,
  videoEnabled,
  heliumEnabled,
  isInPiP,
  onToggleMute,
  onToggleCamera,
  onFlipCamera,
  onToggleHelium,
  onTogglePiP,
  onHangUp,
}) {
  const pipSupported = isPiPSupported();
  
  return (
    <div className={`call-screen${visible ? " call-screen--visible" : ""}`}>
      {/* Remote video – fills the screen */}
      <video
        ref={remoteVideoRef}
        className="call-remote-video"
        autoPlay
        playsInline
      />

      {/* Connecting / status label */}
      {callStatus ? (
        <div className="call-status-label">{callStatus}</div>
      ) : null}

      {/* PIP – local fisheye canvas */}
      <div className="call-pip">
        <canvas ref={localCanvasRef} />
      </div>

      {/* Hidden video element that feeds the FisheyeRenderer */}
      <video
        ref={localHiddenVideoRef}
        className="call-local-hidden"
        autoPlay
        muted
        playsInline
      />

      {/* Controls bar */}
      <div className="call-controls">
        <div className="call-controls-row">
          {/* Helium voice */}
          <button
            className={`btn btn-icon${heliumEnabled ? " btn-icon--helium" : ""}`}
            onClick={onToggleHelium}
            aria-label={heliumEnabled ? "Helium off" : "Helium voice"}
            title="Helium"
          >
            <HeliumIcon size={24} />
            <span className="btn-label">Helium</span>
          </button>

          {/* Mute */}
          <button
            className={`btn btn-icon${!audioEnabled ? " btn-icon--muted" : ""}`}
            onClick={onToggleMute}
            aria-label={audioEnabled ? "Mute" : "Unmute"}
            title={audioEnabled ? "Mute" : "Unmute"}
          >
            {audioEnabled ? <MicIcon size={24} /> : <MicOffIcon size={24} />}
            <span className="btn-label">
              {audioEnabled ? "Mute" : "Unmute"}
            </span>
          </button>

          {/* Camera on/off */}
          <button
            className={`btn btn-icon${!videoEnabled ? " btn-icon--muted" : ""}`}
            onClick={onToggleCamera}
            aria-label={videoEnabled ? "Camera off" : "Camera on"}
            title="Camera"
          >
            {videoEnabled ? <VideoIcon size={24} /> : <VideoOffIcon size={24} />}
            <span className="btn-label">Camera</span>
          </button>

          {/* Flip (mobile only) */}
          <button
            className="btn btn-icon mobile-only"
            onClick={onFlipCamera}
            aria-label="Flip camera"
            title="Flip"
          >
            <FlipCameraIcon size={24} />
            <span className="btn-label">Flip</span>
          </button>

          {/* Picture-in-Picture */}
          {pipSupported && (
            <button
              className={`btn btn-icon${isInPiP ? " btn-icon--active" : ""}`}
              onClick={onTogglePiP}
              aria-label={isInPiP ? "Exit Picture-in-Picture" : "Picture-in-Picture"}
              title="Picture-in-Picture"
            >
              <PictureInPictureIcon size={24} />
              <span className="btn-label">PiP</span>
            </button>
          )}

          {/* End call */}
          <button
            className="btn btn-icon btn-icon--danger"
            onClick={onHangUp}
            aria-label="End call"
            title="End call"
          >
            <PhoneEndIcon size={26} />
          </button>
        </div>
      </div>
    </div>
  );
}
