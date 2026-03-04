/* ── FishCall – main application ── */

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const app = {
  /* ── state ── */
  mode: null,           // 'serverless' | 'server'
  pc: null,             // RTCPeerConnection
  ws: null,             // WebSocket (server mode)
  localStream: null,
  fisheyeRenderer: null,
  fisheyeEnabled: true,
  audioEnabled: true,
  videoEnabled: true,
  facingMode: 'user',
  uuid: null,
  pendingCall: null,    // incoming-call info
  peerNickname: null,

  /* ── init ── */
  init() {
    this.uuid = localStorage.getItem('fishcall_uuid');
    if (!this.uuid) {
      this.uuid = crypto.randomUUID();
      localStorage.setItem('fishcall_uuid', this.uuid);
    }

    // check URL hash for serverless offer
    const h = location.hash;
    if (h.startsWith('#o=')) {
      this.handleIncomingOffer(h.slice(3));
    }
  },

  /* ════════════════  NAVIGATION  ════════════════ */

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  },

  goHome() {
    this._cleanup();
    this.showScreen('screen-home');
    history.replaceState(null, '', location.pathname);
  },

  /* ════════════════  MODE SELECTION  ════════════════ */

  selectMode(mode) {
    this.mode = mode;
    if (mode === 'serverless') {
      this.showScreen('screen-sl-role');
    } else {
      this.showScreen('screen-server');
      this._connectWS();
      this.renderSpeedDial();
    }
  },

  /* ════════════════  CAMERA  ════════════════ */

  async getCamera() {
    if (this.localStream) return this.localStream;
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: this.facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });
    return this.localStream;
  },

  setupFisheye(canvasId, videoId) {
    const canvas = document.getElementById(canvasId);
    const video  = document.getElementById(videoId);
    video.srcObject = this.localStream;
    video.play().catch(() => {});

    this.fisheyeRenderer = new FisheyeRenderer(video, canvas);
    this.fisheyeRenderer.setStrength(0.5);
    this.fisheyeRenderer.start();
  },

  /* ════════════════  WEBRTC  ════════════════ */

  createPC() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      const el = document.getElementById('call-status');
      if (el) {
        if (st === 'connected' || st === 'completed') { el.textContent = ''; }
        else if (st === 'disconnected' || st === 'failed') { el.textContent = 'Connection lost'; }
        else { el.textContent = 'Connecting…'; }
      }
    };

    pc.ontrack = (e) => {
      const rv = document.getElementById('remote-video');
      if (rv && e.streams[0]) rv.srcObject = e.streams[0];
    };

    this.pc = pc;
    return pc;
  },

  addTracks() {
    // send fisheye video + original audio
    const fishStream = this.fisheyeRenderer.getStream(30);
    const videoTrack = fishStream.getVideoTracks()[0];
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (videoTrack) this.pc.addTrack(videoTrack, fishStream);
    if (audioTrack) this.pc.addTrack(audioTrack, fishStream);
  },

  moveToCallScreen() {
    this.showScreen('screen-call');
    // move fisheye renderer to call-screen PIP canvas
    const canvas = document.getElementById('local-canvas');
    const video  = document.getElementById('local-hidden');
    video.srcObject = this.localStream;
    video.play().catch(() => {});

    if (this.fisheyeRenderer) this.fisheyeRenderer.stop();
    this.fisheyeRenderer = new FisheyeRenderer(video, canvas);
    this.fisheyeRenderer.setStrength(parseFloat(document.getElementById('fish-strength').value) / 100);
    this.fisheyeRenderer.start();
  },

  /* ════════════════  SERVERLESS MODE  ════════════════ */

  async slStart() {
    this.mode = 'serverless';
    this.showScreen('screen-sl-caller');
    try {
      await this.getCamera();
      this.setupFisheye('preview-caller', 'raw-caller');
      const pc = this.createPC();
      this.addTracks();

      // trickle ICE off: wait for all candidates
      pc.onicecandidate = (e) => {
        if (e.candidate === null) this._slOfferReady();
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
    } catch (err) {
      this.showToast('Camera error: ' + err.message);
    }
  },

  async _slOfferReady() {
    const encoded = await this.encodeSDP(this.pc.localDescription);
    const link = location.origin + location.pathname + '#o=' + encoded;
    document.getElementById('offer-link').value = link;
    document.getElementById('sl-gen').hidden = true;
    document.getElementById('sl-offer-ready').hidden = false;
  },

  copyOffer() {
    const val = document.getElementById('offer-link').value;
    navigator.clipboard.writeText(val).then(() => this.showToast('Link copied!')).catch(() => {});
  },

  async submitAnswer() {
    const raw = document.getElementById('answer-input').value.trim();
    if (!raw) return this.showToast('Paste the answer first');
    try {
      let encoded = raw;
      // if user pasted a full URL, extract the hash part
      if (raw.includes('#a=')) encoded = raw.split('#a=')[1];
      const desc = await this.decodeSDP(encoded);
      await this.pc.setRemoteDescription(new RTCSessionDescription(desc));
      this.moveToCallScreen();
    } catch (err) {
      this.showToast('Invalid answer: ' + err.message);
    }
  },

  slJoinPrompt() {
    this.showScreen('screen-sl-paste');
  },

  async slJoinFromPaste() {
    const raw = document.getElementById('offer-paste').value.trim();
    if (!raw) return this.showToast('Paste the offer first');
    let encoded = raw;
    if (raw.includes('#o=')) encoded = raw.split('#o=')[1];
    await this.handleIncomingOffer(encoded);
  },

  async handleIncomingOffer(encoded) {
    this.mode = 'serverless';
    this.showScreen('screen-sl-callee');
    try {
      await this.getCamera();
      this.setupFisheye('preview-callee', 'raw-callee');
      const desc = await this.decodeSDP(encoded);

      const pc = this.createPC();
      this.addTracks();

      await pc.setRemoteDescription(new RTCSessionDescription(desc));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // when ICE gathering done, show answer
      pc.onicecandidate = (e) => {
        if (e.candidate === null) this._slAnswerReady();
      };

      // may already be done
      if (pc.iceGatheringState === 'complete') this._slAnswerReady();

      // auto-navigate to call when connected
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          this.moveToCallScreen();
        }
      };
    } catch (err) {
      this.showToast('Error: ' + err.message);
    }
  },

  async _slAnswerReady() {
    const encoded = await this.encodeSDP(this.pc.localDescription);
    document.getElementById('answer-output').value = encoded;
    document.getElementById('sl-ans-gen').hidden = true;
    document.getElementById('sl-ans-ready').hidden = false;
  },

  copyAnswer() {
    const val = document.getElementById('answer-output').value;
    navigator.clipboard.writeText(val).then(() => this.showToast('Answer copied!')).catch(() => {});
  },

  /* ════════════════  SDP ENCODE / DECODE  ════════════════ */

  async encodeSDP(desc) {
    const json = JSON.stringify({ type: desc.type, sdp: desc.sdp });
    try {
      const blob = new Blob([json]);
      const cs = new CompressionStream('deflate-raw');
      const compressed = blob.stream().pipeThrough(cs);
      const buf = await new Response(compressed).arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch {
      return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
  },

  async decodeSDP(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try {
      const ds = new DecompressionStream('deflate-raw');
      const stream = new Blob([bytes]).stream().pipeThrough(ds);
      const text = await new Response(stream).text();
      return JSON.parse(text);
    } catch {
      return JSON.parse(decodeURIComponent(escape(bin)));
    }
  },

  /* ════════════════  SERVER MODE  ════════════════ */

  _connectWS() {
    if (this.ws && this.ws.readyState <= 1) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}`);
    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ type: 'register', uuid: this.uuid, nickname: this._nickname() }));
    };
    this.ws.onmessage = (e) => this._onWSMsg(JSON.parse(e.data));
    this.ws.onclose = () => { this.ws = null; };
  },

  _nickname() {
    return localStorage.getItem('fishcall_nick') || 'Anon-' + this.uuid.slice(0, 4);
  },

  _onWSMsg(msg) {
    switch (msg.type) {
      case 'room-created':
        this._showRoomCode(msg.roomId);
        break;
      case 'room-joined':
        this.showToast('Joined room ' + msg.roomId);
        break;
      case 'peer-joined':
        this.peerNickname = msg.nickname;
        this._startServerCall(true); // host creates offer
        break;
      case 'signal':
        this._handleSignal(msg.data);
        break;
      case 'incoming-call':
        this._showIncomingCall(msg);
        break;
      case 'call-declined':
        this.showToast('Call declined');
        break;
      case 'peer-offline':
        this.showToast('Peer is offline');
        break;
      case 'peer-left':
        this.showToast('Peer disconnected');
        this.hangUp();
        break;
      case 'error':
        this.showToast(msg.message);
        break;
    }
  },

  _showRoomCode(code) {
    document.getElementById('server-options').hidden = true;
    document.getElementById('room-info').hidden = false;
    document.getElementById('room-code-display').textContent = code;
  },

  createRoom() {
    this._connectWS();
    const send = () => this.ws.send(JSON.stringify({ type: 'create-room' }));
    if (this.ws.readyState === 1) send();
    else this.ws.addEventListener('open', send, { once: true });
  },

  joinRoom() {
    const code = document.getElementById('room-input').value.trim().toUpperCase();
    if (!code) return this.showToast('Enter a room code');
    this._connectWS();
    const send = () => this.ws.send(JSON.stringify({ type: 'join-room', roomId: code }));
    if (this.ws.readyState === 1) send();
    else this.ws.addEventListener('open', send, { once: true });
  },

  async _startServerCall(isHost) {
    try {
      await this.getCamera();
      const canvas = document.getElementById('local-canvas');
      const video  = document.getElementById('local-hidden');
      video.srcObject = this.localStream;
      await video.play().catch(() => {});

      this.fisheyeRenderer = new FisheyeRenderer(video, canvas);
      this.fisheyeRenderer.setStrength(0.5);
      this.fisheyeRenderer.start();

      const pc = this.createPC();
      this.addTracks();

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          this.ws.send(JSON.stringify({ type: 'signal', data: e.candidate.toJSON() }));
        }
      };

      this.showScreen('screen-call');

      if (isHost) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.ws.send(JSON.stringify({ type: 'signal', data: { type: 'offer', sdp: offer.sdp } }));
      }
    } catch (err) {
      this.showToast('Camera error: ' + err.message);
    }
  },

  async _handleSignal(data) {
    if (!this.pc && data.type === 'offer') {
      await this._startServerCall(false);
    }
    if (data.type === 'offer') {
      await this.pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.ws.send(JSON.stringify({ type: 'signal', data: { type: 'answer', sdp: answer.sdp } }));
    } else if (data.type === 'answer') {
      await this.pc.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.candidate) {
      try { await this.pc.addIceCandidate(new RTCIceCandidate(data)); } catch {}
    }
  },

  /* ── incoming call ── */
  _showIncomingCall(msg) {
    this.pendingCall = msg;
    document.getElementById('caller-name').textContent = msg.from.nickname + ' is calling…';
    document.getElementById('incoming-call').hidden = false;
  },

  acceptCall() {
    document.getElementById('incoming-call').hidden = true;
    if (!this.pendingCall) return;
    this._connectWS();
    const send = () => this.ws.send(JSON.stringify({ type: 'accept-call', roomId: this.pendingCall.roomId }));
    if (this.ws.readyState === 1) send();
    else this.ws.addEventListener('open', send, { once: true });
    this.pendingCall = null;
  },

  declineCall() {
    document.getElementById('incoming-call').hidden = true;
    if (!this.pendingCall) return;
    this.ws.send(JSON.stringify({ type: 'decline-call', roomId: this.pendingCall.roomId }));
    this.pendingCall = null;
  },

  /* ════════════════  CALL CONTROLS  ════════════════ */

  toggleFisheye() {
    this.fisheyeEnabled = !this.fisheyeEnabled;
    const btn = document.getElementById('btn-fisheye');
    btn.classList.toggle('active', this.fisheyeEnabled);
    if (this.fisheyeEnabled) {
      this.fisheyeRenderer.setStrength(parseFloat(document.getElementById('fish-strength').value) / 100);
    } else {
      this.fisheyeRenderer.setStrength(0);
    }
    // swap the track being sent
    if (this.pc) {
      const sender = this.pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        if (this.fisheyeEnabled) {
          const fTrack = this.fisheyeRenderer.getStream(30).getVideoTracks()[0];
          sender.replaceTrack(fTrack);
        } else {
          sender.replaceTrack(this.localStream.getVideoTracks()[0]);
        }
      }
    }
  },

  setFisheyeStrength(v) {
    if (this.fisheyeRenderer && this.fisheyeEnabled) {
      this.fisheyeRenderer.setStrength(v);
    }
  },

  toggleMute() {
    this.audioEnabled = !this.audioEnabled;
    this.localStream.getAudioTracks().forEach(t => { t.enabled = this.audioEnabled; });
    const btn = document.getElementById('btn-mute');
    btn.classList.toggle('off', !this.audioEnabled);
    btn.querySelector('span').textContent = this.audioEnabled ? 'Mute' : 'Unmute';
  },

  toggleCamera() {
    this.videoEnabled = !this.videoEnabled;
    this.localStream.getVideoTracks().forEach(t => { t.enabled = this.videoEnabled; });
    const btn = document.getElementById('btn-cam');
    btn.classList.toggle('off', !this.videoEnabled);
  },

  async flipCamera() {
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    // stop old tracks
    this.localStream.getTracks().forEach(t => t.stop());
    this.localStream = null;
    await this.getCamera();
    const video = document.getElementById('local-hidden');
    video.srcObject = this.localStream;
    video.play().catch(() => {});
    // replace track in PC
    if (this.pc) {
      const sender = this.pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        if (this.fisheyeEnabled) {
          const fTrack = this.fisheyeRenderer.getStream(30).getVideoTracks()[0];
          sender.replaceTrack(fTrack);
        } else {
          sender.replaceTrack(this.localStream.getVideoTracks()[0]);
        }
      }
      const aSender = this.pc.getSenders().find(s => s.track && s.track.kind === 'audio');
      if (aSender) aSender.replaceTrack(this.localStream.getAudioTracks()[0]);
    }
  },

  hangUp() {
    this._saveHistory();
    this._cleanup();
    // reset server mode UI
    const so = document.getElementById('server-options');
    if (so) so.hidden = false;
    const ri = document.getElementById('room-info');
    if (ri) ri.hidden = true;
    this.showScreen('screen-home');
    history.replaceState(null, '', location.pathname);
  },

  /* ════════════════  SPEED DIAL / HISTORY  ════════════════ */

  _saveHistory() {
    if (this.mode !== 'server' || !this.peerNickname) return;
    const history = JSON.parse(localStorage.getItem('fishcall_history') || '[]');
    history.unshift({ nickname: this.peerNickname, uuid: null, time: Date.now() });
    // keep last 20
    localStorage.setItem('fishcall_history', JSON.stringify(history.slice(0, 20)));
  },

  renderSpeedDial() {
    const list = JSON.parse(localStorage.getItem('fishcall_history') || '[]');
    const el = document.getElementById('speed-dial');
    if (!list.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<h3>📞 Recent Calls</h3>' + list.map((item, i) => {
      const ago = this._timeAgo(item.time);
      const initial = (item.nickname || '?')[0].toUpperCase();
      return `<div class="sd-item" onclick="app.showToast('Create a new room to reconnect')">
        <div class="sd-avatar">${initial}</div>
        <div class="sd-name">${item.nickname || 'Unknown'}</div>
        <div class="sd-time">${ago}</div>
      </div>`;
    }).join('');
  },

  _timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  },

  /* ════════════════  UTILITIES  ════════════════ */

  showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.remove('show'), 2500);
  },

  _cleanup() {
    if (this.pc) { this.pc.close(); this.pc = null; }
    if (this.fisheyeRenderer) { this.fisheyeRenderer.stop(); this.fisheyeRenderer = null; }
    if (this.localStream) { this.localStream.getTracks().forEach(t => t.stop()); this.localStream = null; }
    // don't close WS — keep it for speed dial presence
    const rv = document.getElementById('remote-video');
    if (rv) rv.srcObject = null;
  },
};

document.addEventListener('DOMContentLoaded', () => app.init());
