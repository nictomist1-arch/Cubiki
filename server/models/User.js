import mongoose from 'mongoose';
import { DEFAULT_OWNED_SHAPES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, default: 'Игрок' },
    coins: { type: Number, default: 50 },
    ownedShapes: { type: [String], default: DEFAULT_OWNED_SHAPES },
    profile: {
      color: { type: Number, default: 0x4ecdc4 },
      shape: { type: String, default: 'cube' },
      size: { type: Number, default: 1 },
    },
    stats: {
      sessionsPlayed: { type: Number, default: 0 },
      totalPushes: { type: Number, default: 0 },
      coinsEarned: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

export const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
