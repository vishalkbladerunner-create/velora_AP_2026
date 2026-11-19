const express = require('express');
const config = require('../config/env');
const requireAuth = require('../middlewares/auth');
const requirePharmacy = require('../middlewares/pharmacy');
const pharmaciesController = require('../controllers/pharmacies.controller');

const pharmaciesRouter = express.Router();

pharmaciesRouter.get('/', requireAuth, pharmaciesController.getAll);
pharmaciesRouter.get('/mine', requireAuth, requirePharmacy, pharmaciesController.getMine);
pharmaciesRouter.put('/mine', requireAuth, requirePharmacy, pharmaciesController.updateMine);
pharmaciesRouter.get('/:id', pharmaciesController.getById);
pharmaciesRouter.post('/mine', requireAuth, requirePharmacy, pharmaciesController.registerMyPharmacy);

// Deployment guard: catalogue writes are not registered in production.
// Accounts and holds are separate; never expose these writes publicly.
if (config.nodeEnv !== 'production') {
  pharmaciesRouter.post('/', pharmaciesController.createPharmacy);
}

module.exports = pharmaciesRouter;
