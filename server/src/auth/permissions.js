// Role-based access control: roles map to a fixed permission set, and routes
// ask for a permission rather than a role name.
const CUSTOMER_PERMISSIONS = [
  'profile:read',
  'profile:update',
  'pharmacy:read',
  'medicine:read',
  'stock:read',
  'hold:create',
  'hold:read',
  'hold:cancel',
];

const PHARMACY_PERMISSIONS = CUSTOMER_PERMISSIONS.concat([
  'medicine:write',
  'stock:write',
  'pharmacy:manage',
]);

const ROLE_PERMISSIONS = {
  CUSTOMER: CUSTOMER_PERMISSIONS,
  PHARMACY: PHARMACY_PERMISSIONS,
  ADMIN: ['*'],
};

const ROLES = Object.keys(ROLE_PERMISSIONS);

function permissionsFor(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(role, permission) {
  if (role === 'ADMIN') {
    return true;
  }

  return permissionsFor(role).indexOf(permission) !== -1;
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!hasPermission(req.user.role, permission)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

function requireRole() {
  const allowed = Array.prototype.slice.call(arguments);

  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (allowed.indexOf(req.user.role) === -1) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

module.exports = {
  ROLES,
  ROLE_PERMISSIONS,
  permissionsFor,
  hasPermission,
  requirePermission,
  requireRole,
};
