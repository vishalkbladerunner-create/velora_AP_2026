const express = require('express');
const requireAuth = require('../middlewares/auth');
const authController = require('../controllers/auth.controller');

const authRouter = express.Router();

authRouter.post('/register', authController.register);
authRouter.post('/login', authController.login);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', authController.me);
authRouter.put('/me', requireAuth, authController.updateMe);

module.exports = authRouter;
