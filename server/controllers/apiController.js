import { env } from '../config/env.js';
import { getDbDriver } from '../db/index.js';
import { getLocalAddresses } from '../utils/network.js';

export function createApiController(roomManager) {
  return {
    info(req, res) {
      res.json({
        port: env.port,
        db: getDbDriver(),
        urls: getLocalAddresses().map((ip) => `http://${ip}:${env.port}`),
      });
    },

    rooms(req, res) {
      res.json({ rooms: roomManager.getRoomsList() });
    },
  };
}
