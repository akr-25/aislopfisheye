import { useState, useRef, useEffect, useCallback } from "react";
import { HeliumAudio } from "./lib/helium.js";
import { addContact } from "./lib/contacts.js";
import Home from "./pages/Home.jsx";
import WaitingRoom from "./pages/WaitingRoom.jsx";
import JoinRoom from "./pages/JoinRoom.jsx";
import Connecting from "./pages/Connecting.jsx";
import CallEnded from "./pages/CallEnded.jsx";
import CallScreen from "./pages/CallScreen.jsx";
import TestPage from "./pages/TestPage.jsx";
import PreviewScreen from "./pages/PreviewScreen.jsx";
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
  const [screen, setScreen] = useState("home");
  const [roomCode, setRoomCode] = useState("");
  const [callStatus, setCallStatus] = useState("Connecting…");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [heliumEnabled, setHeliumEnabled] = useState(false);
  const [toast, setToast] = useState(null);
  const [canRejoin, setCanRejoin] = useState(false);
  const [lastRoomId, setLastRoomId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // 'create' | 'join' | { type: 'join', code: string } | { type: 'call', contact: object }

  // ── mutable refs ──────────────────────────────────────────────────────
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const fisheyeRef = useRef(null);
  const heliumRef = useRef(null);
  const uuidRef = useRef(null);
  const toastTimerRef = useRef(null);
  const facingModeRef = useRef("user");
  const peerInfoRef = useRef(null); // Store peer info for contact saving

  // CallScreen video/canvas – always in DOM so refs are always populated
  const remoteVideoRef = useRef(null);
  const localCanvasRef = useRef(null);
  const localHiddenVideoRef = useRef(null);

  // "latest callback" refs – avoids stale closures in WS/WebRTC handlers
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

    // Check for join code in URL
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get("join");
    if (joinCode) {
      // Clear the URL param
      window.history.replaceState({}, "", window.location.pathname);
      // Go to preview with pending join action
      setPendingAction({ type: "join", code: joinCode.toUpperCase() });
      setScreen("preview");
    }
  }, []);

  // ── toast ─────────────────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  }, []);

  // ── camera ────────────────────────────────────────────────────────────
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

  // ── WebRTC peer connection ─────────────────────────────────────────────
  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      if (st === "connected" || st === "completed") setCallStatus("");
      else if (st === "disconnected" || st === "failed")
        setCallStatus("Reconnecting…");
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

  // ── fisheye – always on at full strength ─────────────────────────────
  const setupFisheye = useCallback(() => {
    const canvas = localCanvasRef.current;
    const video = localHiddenVideoRef.current;
    if (!canvas || !video || !localStreamRef.current) return;
    video.srcObject = localStreamRef.current;
    video.play().catch(() => {});
    if (fisheyeRef.current) fisheyeRef.current.stop();
    fisheyeRef.current = new FisheyeRenderer(video, canvas);
    fisheyeRef.current.setStrength(1.0);
    fisheyeRef.current.start();
  }, []);

  // ── start call ────────────────────────────────────────────────────────
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
          setLastRoomId(msg.roomId);
          setScreen("waiting");
          break;
        case "room-joined":
          setLastRoomId(msg.roomId);
          setScreen("connecting");
          break;
        case "room-rejoined":
          setLastRoomId(msg.roomId);
          setScreen("connecting");
          showToast("Rejoined room");
          break;
        case "peer-joined":
        case "peer-rejoined":
          // Store peer info for contact saving
          if (msg.nickname || msg.uuid) {
            peerInfoRef.current = { id: msg.uuid, name: msg.nickname };
          }
          startServerCallRef.current(true);
          break;
        case "signal":
          handleSignalRef.current(msg.data);
          break;
        case "peer-left":
          // Save contact when call ends (if we have peer info)
          if (peerInfoRef.current?.id) {
            addContact(peerInfoRef.current.id, peerInfoRef.current.name);
          }
          setCanRejoin(msg.canRejoin || false);
          setLastRoomId(msg.roomId || lastRoomId);
          hangUpRef.current("call-ended");
          break;
        case "peer-info":
          // Server sends peer info when connection established
          peerInfoRef.current = { id: msg.uuid, name: msg.nickname };
          break;
        case "error":
          showToast(msg.message);
          if (msg.message === "Room expired") {
            setCanRejoin(false);
          }
          break;
        default:
          break;
      }
    },
    [showToast, lastRoomId],
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
  const hangUp = useCallback((goTo = "home") => {
    // Save contact if we had a call with someone
    if (peerInfoRef.current?.id && goTo === "call-ended") {
      addContact(peerInfoRef.current.id, peerInfoRef.current.name);
    }
    peerInfoRef.current = null;

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
    setScreen(goTo);
    setRoomCode("");
    setCallStatus("Connecting…");
    setAudioEnabled(true);
    setVideoEnabled(true);
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

  const rejoinRoom = useCallback(
    (roomId) => {
      if (!roomId) return;
      const ws = connectWS();
      const send = () =>
        ws.send(JSON.stringify({ type: "rejoin-room", roomId }));
      if (ws.readyState === 1) send();
      else ws.addEventListener("open", send, { once: true });
    },
    [connectWS],
  );

  // ── preview flow handlers ─────────────────────────────────────────────
  const handlePreviewReady = useCallback(
    (stream, settings) => {
      // Use the stream from preview
      localStreamRef.current = stream;
      setAudioEnabled(settings.audioEnabled);
      setVideoEnabled(settings.videoEnabled);

      // Execute the pending action
      if (pendingAction === "create") {
        createRoom();
      } else if (pendingAction?.type === "join") {
        joinRoom(pendingAction.code);
      }
      setPendingAction(null);
    },
    [pendingAction, createRoom, joinRoom],
  );

  const handlePreviewCancel = useCallback(() => {
    setPendingAction(null);
    setScreen("home");
  }, []);

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

  const toggleHelium = useCallback(async () => {
    const next = !heliumEnabled;
    try {
      if (next) {
        if (!localStreamRef.current) return;
        const helium = new HeliumAudio();
        const processed = await helium.process(localStreamRef.current);
        heliumRef.current = helium;
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
        if (vSender && fisheyeRef.current) {
          vSender.replaceTrack(
            fisheyeRef.current.getStream(30).getVideoTracks()[0],
          );
        }
        const aSender = pcRef.current
          .getSenders()
          .find((s) => s.track?.kind === "audio");
        if (aSender) aSender.replaceTrack(stream.getAudioTracks()[0]);
      }
    } catch {
      showToast("Could not flip camera");
    }
  }, [showToast]);

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {screen === "home" && (
        <Home
          onCreateRoom={() => {
            setPendingAction("create");
            setScreen("preview");
          }}
          onJoinRoom={() => setScreen("joining")}
          onTest={() => setScreen("test")}
        />
      )}
      {screen === "test" && <TestPage onBack={() => setScreen("home")} />}
      {screen === "preview" && (
        <PreviewScreen
          onReady={handlePreviewReady}
          onCancel={handlePreviewCancel}
          actionLabel={pendingAction === "create" ? "Create Room" : "Join Room"}
        />
      )}
      {screen === "waiting" && (
        <WaitingRoom roomCode={roomCode} onCancel={() => hangUp("home")} />
      )}
      {screen === "joining" && (
        <JoinRoom
          onJoin={(code) => {
            setPendingAction({ type: "join", code });
            setScreen("preview");
          }}
          onCancel={() => setScreen("home")}
        />
      )}
      {screen === "connecting" && (
        <Connecting onCancel={() => hangUp("home")} />
      )}
      {screen === "call-ended" && (
        <CallEnded
          onHome={() => {
            setCanRejoin(false);
            setScreen("home");
          }}
          onRejoin={rejoinRoom}
          canRejoin={canRejoin}
          roomId={lastRoomId}
        />
      )}

      {/* Always rendered so canvas/video refs stay in DOM */}
      <CallScreen
        visible={screen === "call"}
        remoteVideoRef={remoteVideoRef}
        localCanvasRef={localCanvasRef}
        localHiddenVideoRef={localHiddenVideoRef}
        callStatus={callStatus}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        heliumEnabled={heliumEnabled}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onFlipCamera={flipCamera}
        onToggleHelium={toggleHelium}
        onHangUp={() => hangUp("home")}
      />

      <Toast message={toast} />
    </div>
  );
}
