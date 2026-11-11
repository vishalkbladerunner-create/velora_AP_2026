const express = require('express');
const config = require('../config/env');
const medicinesController = require('../controllers/medicines.controller');

const medicinesRouter = express.Router();

medicinesRouter.get('/', medicinesController.getAll);
medicinesRouter.get('/:id', medicinesController.getById);

// Writes have no authentication, so they exist only outside production.
// With NODE_ENV=production these paths fall through to the terminal 404.
if (config.nodeEnv !== 'production') {
  medicinesRouter.post('/', medicinesController.createMedicine);
  medicinesRouter.put('/:id', medicinesController.updateMedicine);
  medicinesRouter.delete('/:id', medicinesController.deleteMedicine);
}

module.exports = medicinesRouter;
