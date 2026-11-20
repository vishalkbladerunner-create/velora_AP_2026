const { verifyAccessToken } = require('../services/token.service');

// JWT guard: the Bearer access token carries the account id and role, so a
// request does not touch the session store.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = { id: Number(payload.sub), role: payload.role };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = { id: Number(payload.sub), role: payload.role };
  } catch (error) {
    req.user = null;
  }

  next();
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.optionalAuth = optionalAuth;
