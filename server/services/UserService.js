import bcrypt from 'bcryptjs';
import { getStore } from '../db/index.js';
import { signToken } from '../utils/jwt.js';
import { SHOP_ITEMS } from '../config/shop.js';
import { PUSH_COIN_REWARD, SESSION_COIN_REWARD } from '../config/constants.js';

const SALT_ROUNDS = 10;

export class UserService {
  toPublic(user) {
    return getStore().toPublicUser(user);
  }

  async register({ username, password, displayName }) {
    const name = String(username || '').trim().toLowerCase();
    const pass = String(password || '');

    if (name.length < 3 || name.length > 20) {
      throw Object.assign(new Error('Логин: от 3 до 20 символов'), { status: 400 });
    }
    if (!/^[a-z0-9_]+$/.test(name)) {
      throw Object.assign(new Error('Логин: только латиница, цифры и _'), { status: 400 });
    }
    if (pass.length < 4) {
      throw Object.assign(new Error('Пароль: минимум 4 символа'), { status: 400 });
    }

    const passwordHash = await bcrypt.hash(pass, SALT_ROUNDS);
    const user = await getStore().createUser({ username: name, passwordHash, displayName });
    const token = signToken({ id: user.id, username: user.username });
    return { token, user: this.toPublic(user) };
  }

  async login({ username, password }) {
    const name = String(username || '').trim().toLowerCase();
    const user = await getStore().findByUsername(name);
    if (!user) {
      throw Object.assign(new Error('Неверный логин или пароль'), { status: 401 });
    }

    const ok = await bcrypt.compare(String(password || ''), user.passwordHash);
    if (!ok) {
      throw Object.assign(new Error('Неверный логин или пароль'), { status: 401 });
    }

    const token = signToken({ id: user.id, username: user.username });
    return { token, user: this.toPublic(user) };
  }

  async getById(id) {
    const user = await getStore().findById(id);
    return user ? this.toPublic(user) : null;
  }

  async saveSessionProgress(userId, { profile, pushes = 0 }) {
    const user = await getStore().findById(userId);
    if (!user) return null;

    const coinsEarned = SESSION_COIN_REWARD + pushes * PUSH_COIN_REWARD;
    const updated = await getStore().updateUser(userId, {
      profile: profile || user.profile,
      coins: user.coins + coinsEarned,
      stats: {
        sessionsPlayed: (user.stats?.sessionsPlayed || 0) + 1,
        totalPushes: (user.stats?.totalPushes || 0) + pushes,
        coinsEarned: (user.stats?.coinsEarned || 0) + coinsEarned,
      },
    });

    return { user: this.toPublic(updated), coinsEarned };
  }

  async updateProfile(userId, profile) {
    const user = await getStore().findById(userId);
    if (!user) return null;

    const shape = profile.shape ?? user.profile.shape;
    if (!user.ownedShapes.includes(shape)) {
      throw Object.assign(new Error('Форма не куплена'), { status: 403 });
    }

    const nextProfile = {
      color: profile.color ?? user.profile.color,
      shape,
      size: profile.size ?? user.profile.size,
    };

    const updated = await getStore().updateUser(userId, {
      profile: nextProfile,
      displayName: profile.displayName || user.displayName,
    });
    return this.toPublic(updated);
  }

  getShopItems() {
    return SHOP_ITEMS;
  }

  async buyItem(userId, itemId) {
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) {
      throw Object.assign(new Error('Товар не найден'), { status: 404 });
    }

    const user = await getStore().findById(userId);
    if (!user) {
      throw Object.assign(new Error('Пользователь не найден'), { status: 404 });
    }
    if (user.coins < item.price) {
      throw Object.assign(new Error('Недостаточно монет'), { status: 400 });
    }

    if (item.type === 'shape' && user.ownedShapes.includes(item.value)) {
      throw Object.assign(new Error('Форма уже куплена'), { status: 400 });
    }

    const patch = { coins: user.coins - item.price };
    if (item.type === 'shape') {
      patch.ownedShapes = [...user.ownedShapes, item.value];
    }

    const updated = await getStore().updateUser(userId, patch);
    return { user: this.toPublic(updated), item };
  }
}

export const userService = new UserService();
