const express = require('express');
const healthController = require('../controllers/health.controller');

const healthRouter = express.Router();

healthRouter.get('/', healthController.getHealth);

module.exports = healthRouter;
