import { useState, useRef, useEffect, useCallback } from "react";
import { FisheyeRenderer } from "../lib/fisheye.js";
import { HeliumAudio } from "../lib/helium.js";
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  HeliumIcon,
  ChevronLeftIcon,
} from "../components/Icons.jsx";

export default function TestPage({ onBack }) {
  const [cameraReady, setCameraReady] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [heliumEnabled, setHeliumEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fisheyeRef = useRef(null);
  const heliumRef = useRef(null);
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
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (fisheyeRef.current) {
      fisheyeRef.current.stop();
      fisheyeRef.current = null;
    }
    if (heliumRef.current) {
      heliumRef.current.stop();
      heliumRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const toggleHelium = useCallback(async () => {
    if (!streamRef.current) return;
    
    const next = !heliumEnabled;
    try {
      if (next) {
        const helium = new HeliumAudio();
        await helium.process(streamRef.current);
        heliumRef.current = helium;
      } else {
        if (heliumRef.current) {
          heliumRef.current.stop();
          heliumRef.current = null;
        }
      }
      setHeliumEnabled(next);
    } catch (err) {
      console.error("Helium error:", err);
    }
  }, [heliumEnabled]);

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
    <div className="page page--top">
      <div className="nav-bar">
        <button className="nav-back btn" onClick={onBack}>
          <ChevronLeftIcon />
          Back
        </button>
      </div>

      <div className="stack stack--24 center max-400" style={{ marginTop: 40 }}>
        <div className="stack stack--8 center">
          <h1 className="t-title1">Test Your Setup</h1>
          <p className="t-body t-secondary">Preview fisheye effect and voice modulation</p>
        </div>

        {/* Camera preview with fisheye */}
        <div className="test-preview">
          <video ref={videoRef} className="test-hidden-video" muted playsInline />
          <canvas ref={canvasRef} className="test-canvas" />
          {!cameraReady && (
            <div className="test-loading">
              <div className="spinner" />
              <span>Starting camera...</span>
            </div>
          )}
        </div>

        {/* Audio level meter */}
        <div className="stack stack--8 w-full">
          <div className="test-label">
            <MicIcon size={18} />
            <span>Microphone Level</span>
          </div>
          <div className="audio-meter">
            <div 
              className="audio-meter-fill" 
              style={{ width: `${Math.min(audioLevel * 100 * 2, 100)}%` }}
            />
          </div>
          <p className="t-caption t-secondary">
            {audioLevel > 0.05 ? "✓ Microphone working" : "Speak to test your microphone"}
          </p>
        </div>

        {/* Controls */}
        <div className="test-controls">
          <button
            className={`btn btn-icon${heliumEnabled ? " btn-icon--helium" : ""}`}
            onClick={toggleHelium}
            title="Toggle helium voice"
          >
            <HeliumIcon size={24} />
            <span className="btn-label">Helium</span>
          </button>

          <button
            className={`btn btn-icon${!audioEnabled ? " btn-icon--muted" : ""}`}
            onClick={toggleMute}
            title={audioEnabled ? "Mute" : "Unmute"}
          >
            {audioEnabled ? <MicIcon size={24} /> : <MicOffIcon size={24} />}
            <span className="btn-label">{audioEnabled ? "Mute" : "Unmute"}</span>
          </button>

          <button
            className={`btn btn-icon${!videoEnabled ? " btn-icon--muted" : ""}`}
            onClick={toggleVideo}
            title={videoEnabled ? "Hide video" : "Show video"}
          >
            {videoEnabled ? <VideoIcon size={24} /> : <VideoOffIcon size={24} />}
            <span className="btn-label">Camera</span>
          </button>
        </div>

        <p className="t-footnote t-tertiary" style={{ marginTop: 8 }}>
          The fisheye effect is always on at maximum strength
        </p>
      </div>
    </div>
  );
}
