const express = require('express');
const config = require('../config/env');
const requireAuth = require('../middlewares/auth');
const pharmaciesController = require('../controllers/pharmacies.controller');

const pharmaciesRouter = express.Router();

pharmaciesRouter.get('/', pharmaciesController.getAll);
pharmaciesRouter.get('/mine', requireAuth, pharmaciesController.getMine);
pharmaciesRouter.get('/:id', pharmaciesController.getById);
pharmaciesRouter.post('/mine', requireAuth, pharmaciesController.registerMyPharmacy);

// Deployment guard: catalogue writes are not registered in production.
// Accounts and holds are separate; never expose these writes publicly.
if (config.nodeEnv !== 'production') {
  pharmaciesRouter.post('/', pharmaciesController.createPharmacy);
}

module.exports = pharmaciesRouter;
