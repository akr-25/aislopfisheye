import { useState, useRef, useEffect, useCallback } from "react";
import { HeliumAudio } from "./lib/helium.js";
import Home from "./pages/Home.jsx";
import WaitingRoom from "./pages/WaitingRoom.jsx";
import JoinRoom from "./pages/JoinRoom.jsx";
import Connecting from "./pages/Connecting.jsx";
import CallScreen from "./pages/CallScreen.jsx";
import Toast from "./components/Toast.jsx";
import { FisheyeRenderer } from "./lib/fisheye.js";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const host = import.meta.env.DEV ? "localhost:3000" : location.host;
  return `${proto}://${host}`;
};

export default function App() {
  // ── UI state ──────────────────────────────────────────────────────────
  const [screen, setScreen] = useState("home"); // 'home' | 'waiting' | 'joining' | 'connecting' | 'call'
  const [roomCode, setRoomCode] = useState("");
  const [callStatus, setCallStatus] = useState("Connecting…");
  const [fisheyeEnabled, setFisheyeEnabled] = useState(true);
  const [fisheyeStrength, setFisheyeStrength] = useState(0.5);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [toast, setToast] = useState(null);
  const [heliumEnabled, setHeliumEnabled] = useState(false);

  // ── mutable refs (don't trigger re-renders) ───────────────────────────
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const fisheyeRef = useRef(null);
  const uuidRef = useRef(null);
  const toastTimerRef = useRef(null);
  const facingModeRef = useRef("user");
  const heliumRef = useRef(null);

  // mirror state → ref so async callbacks always see latest value
  const fisheyeEnabledRef = useRef(true);
  const fisheyeStrengthRef = useRef(0.5);
  fisheyeEnabledRef.current = fisheyeEnabled;
  fisheyeStrengthRef.current = fisheyeStrength;

  // CallScreen video/canvas elements – always in DOM (hidden when not in call)
  const remoteVideoRef = useRef(null);
  const localCanvasRef = useRef(null);
  const localHiddenVideoRef = useRef(null);

  // "latest callback" refs – allows WS/WebRTC event handlers to call the
  // most-recently-rendered version without stale closures
  const handleWSMessageRef = useRef(null);
  const startServerCallRef = useRef(null);
  const handleSignalRef = useRef(null);
  const hangUpRef = useRef(null);

  // ── UUID init ─────────────────────────────────────────────────────────
  useEffect(() => {
    let uuid = localStorage.getItem("fishcall_uuid");
    if (!uuid) {
      uuid = crypto.randomUUID();
      localStorage.setItem("fishcall_uuid", uuid);
    }
    uuidRef.current = uuid;
  }, []);

  // ── toast ─────────────────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  }, []);

  // ── camera ───────────────────────────────────────────────────────────
  const getCamera = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: facingModeRef.current,
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: true,
    });
    localStreamRef.current = stream;
    return stream;
  }, []);

  // ── WebRTC peer connection ────────────────────────────────────────────
  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      if (st === "connected" || st === "completed") setCallStatus("");
      else if (st === "disconnected" || st === "failed")
        setCallStatus("Connection lost");
      else setCallStatus("Connecting…");
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pcRef.current = pc;
    return pc;
  }, []);

  const addTracks = useCallback((pc) => {
    if (!fisheyeRef.current || !localStreamRef.current) return;
    const fishStream = fisheyeRef.current.getStream(30);
    const videoTrack = fishStream.getVideoTracks()[0];
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (videoTrack) pc.addTrack(videoTrack, fishStream);
    if (audioTrack) pc.addTrack(audioTrack, fishStream);
  }, []);

  // ── fisheye setup (uses always-in-DOM CallScreen canvas/video) ────────
  const setupFisheye = useCallback(() => {
    const canvas = localCanvasRef.current;
    const video = localHiddenVideoRef.current;
    if (!canvas || !video || !localStreamRef.current) return;
    video.srcObject = localStreamRef.current;
    video.play().catch(() => {});
    if (fisheyeRef.current) fisheyeRef.current.stop();
    fisheyeRef.current = new FisheyeRenderer(video, canvas);
    fisheyeRef.current.setStrength(fisheyeStrengthRef.current);
    fisheyeRef.current.start();
  }, []);

  // ── start call (host = true → creates offer; false → waits for offer) ─
  const startServerCall = useCallback(
    async (isHost) => {
      try {
        await getCamera();
        setupFisheye();

        const pc = createPC();
        addTracks(pc);

        pc.onicecandidate = (e) => {
          if (e.candidate && wsRef.current?.readyState === 1) {
            wsRef.current.send(
              JSON.stringify({ type: "signal", data: e.candidate.toJSON() }),
            );
          }
        };

        setScreen("call");

        if (isHost) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          wsRef.current?.send(
            JSON.stringify({
              type: "signal",
              data: { type: "offer", sdp: offer.sdp },
            }),
          );
        }
      } catch (err) {
        showToast("Camera error: " + err.message);
      }
    },
    [getCamera, setupFisheye, createPC, addTracks, showToast],
  );
  startServerCallRef.current = startServerCall;

  // ── WebRTC signal handler ─────────────────────────────────────────────
  const handleSignal = useCallback(async (data) => {
    // Guest: first signal is the offer – boot up call stack first
    if (!pcRef.current && data.type === "offer") {
      await startServerCallRef.current(false);
    }
    const pc = pcRef.current;
    if (!pc) return;

    try {
      if (data.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsRef.current?.send(
          JSON.stringify({
            type: "signal",
            data: { type: "answer", sdp: answer.sdp },
          }),
        );
      } else if (data.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
      } else if (data.candidate !== undefined) {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      }
    } catch (err) {
      // ICE errors are usually benign
      console.warn("signal error", err);
    }
  }, []);
  handleSignalRef.current = handleSignal;

  // ── WebSocket message handler ─────────────────────────────────────────
  const handleWSMessage = useCallback(
    (msg) => {
      switch (msg.type) {
        case "room-created":
          setRoomCode(msg.roomId);
          setScreen("waiting");
          break;
        case "room-joined":
          // Guest confirmed — transition to connecting screen while waiting for host's offer
          setScreen("connecting");
          break;
        case "peer-joined":
          startServerCallRef.current(true); // host creates offer
          break;
        case "signal":
          handleSignalRef.current(msg.data);
          break;
        case "peer-left":
          showToast("Peer disconnected");
          hangUpRef.current();
          break;
        case "error":
          showToast(msg.message);
          break;
        default:
          break;
      }
    },
    [showToast],
  );
  handleWSMessageRef.current = handleWSMessage;

  // ── WebSocket connect ─────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return wsRef.current;
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "register",
          uuid: uuidRef.current,
          nickname: `Anon-${(uuidRef.current ?? "0000").slice(0, 4)}`,
        }),
      );
    };
    ws.onmessage = (e) => handleWSMessageRef.current?.(JSON.parse(e.data));
    ws.onclose = () => {
      wsRef.current = null;
    };
    return ws;
  }, []);

  // ── hang up / cleanup ─────────────────────────────────────────────────
  const hangUp = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (fisheyeRef.current) {
      fisheyeRef.current.stop();
      fisheyeRef.current = null;
    }
    if (heliumRef.current) {
      heliumRef.current.stop();
      heliumRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localHiddenVideoRef.current)
      localHiddenVideoRef.current.srcObject = null;
    setScreen("home");
    setRoomCode("");
    setCallStatus("Connecting…");
    setAudioEnabled(true);
    setVideoEnabled(true);
    setFisheyeEnabled(true);
    setFisheyeStrength(0.5);
    setHeliumEnabled(false);
  }, []);
  hangUpRef.current = hangUp;

  // ── room actions ──────────────────────────────────────────────────────
  const createRoom = useCallback(() => {
    const ws = connectWS();
    const send = () => ws.send(JSON.stringify({ type: "create-room" }));
    if (ws.readyState === 1) send();
    else ws.addEventListener("open", send, { once: true });
  }, [connectWS]);

  const joinRoom = useCallback(
    (code) => {
      if (!code) return showToast("Enter a room code");
      const ws = connectWS();
      const send = () =>
        ws.send(
          JSON.stringify({ type: "join-room", roomId: code.toUpperCase() }),
        );
      if (ws.readyState === 1) send();
      else ws.addEventListener("open", send, { once: true });
    },
    [connectWS, showToast],
  );

  // ── call controls ─────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const next = !audioEnabled;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setAudioEnabled(next);
  }, [audioEnabled]);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const next = !videoEnabled;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setVideoEnabled(next);
  }, [videoEnabled]);

  const toggleFisheye = useCallback(() => {
    const next = !fisheyeEnabledRef.current;
    setFisheyeEnabled(next);
    if (fisheyeRef.current) {
      fisheyeRef.current.setStrength(next ? fisheyeStrengthRef.current : 0);
    }
    if (pcRef.current) {
      const sender = pcRef.current
        .getSenders()
        .find((s) => s.track?.kind === "video");
      if (sender) {
        if (next && fisheyeRef.current) {
          sender.replaceTrack(
            fisheyeRef.current.getStream(30).getVideoTracks()[0],
          );
        } else if (localStreamRef.current) {
          sender.replaceTrack(localStreamRef.current.getVideoTracks()[0]);
        }
      }
    }
  }, []);

  const handleStrengthChange = useCallback((v) => {
    setFisheyeStrength(v);
    fisheyeStrengthRef.current = v;
    if (fisheyeRef.current && fisheyeEnabledRef.current) {
      fisheyeRef.current.setStrength(v);
    }
  }, []);

  const toggleHelium = useCallback(async () => {
    const next = !heliumEnabled;
    try {
      if (next) {
        if (!localStreamRef.current) return;
        const helium = new HeliumAudio();
        const processed = await helium.process(localStreamRef.current);
        heliumRef.current = helium;
        // Replace the audio track being sent to the peer
        if (pcRef.current) {
          const audioTrack = processed.getAudioTracks()[0];
          const sender = pcRef.current
            .getSenders()
            .find((s) => s.track?.kind === "audio");
          if (sender && audioTrack) sender.replaceTrack(audioTrack);
        }
      } else {
        if (heliumRef.current) {
          heliumRef.current.stop();
          heliumRef.current = null;
        }
        // Restore the original raw audio track
        if (pcRef.current && localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          const sender = pcRef.current
            .getSenders()
            .find((s) => s.track?.kind === "audio");
          if (sender && audioTrack) sender.replaceTrack(audioTrack);
        }
      }
      setHeliumEnabled(next);
    } catch (err) {
      showToast("Helium unavailable: " + err.message);
    }
  }, [heliumEnabled, showToast]);

  const flipCamera = useCallback(async () => {
    try {
      facingModeRef.current =
        facingModeRef.current === "user" ? "environment" : "user";
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingModeRef.current,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });
      localStreamRef.current = stream;
      const hiddenVideo = localHiddenVideoRef.current;
      if (hiddenVideo) {
        hiddenVideo.srcObject = stream;
        hiddenVideo.play().catch(() => {});
      }
      if (pcRef.current) {
        const vSender = pcRef.current
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (vSender) {
          if (fisheyeEnabledRef.current && fisheyeRef.current) {
            vSender.replaceTrack(
              fisheyeRef.current.getStream(30).getVideoTracks()[0],
            );
          } else {
            vSender.replaceTrack(stream.getVideoTracks()[0]);
          }
        }
        const aSender = pcRef.current
          .getSenders()
          .find((s) => s.track?.kind === "audio");
        if (aSender) aSender.replaceTrack(stream.getAudioTracks()[0]);
      }
    } catch (err) {
      showToast("Could not flip camera");
    }
  }, [showToast]);

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {screen === "home" && (
        <Home
          onCreateRoom={createRoom}
          onJoinRoom={() => setScreen("joining")}
        />
      )}

      {screen === "waiting" && (
        <WaitingRoom roomCode={roomCode} onCancel={hangUp} />
      )}

      {screen === "joining" && (
        <JoinRoom onJoin={joinRoom} onCancel={() => setScreen("home")} />
      )}

      {screen === "connecting" && <Connecting onCancel={hangUp} />}

      {/* CallScreen is always rendered so canvas/video refs are always in DOM.
          Visibility is controlled via the `visible` prop (CSS display toggle). */}
      <CallScreen
        visible={screen === "call"}
        remoteVideoRef={remoteVideoRef}
        localCanvasRef={localCanvasRef}
        localHiddenVideoRef={localHiddenVideoRef}
        callStatus={callStatus}
        fisheyeEnabled={fisheyeEnabled}
        fisheyeStrength={fisheyeStrength}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        heliumEnabled={heliumEnabled}
        onToggleFisheye={toggleFisheye}
        onStrengthChange={handleStrengthChange}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onFlipCamera={flipCamera}
        onToggleHelium={toggleHelium}
        onHangUp={hangUp}
      />

      <Toast message={toast} />
    </div>
  );
}
