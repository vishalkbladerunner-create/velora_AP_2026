const express = require('express');
const config = require('../config/env');
const pharmaciesController = require('../controllers/pharmacies.controller');

const pharmaciesRouter = express.Router();

pharmaciesRouter.get('/', pharmaciesController.getAll);
pharmaciesRouter.get('/:id', pharmaciesController.getById);

// Deployment guard: catalogue writes are not registered in production.
// Accounts and holds are separate; never expose these writes publicly.
if (config.nodeEnv !== 'production') {
  pharmaciesRouter.post('/', pharmaciesController.createPharmacy);
}

module.exports = pharmaciesRouter;
