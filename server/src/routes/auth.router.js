const express = require('express');
const requireAuth = require('../middlewares/auth').requireAuth;
const authController = require('../controllers/auth.controller');

const authRouter = express.Router();

authRouter.post('/register', authController.register);
authRouter.post('/login', authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);

authRouter.get('/me', requireAuth, authController.me);
authRouter.put('/me', requireAuth, authController.updateMe);
authRouter.put('/password', requireAuth, authController.changePassword);
authRouter.post('/logout-all', requireAuth, authController.logoutAll);

authRouter.post('/mfa/setup', requireAuth, authController.mfaSetup);
authRouter.post('/mfa/enable', requireAuth, authController.mfaEnable);
authRouter.post('/mfa/disable', requireAuth, authController.mfaDisable);

module.exports = authRouter;
