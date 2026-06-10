import { userService } from '../services/UserService.js';

export const authController = {
  async register(req, res, next) {
    try {
      const result = await userService.register(req.body);
      res.status(201).json(result);
    } catch (err) {
      if (err.code === 'DUPLICATE') err.status = 409;
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const result = await userService.login(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async me(req, res) {
    res.json({ user: req.user });
  },

  async saveProfile(req, res, next) {
    try {
      const user = await userService.updateProfile(req.user.id, req.body);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
};
