import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { DEFAULT_OWNED_SHAPES } from '../config/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'users.json');

function defaultDb() {
  return { users: {}, usernameIndex: {} };
}

function readDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb(), null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDb(db) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    coins: user.coins,
    ownedShapes: user.ownedShapes,
    profile: user.profile,
    stats: user.stats,
  };
}

function createUserRecord({ username, passwordHash, displayName }) {
  return {
    id: randomUUID(),
    username: username.toLowerCase(),
    passwordHash,
    displayName: displayName || username,
    coins: 50,
    ownedShapes: [...DEFAULT_OWNED_SHAPES],
    profile: { color: 0x4ecdc4, shape: 'cube', size: 1 },
    stats: { sessionsPlayed: 0, totalPushes: 0, coinsEarned: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const fileStore = {
  async connect() {
    readDb();
    console.log('  БД: локальный файл data/users.json');
  },

  async findByUsername(username) {
    const db = readDb();
    const id = db.usernameIndex[username.toLowerCase()];
    return id ? db.users[id] : null;
  },

  async findById(id) {
    const db = readDb();
    return db.users[id] || null;
  },

  async createUser({ username, passwordHash, displayName }) {
    const db = readDb();
    const key = username.toLowerCase();
    if (db.usernameIndex[key]) {
      const err = new Error('Пользователь уже существует');
      err.code = 'DUPLICATE';
      throw err;
    }
    const user = createUserRecord({ username, passwordHash, displayName });
    db.users[user.id] = user;
    db.usernameIndex[key] = user.id;
    writeDb(db);
    return user;
  },

  async updateUser(id, patch) {
    const db = readDb();
    const user = db.users[id];
    if (!user) return null;
    Object.assign(user, patch, { updatedAt: new Date().toISOString() });
    writeDb(db);
    return user;
  },

  toPublicUser,
};
