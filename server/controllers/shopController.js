import { userService } from '../services/UserService.js';

export const shopController = {
  list(req, res) {
    const items = userService.getShopItems();
    res.json({
      items,
      user: req.user || null,
    });
  },

  async buy(req, res, next) {
    try {
      const result = await userService.buyItem(req.user.id, req.body.itemId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
