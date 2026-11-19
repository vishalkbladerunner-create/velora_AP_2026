const express = require('express');
const config = require('../config/env');
const requireAuth = require('../middlewares/auth');
const stockController = require('../controllers/stock.controller');

const stockRouter = express.Router();

stockRouter.get('/', stockController.getAll);

// Deployment guard: catalogue writes are not registered in production.
// A signed-in owner may change only their own pharmacy's stock.
if (config.nodeEnv !== 'production') {
  stockRouter.post('/', requireAuth, stockController.createStock);
  stockRouter.put('/:id', requireAuth, stockController.updateStock);
  stockRouter.delete('/:id', requireAuth, stockController.deleteStock);
}

module.exports = stockRouter;
