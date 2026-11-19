const express = require('express');
const config = require('../config/env');
const pharmaciesController = require('../controllers/pharmacies.controller');

const catalogueRouter = express.Router();

// Development-only catalogue fixture. It is not mounted in production.
if (config.nodeEnv !== 'production') {
  catalogueRouter.post('/pharmacies', pharmaciesController.createVerifiedPharmacy);
}

module.exports = catalogueRouter;
