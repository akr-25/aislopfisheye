const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();
const peers = new Map(); // uuid → ws

function roomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      /* ── identity ── */
      case 'register': {
        ws.uuid = msg.uuid;
        ws.nickname = msg.nickname || 'Anonymous';
        peers.set(msg.uuid, ws);
        ws.send(JSON.stringify({ type: 'registered' }));
        break;
      }

      /* ── rooms ── */
      case 'create-room': {
        const id = roomCode();
        rooms.set(id, { host: ws, guest: null });
        ws.roomId = id;
        ws.send(JSON.stringify({ type: 'room-created', roomId: id }));
        break;
      }

      case 'join-room': {
        const room = rooms.get(msg.roomId);
        if (!room) return ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        if (room.guest) return ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
        room.guest = ws;
        ws.roomId = msg.roomId;
        ws.send(JSON.stringify({ type: 'room-joined', roomId: msg.roomId }));
        room.host.send(JSON.stringify({ type: 'peer-joined', nickname: ws.nickname || 'Anonymous' }));
        break;
      }

      /* ── speed-dial: call a known peer ── */
      case 'call-peer': {
        const target = peers.get(msg.targetUuid);
        if (!target || target.readyState !== 1) {
          ws.send(JSON.stringify({ type: 'peer-offline' }));
          return;
        }
        const id = roomCode();
        rooms.set(id, { host: ws, guest: null });
        ws.roomId = id;
        ws.send(JSON.stringify({ type: 'room-created', roomId: id }));
        target.send(JSON.stringify({
          type: 'incoming-call',
          roomId: id,
          from: { uuid: ws.uuid, nickname: ws.nickname }
        }));
        break;
      }

      case 'accept-call': {
        const room = rooms.get(msg.roomId);
        if (!room) return;
        room.guest = ws;
        ws.roomId = msg.roomId;
        ws.send(JSON.stringify({ type: 'room-joined', roomId: msg.roomId }));
        room.host.send(JSON.stringify({ type: 'peer-joined', nickname: ws.nickname || 'Anonymous' }));
        break;
      }

      case 'decline-call': {
        const room = rooms.get(msg.roomId);
        if (room) {
          room.host.send(JSON.stringify({ type: 'call-declined' }));
          rooms.delete(msg.roomId);
        }
        break;
      }

      /* ── signaling relay ── */
      case 'signal': {
        const room = rooms.get(ws.roomId);
        if (!room) return;
        const target = room.host === ws ? room.guest : room.host;
        if (target && target.readyState === 1) {
          target.send(JSON.stringify({ type: 'signal', data: msg.data }));
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (ws.uuid) peers.delete(ws.uuid);
    if (ws.roomId) {
      const room = rooms.get(ws.roomId);
      if (room) {
        const other = room.host === ws ? room.guest : room.host;
        if (other && other.readyState === 1) {
          other.send(JSON.stringify({ type: 'peer-left' }));
        }
        rooms.delete(ws.roomId);
      }
    }
  });
});

// keep-alive ping
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🐟 FishCall server running → http://localhost:${PORT}`);
});
