// Attribute-based checks: authorization decisions use record attributes
// (ownerId, userId, status) rather than the role alone.
function isAdmin(user) {
  return Boolean(user) && user.role === 'ADMIN';
}

function canManagePharmacy(user, pharmacy) {
  if (!user || !pharmacy) {
    return false;
  }

  return isAdmin(user) || pharmacy.ownerId === user.id;
}

function canCancelHold(user, hold) {
  if (!user || !hold) {
    return false;
  }

  return isAdmin(user) || hold.userId === user.id;
}

function canReadAccount(user, accountId) {
  if (!user) {
    return false;
  }

  return isAdmin(user) || user.id === accountId;
}

module.exports = {
  isAdmin,
  canManagePharmacy,
  canCancelHold,
  canReadAccount,
};
