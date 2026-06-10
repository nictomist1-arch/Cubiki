import { COLORS } from '../config/constants.js';

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getPlayerRadius(size = 1) {
  return size * 0.55;
}

export function sanitizeRoomCode(code) {
  const cleaned = String(code ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 16);
  return cleaned || 'lobby';
}

export function applyProfile(player, profile = {}) {
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

export function spawnPosition(roomPlayers) {
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
