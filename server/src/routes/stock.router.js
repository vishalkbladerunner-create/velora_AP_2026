const express = require('express');
const config = require('../config/env');
const stockController = require('../controllers/stock.controller');

const stockRouter = express.Router();

stockRouter.get('/', stockController.getAll);

// Deployment guard: catalogue writes are not registered in production.
// Accounts and holds are separate; never expose these writes publicly.
if (config.nodeEnv !== 'production') {
  stockRouter.post('/', stockController.createStock);
  stockRouter.put('/:id', stockController.updateStock);
  stockRouter.delete('/:id', stockController.deleteStock);
}

module.exports = stockRouter;
