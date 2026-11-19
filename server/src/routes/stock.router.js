const express = require('express');
const config = require('../config/env');
const requireAuth = require('../middlewares/auth');
const requirePharmacy = require('../middlewares/pharmacy');
const stockController = require('../controllers/stock.controller');

const stockRouter = express.Router();

stockRouter.get('/', stockController.getAll);

// Deployment guard: catalogue writes are not registered in production.
// A signed-in pharmacy owner may change only their own stock.
if (config.nodeEnv !== 'production') {
  stockRouter.post('/', requireAuth, requirePharmacy, stockController.createStock);
  stockRouter.put('/:id', requireAuth, requirePharmacy, stockController.updateStock);
  stockRouter.delete('/:id', requireAuth, requirePharmacy, stockController.deleteStock);
}

module.exports = stockRouter;
