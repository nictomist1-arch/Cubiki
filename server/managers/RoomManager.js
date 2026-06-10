import { applyProfile, getPlayerRadius, sanitizeRoomCode, spawnPosition, clamp } from '../utils/game.js';
import { BOUNDS, PUSH_COOLDOWN_MS, PUSH_RADIUS, PUSH_STRENGTH } from '../config/constants.js';

/** Управление онлайн-игроками и комнатами в памяти */
export class RoomManager {
  constructor() {
    this.players = new Map();
    this.pushCooldown = new Map();
  }

  getPlayersInRoom(roomId) {
    const result = {};
    for (const [id, player] of this.players) {
      if (player.roomId === roomId) result[id] = player;
    }
    return result;
  }

  getRoomsList() {
    const counts = new Map();
    for (const player of this.players.values()) {
      counts.set(player.roomId, (counts.get(player.roomId) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, name: id, players: count }))
      .sort((a, b) => b.players - a.players || a.id.localeCompare(b.id));
  }

  removePlayer(socket) {
    const player = this.players.get(socket.id);
    if (!player) return null;

    const roomId = player.roomId;
    this.players.delete(socket.id);
    this.pushCooldown.delete(socket.id);
    socket.leave(roomId);
    socket.data.roomId = null;
    return roomId;
  }

  joinRoom(socket, code, profile, accountProfile) {
    if (socket.data.roomId) {
      this.removePlayer(socket);
    }

    const roomId = sanitizeRoomCode(code || 'lobby');
    const roomPlayers = Object.values(this.getPlayersInRoom(roomId));
    const spawn = spawnPosition(roomPlayers);

    const player = {
      id: socket.id,
      roomId,
      userId: socket.data.user?.id || null,
      name: accountProfile?.displayName || `Игрок ${roomPlayers.length + 1}`,
      x: spawn.x,
      z: spawn.z,
      y: spawn.y,
      rotY: spawn.rotY,
      color: accountProfile?.profile?.color ?? spawn.color,
      shape: accountProfile?.profile?.shape ?? 'cube',
      size: accountProfile?.profile?.size ?? 1,
    };

    applyProfile(player, profile);
    if (accountProfile?.profile) {
      applyProfile(player, accountProfile.profile);
    }
    if (profile?.name) {
      player.name = String(profile.name).trim().slice(0, 20) || player.name;
    }

    this.players.set(socket.id, player);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.sessionStart = Date.now();
    socket.data.pushCount = 0;

    return { roomId, player };
  }

  getPlayer(socketId) {
    return this.players.get(socketId);
  }

  updateProfile(socketId, profile) {
    const p = this.players.get(socketId);
    if (!p) return null;
    applyProfile(p, profile);
    return p;
  }

  handlePush(socketId) {
    const pusher = this.players.get(socketId);
    if (!pusher) return { pushed: [], pusher: null };

    const pushed = [];
    for (const [id, target] of this.players) {
      if (id === socketId || target.roomId !== pusher.roomId) continue;

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
        this.pushCooldown.set(id, Date.now() + PUSH_COOLDOWN_MS);
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

    return { pushed, pusher };
  }

  isPushBlocked(socketId) {
    const until = this.pushCooldown.get(socketId);
    return until && Date.now() < until;
  }
}
