const express = require('express');
const config = require('../config/env');
const requireAuth = require('../middlewares/auth').requireAuth;
const { requirePermission } = require('../auth/permissions');
const pharmaciesController = require('../controllers/pharmacies.controller');

const pharmaciesRouter = express.Router();

pharmaciesRouter.get('/', requireAuth, pharmaciesController.getAll);
pharmaciesRouter.get('/mine', requireAuth, requirePermission('pharmacy:manage'), pharmaciesController.getMine);
pharmaciesRouter.put('/mine', requireAuth, requirePermission('pharmacy:manage'), pharmaciesController.updateMine);
pharmaciesRouter.get('/:id', pharmaciesController.getById);
pharmaciesRouter.post('/mine', requireAuth, requirePermission('pharmacy:manage'), pharmaciesController.registerMyPharmacy);

// Deployment guard: catalogue writes are not registered in production.
// Accounts and holds are separate; never expose these writes publicly.
if (config.nodeEnv !== 'production') {
  pharmaciesRouter.post('/', pharmaciesController.createPharmacy);
}

module.exports = pharmaciesRouter;
