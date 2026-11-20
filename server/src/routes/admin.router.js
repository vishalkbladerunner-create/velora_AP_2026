const express = require('express');
const requireAuth = require('../middlewares/auth').requireAuth;
const { requirePermission } = require('../auth/permissions');
const adminController = require('../controllers/admin.controller');
const asyncHandler = require('../utils/asyncHandler');

const adminRouter = express.Router();

adminRouter.use(requireAuth, requirePermission('admin:access'));

adminRouter.get('/overview', asyncHandler(adminController.overview));
adminRouter.get('/pharmacies', asyncHandler(adminController.listPharmacies));
adminRouter.post('/pharmacies', asyncHandler(adminController.createPharmacy));
adminRouter.patch('/pharmacies/:id', asyncHandler(adminController.updatePharmacyStatus));
adminRouter.get('/users', asyncHandler(adminController.listUsers));
adminRouter.get('/audit', asyncHandler(adminController.listAudit));
adminRouter.get('/runtime', asyncHandler(adminController.runtimeSnapshot));

adminRouter.post('/stock/bulk', asyncHandler(adminController.bulkStock));
adminRouter.get('/export/stock.csv', asyncHandler(adminController.exportStockCsv));

adminRouter.get('/oauth-clients', asyncHandler(adminController.listOAuthClients));
adminRouter.post('/oauth-clients', asyncHandler(adminController.createOAuthClient));

module.exports = adminRouter;
