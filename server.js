import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const COLORS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0xa855f7, 0x3b82f6, 0xf97316, 0x22c55e, 0xec4899];
const BOUNDS = 9;
const PUSH_RADIUS = 4;
const PUSH_STRENGTH = 4;
const PUSH_COOLDOWN_MS = 600;

const players = new Map();
const pushCooldown = new Map();

function getPlayerRadius(size = 1) {
  return size * 0.55;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getLocalAddresses() {
  const addresses = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const cfg of iface) {
      if (cfg.family === 'IPv4' && !cfg.internal) {
        addresses.push(cfg.address);
      }
    }
  }
  return addresses;
}

function sanitizeRoomCode(code) {
  const cleaned = String(code ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 16);
  return cleaned || 'lobby';
}

function getPlayersInRoom(roomId) {
  const result = {};
  for (const [id, player] of players) {
    if (player.roomId === roomId) {
      result[id] = player;
    }
  }
  return result;
}

function getRoomsList() {
  const counts = new Map();
  for (const player of players.values()) {
    counts.set(player.roomId, (counts.get(player.roomId) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([id, count]) => ({ id, name: id, players: count }))
    .sort((a, b) => b.players - a.players || a.id.localeCompare(b.id));
}

function spawnPosition(roomId) {
  const roomPlayers = Object.values(getPlayersInRoom(roomId));
  const angle = Math.random() * Math.PI * 2;
  const radius = 2 + Math.random() * 4;
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
    y: 0.5,
    rotY: 0,
    color: COLORS[roomPlayers.length % COLORS.length],
  };
}

function applyProfile(player, profile = {}) {
  if (profile.name) {
    player.name = String(profile.name).trim().slice(0, 20) || player.name;
  }
  if (profile.color !== undefined) {
    const c = Number(profile.color);
    if (!Number.isNaN(c)) player.color = c;
  }
  if (['cube', 'sphere', 'diamond', 'cylinder'].includes(profile.shape)) {
    player.shape = profile.shape;
  }
  if (profile.size !== undefined) {
    player.size = Math.max(0.7, Math.min(1.5, Number(profile.size) || 1));
  }
}

function removePlayer(socket) {
  const player = players.get(socket.id);
  if (!player) return null;

  const roomId = player.roomId;
  players.delete(socket.id);
  pushCooldown.delete(socket.id);
  socket.leave(roomId);
  socket.data.roomId = null;
  return roomId;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

const distPath = path.join(__dirname, 'dist');
const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

app.get('/api/info', (req, res) => {
  res.json({
    port: PORT,
    urls: getLocalAddresses().map((ip) => `http://${ip}:${PORT}`),
  });
});

app.get('/api/rooms', (req, res) => {
  res.json({ rooms: getRoomsList() });
});

if (hasDist) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/socket.io') || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

io.on('connection', (socket) => {
  socket.data.roomId = null;

  socket.on('joinRoom', (payload) => {
    const data = typeof payload === 'object' && payload ? payload : {};
    const code = data.code ?? socket.handshake.query?.room;
    const profile = data.profile;

    if (socket.data.roomId) {
      const oldRoom = removePlayer(socket);
      if (oldRoom) {
        socket.to(oldRoom).emit('playerLeft', socket.id);
        io.emit('roomsUpdated', getRoomsList());
      }
    }

    const roomId = sanitizeRoomCode(code || 'lobby');
    const spawn = spawnPosition(roomId);
    const roomCount = Object.keys(getPlayersInRoom(roomId)).length;

    const player = {
      id: socket.id,
      roomId,
      name: `Игрок ${roomCount + 1}`,
      x: spawn.x,
      z: spawn.z,
      y: spawn.y,
      rotY: spawn.rotY,
      color: spawn.color,
      shape: 'cube',
      size: 1,
    };

    applyProfile(player, profile);
    players.set(socket.id, player);
    socket.join(roomId);
    socket.data.roomId = roomId;

    socket.emit('init', {
      id: socket.id,
      roomId,
      players: getPlayersInRoom(roomId),
    });
    socket.to(roomId).emit('playerJoined', player);
    io.emit('roomsUpdated', getRoomsList());
  });

  socket.on('setProfile', (profile) => {
    const p = players.get(socket.id);
    if (!p) return;
    applyProfile(p, profile);
    io.to(p.roomId).emit('playerUpdated', p);
  });

  socket.on('chatMessage', (text) => {
    const p = players.get(socket.id);
    if (!p) return;
    const message = String(text).trim().slice(0, 120);
    if (!message) return;

    const payload = {
      id: socket.id,
      name: p.name,
      color: p.color,
      text: message,
      time: Date.now(),
    };
    socket.to(p.roomId).emit('chatMessage', payload);
  });

  socket.on('playerMove', (data) => {
    const p = players.get(socket.id);
    if (!p) return;
    const until = pushCooldown.get(socket.id);
    if (until && Date.now() < until) return;
    p.x = data.x;
    p.z = data.z;
    p.y = data.y;
    p.rotY = data.rotY;
    socket.to(p.roomId).emit('playerMoved', { id: socket.id, ...data });
  });

  socket.on('playerAction', (action) => {
    const p = players.get(socket.id);
    if (!p) return;
    io.to(p.roomId).emit('playerAction', { id: socket.id, action, time: Date.now() });
  });

  socket.on('playerPush', () => {
    const pusher = players.get(socket.id);
    if (!pusher) return;

    const pushed = [];
    for (const [id, target] of players) {
      if (id === socket.id || target.roomId !== pusher.roomId) continue;

      let dx = target.x - pusher.x;
      let dz = target.z - pusher.z;
      let dist = Math.hypot(dx, dz);
      const reach = PUSH_RADIUS + getPlayerRadius(pusher.size) + getPlayerRadius(target.size);

      if (dist < reach) {
        if (dist < 0.01) {
          dx = 1;
          dz = 0;
          dist = 1;
        }
        const power = PUSH_STRENGTH * (1 - dist / reach);
        const nx = (dx / dist) * power;
        const nz = (dz / dist) * power;
        const fromX = target.x;
        const fromZ = target.z;
        target.x = clamp(target.x + nx, -BOUNDS, BOUNDS);
        target.z = clamp(target.z + nz, -BOUNDS, BOUNDS);
        pushCooldown.set(id, Date.now() + PUSH_COOLDOWN_MS);
        pushed.push({
          id,
          fromX,
          fromZ,
          x: target.x,
          z: target.z,
          y: target.y,
          rotY: target.rotY,
        });
      }
    }

    if (pushed.length > 0) {
      io.to(pusher.roomId).emit('playersPushed', { from: socket.id, players: pushed });
    }
    io.to(pusher.roomId).emit('playerAction', { id: socket.id, action: 'push', time: Date.now() });
  });

  socket.on('disconnect', () => {
    const roomId = removePlayer(socket);
    if (roomId) {
      io.to(roomId).emit('playerLeft', socket.id);
      io.emit('roomsUpdated', getRoomsList());
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Cubiki — мультиплеер запущен!\n`);
  console.log(`  Локально:    http://localhost:${PORT}`);
  for (const ip of getLocalAddresses()) {
    console.log(`  В сети:      http://${ip}:${PORT}`);
  }
  console.log(`\n  Откройте ссылку «В сети» на телефоне в той же Wi‑Fi сети.`);
  console.log(`  Если телефон не подключается — разрешите порт ${PORT} в брандмауэре Windows.\n`);
});
