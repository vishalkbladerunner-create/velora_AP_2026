const express = require('express');
const config = require('../config/env');
const requireAuth = require('../middlewares/auth').requireAuth;
const { requirePermission } = require('../auth/permissions');
const medicinesController = require('../controllers/medicines.controller');

const medicinesRouter = express.Router();

medicinesRouter.get('/', medicinesController.getAll);
medicinesRouter.get('/:id', medicinesController.getById);

// Deployment guard: catalogue writes are not registered in production.
// RBAC: a pharmacy or admin account may maintain the shared medicine list.
if (config.nodeEnv !== 'production') {
  medicinesRouter.post('/', requireAuth, requirePermission('medicine:write'), medicinesController.createMedicine);
  medicinesRouter.put('/:id', requireAuth, requirePermission('medicine:write'), medicinesController.updateMedicine);
  medicinesRouter.delete('/:id', requireAuth, requirePermission('medicine:write'), medicinesController.deleteMedicine);
}

module.exports = medicinesRouter;
