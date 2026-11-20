const express = require('express');
const config = require('../config/env');
const requireAuth = require('../middlewares/auth').requireAuth;
const { requirePermission } = require('../auth/permissions');
const stockController = require('../controllers/stock.controller');

const stockRouter = express.Router();

stockRouter.get('/', stockController.getAll);

// Deployment guard: catalogue writes are not registered in production.
// RBAC grants stock:write; an ABAC ownership check in the controller narrows it
// to the pharmacy the account actually owns.
if (config.nodeEnv !== 'production') {
  stockRouter.post('/', requireAuth, requirePermission('stock:write'), stockController.createStock);
  stockRouter.put('/:id', requireAuth, requirePermission('stock:write'), stockController.updateStock);
  stockRouter.delete('/:id', requireAuth, requirePermission('stock:write'), stockController.deleteStock);
}

module.exports = stockRouter;
