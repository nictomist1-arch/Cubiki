import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from './managers/RoomManager.js';
import { createApiRoutes } from './routes/apiRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { registerGameSockets } from './sockets/registerGameSockets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '../dist');

/**
 * Создаёт Express-приложение, HTTP-сервер и Socket.io
 */
export function createApp() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  const roomManager = new RoomManager();

  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api', createApiRoutes(roomManager));

  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
  if (hasDist) {
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.path.startsWith('/socket.io') || req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use(errorHandler);
  registerGameSockets(io, roomManager);

  return { app, httpServer, io, roomManager };
}
