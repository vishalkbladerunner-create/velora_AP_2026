const express = require('express');
const config = require('../config/env');
const pharmaciesController = require('../controllers/pharmacies.controller');

const pharmaciesRouter = express.Router();

pharmaciesRouter.get('/', pharmaciesController.getAll);
pharmaciesRouter.get('/:id', pharmaciesController.getById);

// Deployment guard, not authentication: these routes are not registered in
// production. The API has no accounts; never expose it publicly.
if (config.nodeEnv !== 'production') {
  pharmaciesRouter.post('/', pharmaciesController.createPharmacy);
}

module.exports = pharmaciesRouter;
