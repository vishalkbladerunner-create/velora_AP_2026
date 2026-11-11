const express = require('express');
const config = require('../config/env');
const pharmaciesController = require('../controllers/pharmacies.controller');

const pharmaciesRouter = express.Router();

pharmaciesRouter.get('/', pharmaciesController.getAll);
pharmaciesRouter.get('/:id', pharmaciesController.getById);

// Creating a pharmacy has no authentication, so it exists only outside production.
if (config.nodeEnv !== 'production') {
  pharmaciesRouter.post('/', pharmaciesController.createPharmacy);
}

module.exports = pharmaciesRouter;
