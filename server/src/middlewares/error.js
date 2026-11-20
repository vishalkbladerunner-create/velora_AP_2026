const AppError = require('../utils/AppError');

// Central error handler: controllers throw AppError (directly or through
// asyncHandler) and this middleware owns the response shape.
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const status = err.status || 500;

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err.message,
  });
}

module.exports = errorHandler;
module.exports.AppError = AppError;
