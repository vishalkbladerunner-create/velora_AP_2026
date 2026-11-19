// Session guard: every hold route needs a logged-in user.
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  next();
}

module.exports = requireAuth;
