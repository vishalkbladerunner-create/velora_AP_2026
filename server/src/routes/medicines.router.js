const express = require('express');
const config = require('../config/env');
const requireAuth = require('../middlewares/auth');
const requirePharmacy = require('../middlewares/pharmacy');
const medicinesController = require('../controllers/medicines.controller');

const medicinesRouter = express.Router();

medicinesRouter.get('/', medicinesController.getAll);
medicinesRouter.get('/:id', medicinesController.getById);

// Deployment guard: catalogue writes are not registered in production.
// A signed-in pharmacy owner maintains the shared medicine list.
if (config.nodeEnv !== 'production') {
  medicinesRouter.post('/', requireAuth, requirePharmacy, medicinesController.createMedicine);
  medicinesRouter.put('/:id', requireAuth, requirePharmacy, medicinesController.updateMedicine);
  medicinesRouter.delete('/:id', requireAuth, requirePharmacy, medicinesController.deleteMedicine);
}

module.exports = medicinesRouter;
