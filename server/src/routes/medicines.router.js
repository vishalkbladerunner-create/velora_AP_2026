const express = require('express');
const config = require('../config/env');
const medicinesController = require('../controllers/medicines.controller');

const medicinesRouter = express.Router();

medicinesRouter.get('/', medicinesController.getAll);
medicinesRouter.get('/:id', medicinesController.getById);

// Deployment guard, not authentication: these routes are not registered in
// production. The API has no accounts; never expose it publicly.
if (config.nodeEnv !== 'production') {
  medicinesRouter.post('/', medicinesController.createMedicine);
  medicinesRouter.put('/:id', medicinesController.updateMedicine);
  medicinesRouter.delete('/:id', medicinesController.deleteMedicine);
}

module.exports = medicinesRouter;
