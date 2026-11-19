// Pharmacy-owner guard. The account type is set at registration and cannot be
// supplied by a later request.
function requirePharmacy(req, res, next) {
  if (req.session.accountType !== 'PHARMACY') {
    res.status(403).json({ error: 'Pharmacy owners only' });
    return;
  }

  next();
}

module.exports = requirePharmacy;
