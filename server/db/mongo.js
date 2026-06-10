import mongoose from 'mongoose';
import { UserModel } from '../models/User.js';

export const mongoStore = {
  async connect(uri) {
    await mongoose.connect(uri);
    console.log('  БД: MongoDB');
  },

  async findByUsername(username) {
    const doc = await UserModel.findOne({ username: username.toLowerCase() }).lean();
    if (!doc) return null;
    return { ...doc, id: doc._id.toString() };
  },

  async findById(id) {
    const doc = await UserModel.findById(id).lean();
    if (!doc) return null;
    return { ...doc, id: doc._id.toString() };
  },

  async createUser({ username, passwordHash, displayName }) {
    try {
      const doc = await UserModel.create({
        username: username.toLowerCase(),
        passwordHash,
        displayName: displayName || username,
      });
      return { ...doc.toObject(), id: doc._id.toString() };
    } catch (err) {
      if (err.code === 11000) {
        const duplicate = new Error('Пользователь уже существует');
        duplicate.code = 'DUPLICATE';
        throw duplicate;
      }
      throw err;
    }
  },

  async updateUser(id, patch) {
    const doc = await UserModel.findByIdAndUpdate(id, patch, { new: true }).lean();
    if (!doc) return null;
    return { ...doc, id: doc._id.toString() };
  },

  toPublicUser(user) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      coins: user.coins,
      ownedShapes: user.ownedShapes,
      profile: user.profile,
      stats: user.stats,
    };
  },
};
