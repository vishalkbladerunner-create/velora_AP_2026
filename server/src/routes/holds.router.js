const express = require('express');
const requireAuth = require('../middlewares/auth').requireAuth;
const { requirePermission } = require('../auth/permissions');
const holdsController = require('../controllers/holds.controller');

const holdsRouter = express.Router();

holdsRouter.get('/', requireAuth, requirePermission('hold:read'), holdsController.getHolds);
holdsRouter.post('/', requireAuth, requirePermission('hold:create'), holdsController.createHold);
holdsRouter.delete('/:id', requireAuth, requirePermission('hold:cancel'), holdsController.cancelHold);

module.exports = holdsRouter;
