import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Создаёт JWT для пользователя
 * @param {{ id: string, username: string }} user
 */
export function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, env.jwtSecret, { expiresIn: '7d' });
}

/**
 * Проверяет JWT и возвращает payload
 * @param {string} token
 */
export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
