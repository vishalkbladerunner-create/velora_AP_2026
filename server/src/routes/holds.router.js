const express = require('express');
const requireAuth = require('../middlewares/auth');
const holdsController = require('../controllers/holds.controller');

const holdsRouter = express.Router();

// Router-level middleware: every hold route needs a session.
holdsRouter.use(requireAuth);

holdsRouter.get('/', holdsController.getHolds);
holdsRouter.post('/', holdsController.createHold);
holdsRouter.delete('/:id', holdsController.cancelHold);

module.exports = holdsRouter;
