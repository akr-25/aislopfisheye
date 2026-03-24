export default function CallScreen({
  visible,
  remoteVideoRef,
  localCanvasRef,
  localHiddenVideoRef,
  callStatus,
  fisheyeEnabled,
  fisheyeStrength,
  audioEnabled,
  videoEnabled,
  heliumEnabled,
  onToggleFisheye,
  onStrengthChange,
  onToggleMute,
  onToggleCamera,
  onFlipCamera,
  onToggleHelium,
  onHangUp,
}) {
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
          {/* Fisheye toggle + slider */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              className={`btn btn-icon${fisheyeEnabled ? " btn-icon--active" : ""}`}
              onClick={onToggleFisheye}
              aria-label="Toggle fisheye"
              title="Fisheye"
            >
              <span>🐟</span>
              <span className="btn-label">Fisheye</span>
            </button>

            {fisheyeEnabled && (
              <input
                className="fisheye-slider"
                type="range"
                min="0"
                max="100"
                value={Math.round(fisheyeStrength * 100)}
                onChange={(e) => onStrengthChange(e.target.value / 100)}
                aria-label="Fisheye strength"
              />
            )}
          </div>

          {/* Helium voice */}
          <button
            className={`btn btn-icon${heliumEnabled ? " btn-icon--helium" : ""}`}
            onClick={onToggleHelium}
            aria-label={heliumEnabled ? "Helium off" : "Helium voice"}
            title="Helium"
          >
            <span>🎈</span>
            <span className="btn-label">Helium</span>
          </button>

          {/* Mute */}
          <button
            className={`btn btn-icon${!audioEnabled ? " btn-icon--muted" : ""}`}
            onClick={onToggleMute}
            aria-label={audioEnabled ? "Mute" : "Unmute"}
            title={audioEnabled ? "Mute" : "Unmute"}
          >
            <span>{audioEnabled ? "🎤" : "🔇"}</span>
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
            <span>{videoEnabled ? "📷" : "🚫"}</span>
            <span className="btn-label">Camera</span>
          </button>

          {/* Flip (mobile only) */}
          <button
            className="btn btn-icon mobile-only"
            onClick={onFlipCamera}
            aria-label="Flip camera"
            title="Flip"
          >
            <span>🔄</span>
            <span className="btn-label">Flip</span>
          </button>

          {/* End call */}
          <button
            className="btn btn-icon btn-icon--danger"
            onClick={onHangUp}
            aria-label="End call"
            title="End call"
          >
            <span>📞</span>
          </button>
        </div>
      </div>
    </div>
  );
}
