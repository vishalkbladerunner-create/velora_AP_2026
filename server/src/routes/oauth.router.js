const express = require('express');
const oauthController = require('../controllers/oauth.controller');

const oauthRouter = express.Router();

oauthRouter.get('/authorize', oauthController.authorizePage);
oauthRouter.post('/authorize', oauthController.authorizeDecision);
oauthRouter.post('/token', oauthController.token);
oauthRouter.get('/userinfo', oauthController.userinfo);
oauthRouter.get('/jwks', oauthController.jwks);

module.exports = oauthRouter;
