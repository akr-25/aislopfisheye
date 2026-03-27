import { useState, useRef, useEffect, useCallback } from "react";
import { FisheyeRenderer } from "../lib/fisheye.js";
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  ChevronLeftIcon,
} from "../components/Icons.jsx";

export default function PreviewScreen({ onReady, onCancel, actionLabel = "Join Room" }) {
  const [cameraReady, setCameraReady] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [error, setError] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fisheyeRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationRef = useRef(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Setup fisheye
      if (canvasRef.current && videoRef.current) {
        fisheyeRef.current = new FisheyeRenderer(videoRef.current, canvasRef.current);
        fisheyeRef.current.setStrength(1.0);
        fisheyeRef.current.start();
      }

      // Setup audio analyser for level meter
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Start level monitoring
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 255);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      setCameraReady(true);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera or microphone. Please check permissions.");
    }
  }, []);

  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (fisheyeRef.current) {
      fisheyeRef.current.stop();
      fisheyeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    // Note: Don't stop the stream here - pass it to onReady
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      cleanup();
      // Stop stream on unmount if not passed to parent
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startCamera, cleanup]);

  const handleReady = useCallback(() => {
    cleanup();
    const stream = streamRef.current;
    streamRef.current = null; // Prevent cleanup from stopping tracks
    onReady(stream, { audioEnabled, videoEnabled });
  }, [cleanup, onReady, audioEnabled, videoEnabled]);

  const handleCancel = useCallback(() => {
    cleanup();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    onCancel();
  }, [cleanup, onCancel]);

  const toggleMute = useCallback(() => {
    if (!streamRef.current) return;
    const next = !audioEnabled;
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setAudioEnabled(next);
  }, [audioEnabled]);

  const toggleVideo = useCallback(() => {
    if (!streamRef.current) return;
    const next = !videoEnabled;
    streamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setVideoEnabled(next);
  }, [videoEnabled]);

  return (
    <div className="page page--preview">
      <div className="nav-bar">
        <button className="nav-back btn" onClick={handleCancel}>
          <ChevronLeftIcon />
          Cancel
        </button>
      </div>

      <div className="preview-layout">
        <div className="stack stack--8 center">
          <h1 className="t-title2">Camera Preview</h1>
          <p className="t-subhead t-secondary">Check how you look before joining</p>
        </div>

        {/* Camera preview with fisheye */}
        <div className="preview-container">
          <video ref={videoRef} className="test-hidden-video" muted playsInline />
          <canvas ref={canvasRef} className="preview-canvas" />
          {!cameraReady && !error && (
            <div className="test-loading">
              <div className="spinner" />
              <span>Starting camera...</span>
            </div>
          )}
          {error && (
            <div className="test-loading">
              <span style={{ color: "var(--red)" }}>{error}</span>
            </div>
          )}
        </div>

        {/* Audio level meter */}
        <div className="stack stack--6 w-full max-400">
          <div className="test-label">
            <MicIcon size={16} />
            <span>Microphone</span>
            <span className={`mic-status ${audioLevel > 0.05 ? "mic-status--active" : ""}`}>
              {audioLevel > 0.05 ? "Working" : "Silent"}
            </span>
          </div>
          <div className="audio-meter">
            <div 
              className="audio-meter-fill" 
              style={{ width: `${Math.min(audioLevel * 100 * 2, 100)}%` }}
            />
          </div>
        </div>

        {/* Bottom controls */}
        <div className="preview-bottom">
          <div className="preview-toggles">
            <button
              className={`btn btn-icon btn-icon--sm${!audioEnabled ? " btn-icon--muted" : ""}`}
              onClick={toggleMute}
              title={audioEnabled ? "Mute" : "Unmute"}
            >
              {audioEnabled ? <MicIcon size={22} /> : <MicOffIcon size={22} />}
            </button>

            <button
              className={`btn btn-icon btn-icon--sm${!videoEnabled ? " btn-icon--muted" : ""}`}
              onClick={toggleVideo}
              title={videoEnabled ? "Hide video" : "Show video"}
            >
              {videoEnabled ? <VideoIcon size={22} /> : <VideoOffIcon size={22} />}
            </button>
          </div>

          {/* Action button */}
          <button 
            className="btn btn-primary" 
            onClick={handleReady}
            disabled={!cameraReady}
            style={{ width: '100%', maxWidth: 280 }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
