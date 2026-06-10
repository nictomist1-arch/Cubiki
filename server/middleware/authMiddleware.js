import { verifyToken } from '../utils/jwt.js';
import { userService } from '../services/UserService.js';

/** Опциональная авторизация — не блокирует гостей */
export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = verifyToken(token);
    const user = await userService.getById(payload.sub);
    if (user) req.user = user;
  } catch {
    // гость
  }
  next();
}

/** Обязательная авторизация для защищённых маршрутов */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  try {
    const payload = verifyToken(token);
    const user = await userService.getById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}
