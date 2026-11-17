const express = require('express');
const config = require('../config/env');
const stockController = require('../controllers/stock.controller');

const stockRouter = express.Router();

stockRouter.get('/', stockController.getAll);

// Deployment guard, not authentication: these routes do not exist in
// production. The API has no accounts; never expose it publicly.
if (config.nodeEnv !== 'production') {
  stockRouter.post('/', stockController.createStock);
  stockRouter.put('/:id', stockController.updateStock);
  stockRouter.delete('/:id', stockController.deleteStock);
}

module.exports = stockRouter;
