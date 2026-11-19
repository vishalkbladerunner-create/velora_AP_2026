const express = require('express');
const config = require('../config/env');
const medicinesController = require('../controllers/medicines.controller');

const medicinesRouter = express.Router();

medicinesRouter.get('/', medicinesController.getAll);
medicinesRouter.get('/:id', medicinesController.getById);

// Deployment guard: catalogue writes are not registered in production.
// Accounts and holds are separate; never expose these writes publicly.
if (config.nodeEnv !== 'production') {
  medicinesRouter.post('/', medicinesController.createMedicine);
  medicinesRouter.put('/:id', medicinesController.updateMedicine);
  medicinesRouter.delete('/:id', medicinesController.deleteMedicine);
}

module.exports = medicinesRouter;
