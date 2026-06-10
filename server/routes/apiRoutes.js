import { Router } from 'express';
import { createApiController } from '../controllers/apiController.js';
import { shopController } from '../controllers/shopController.js';
import { optionalAuth, requireAuth } from '../middleware/authMiddleware.js';

export function createApiRoutes(roomManager) {
  const router = Router();
  const api = createApiController(roomManager);

  router.get('/info', api.info);
  router.get('/rooms', api.rooms);
  router.get('/shop', optionalAuth, shopController.list);
  router.post('/shop/buy', requireAuth, shopController.buy);

  return router;
}
