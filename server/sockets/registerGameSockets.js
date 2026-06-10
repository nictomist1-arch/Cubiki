import { verifyToken } from '../utils/jwt.js';
import { userService } from '../services/UserService.js';

/**
 * Регистрирует обработчики Socket.io для игровых событий
 * @param {import('socket.io').Server} io
 * @param {import('../managers/RoomManager.js').RoomManager} roomManager
 */
export function registerGameSockets(io, roomManager) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next();

    try {
      const payload = verifyToken(token);
      const user = await userService.getById(payload.sub);
      if (user) socket.data.user = user;
    } catch {
      // гость
    }
    next();
  });

  io.on('connection', (socket) => {
    socket.data.roomId = null;

    socket.on('joinRoom', async (payload) => {
      const data = typeof payload === 'object' && payload ? payload : {};
      const code = data.code ?? socket.handshake.query?.room;
      const profile = data.profile;

      const oldRoom = socket.data.roomId;
      if (oldRoom) {
        roomManager.removePlayer(socket);
        socket.to(oldRoom).emit('playerLeft', socket.id);
        io.emit('roomsUpdated', roomManager.getRoomsList());
      }

      const account = socket.data.user || null;
      const { roomId, player } = roomManager.joinRoom(socket, code, profile, account);

      socket.emit('init', {
        id: socket.id,
        roomId,
        players: roomManager.getPlayersInRoom(roomId),
        account: account
          ? { coins: account.coins, ownedShapes: account.ownedShapes }
          : null,
      });
      socket.to(roomId).emit('playerJoined', player);
      io.emit('roomsUpdated', roomManager.getRoomsList());
    });

    socket.on('setProfile', async (profile) => {
      const p = roomManager.updateProfile(socket.id, profile);
      if (!p) return;

      if (socket.data.user) {
        try {
          const updated = await userService.updateProfile(socket.data.user.id, {
            displayName: profile.name,
            color: profile.color,
            shape: profile.shape,
            size: profile.size,
          });
          socket.data.user = updated;
          socket.emit('accountUpdated', {
            coins: updated.coins,
            ownedShapes: updated.ownedShapes,
          });
        } catch (err) {
          socket.emit('profileError', { error: err.message });
        }
      }

      io.to(p.roomId).emit('playerUpdated', p);
    });

    socket.on('chatMessage', (text) => {
      const p = roomManager.getPlayer(socket.id);
      if (!p) return;
      const message = String(text).trim().slice(0, 120);
      if (!message) return;

      socket.to(p.roomId).emit('chatMessage', {
        id: socket.id,
        name: p.name,
        color: p.color,
        text: message,
        time: Date.now(),
      });
    });

    socket.on('playerMove', (data) => {
      const p = roomManager.getPlayer(socket.id);
      if (!p || roomManager.isPushBlocked(socket.id)) return;
      p.x = data.x;
      p.z = data.z;
      p.y = data.y;
      p.rotY = data.rotY;
      socket.to(p.roomId).emit('playerMoved', { id: socket.id, ...data });
    });

    socket.on('playerAction', (action) => {
      const p = roomManager.getPlayer(socket.id);
      if (!p) return;
      io.to(p.roomId).emit('playerAction', { id: socket.id, action, time: Date.now() });
    });

    socket.on('playerPush', () => {
      const { pushed, pusher } = roomManager.handlePush(socket.id);
      if (!pusher) return;

      if (pushed.length > 0) {
        socket.data.pushCount = (socket.data.pushCount || 0) + pushed.length;
        io.to(pusher.roomId).emit('playersPushed', { from: socket.id, players: pushed });
      }
      io.to(pusher.roomId).emit('playerAction', { id: socket.id, action: 'push', time: Date.now() });
    });

    socket.on('disconnect', async () => {
      const p = roomManager.getPlayer(socket.id);
      const roomId = roomManager.removePlayer(socket);

      if (socket.data.user && p) {
        try {
          const result = await userService.saveSessionProgress(socket.data.user.id, {
            profile: { color: p.color, shape: p.shape, size: p.size },
            pushes: socket.data.pushCount || 0,
          });
          // клиент уже отключён — прогресс сохранён в БД
          if (result) {
            console.log(`  Сессия сохранена: ${socket.data.user.username} (+${result.coinsEarned} монет)`);
          }
        } catch (err) {
          console.error('  Ошибка сохранения сессии:', err.message);
        }
      }

      if (roomId) {
        io.to(roomId).emit('playerLeft', socket.id);
        io.emit('roomsUpdated', roomManager.getRoomsList());
      }
    });
  });
}
