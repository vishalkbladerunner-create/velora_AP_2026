const bcrypt = require('bcrypt');
const prisma = require('../db/prisma');
const audit = require('../services/audit.service');
const tokens = require('../services/token.service');
const totp = require('../services/totp.service');

const PHONE_PATTERN = /^[6-9][0-9]{9}$/;
const PUBLIC_ROLES = ['CUSTOMER', 'PHARMACY'];

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    address: user.address,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt,
  };
}

function tokenResponse(user) {
  return {
    user: publicUser(user),
    accessToken: tokens.signAccessToken(user),
    tokenType: 'Bearer',
    expiresIn: tokens.ACCESS_TTL_SECONDS,
  };
}

// POST /api/v1/auth/register
const register = async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  // accountType is accepted for older clients; role is the current name.
  const requestedRole = body.role === undefined ? body.accountType : body.role;
  const role = requestedRole === undefined ? 'CUSTOMER' : String(requestedRole);

  if (name.length < 2 || !PHONE_PATTERN.test(phone) || address.length < 5 ||
      password.length < 8 || password.length > 72 ||
      PUBLIC_ROLES.indexOf(role) === -1) {
    res.status(400).json({
      error: 'Provide a name, a 10-digit mobile number, an address, a password of 8 to 72 characters, and a valid role',
    });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { phone: phone } });

  if (existing) {
    res.status(400).json({ error: 'Phone number already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: name,
      phone: phone,
      address: address,
      passwordHash: passwordHash,
      role: role,
    },
    select: { id: true, name: true, phone: true, address: true, role: true, mfaEnabled: true, createdAt: true },
  });

  const refresh = await tokens.issueRefreshToken(user.id);
  tokens.setRefreshCookie(res, refresh.token);
  audit.record('auth.register', {
    actorId: user.id,
    entity: 'User',
    entityId: user.id,
    metadata: { role: role },
  });

  res.status(201).json(tokenResponse(user));
};

// POST /api/v1/auth/login
const login = async (req, res) => {
  const body = req.body || {};
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!PHONE_PATTERN.test(phone) || password.length === 0) {
    res.status(401).json({ error: 'Invalid phone or password' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { phone: phone } });

  if (!user) {
    res.status(401).json({ error: 'Invalid phone or password' });
    return;
  }

  const matches = await bcrypt.compare(password, user.passwordHash);

  if (!matches) {
    audit.record('auth.login_failed', { entity: 'User', entityId: user.id });
    res.status(401).json({ error: 'Invalid phone or password' });
    return;
  }

  if (user.mfaEnabled) {
    const code = typeof body.totp === 'string' ? body.totp.trim() : '';

    if (!code) {
      res.status(401).json({ error: 'Enter the code from your authenticator app', mfaRequired: true });
      return;
    }

    if (!totp.verify(user.mfaSecret, code)) {
      audit.record('auth.mfa_failed', { entity: 'User', entityId: user.id });
      res.status(401).json({ error: 'Invalid authenticator code', mfaRequired: true });
      return;
    }
  }

  const refresh = await tokens.issueRefreshToken(user.id);
  tokens.setRefreshCookie(res, refresh.token);
  audit.record('auth.login', { actorId: user.id, entity: 'User', entityId: user.id });

  res.json(tokenResponse(user));
};

// POST /api/v1/auth/refresh
const refresh = async (req, res) => {
  const raw = req.cookies[tokens.REFRESH_COOKIE];

  if (!raw) {
    res.status(401).json({ error: 'Refresh token missing' });
    return;
  }

  const rotated = await tokens.rotateRefreshToken(raw);

  if (!rotated) {
    tokens.clearRefreshCookie(res);
    res.status(401).json({ error: 'Refresh token is invalid or expired' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: rotated.userId },
    select: { id: true, name: true, phone: true, address: true, role: true, mfaEnabled: true, createdAt: true },
  });

  if (!user) {
    tokens.clearRefreshCookie(res);
    res.status(401).json({ error: 'Refresh token is invalid or expired' });
    return;
  }

  tokens.setRefreshCookie(res, rotated.token);
  res.json(tokenResponse(user));
};

// POST /api/v1/auth/logout
const logout = async (req, res) => {
  const raw = req.cookies[tokens.REFRESH_COOKIE];
  let userId = null;

  if (raw) {
    const user = await tokens.findRefreshUser(raw);
    userId = user ? user.id : null;
    await tokens.revokeRefreshToken(raw);
  }

  tokens.clearRefreshCookie(res);

  if (userId) {
    audit.record('auth.logout', { actorId: userId, entity: 'User', entityId: userId });
  }

  res.status(204).send();
};

// GET /api/v1/auth/me
const me = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, phone: true, address: true, role: true, mfaEnabled: true, createdAt: true },
  });

  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  res.json(user);
};

// PUT /api/v1/auth/me
const updateMe = async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';

  if (name.length < 2 || !PHONE_PATTERN.test(phone) || address.length < 5) {
    res.status(400).json({ error: 'Provide a name, a 10-digit mobile number and an address' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { phone: phone } });

  if (existing && existing.id !== req.user.id) {
    res.status(400).json({ error: 'Phone number already registered' });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { name: name, phone: phone, address: address },
    select: { id: true, name: true, phone: true, address: true, role: true, mfaEnabled: true, createdAt: true },
  });

  audit.record('account.update', { actorId: user.id, entity: 'User', entityId: user.id });

  res.json(user);
};

// PUT /api/v1/auth/password
const changePassword = async (req, res) => {
  const body = req.body || {};
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (newPassword.length < 8 || newPassword.length > 72) {
    res.status(400).json({ error: 'The new password must be 8 to 72 characters' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!matches) {
    res.status(400).json({ error: 'The current password is incorrect' });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });

  await tokens.revokeAllForUser(user.id);
  tokens.clearRefreshCookie(res);
  audit.record('account.password_change', { actorId: user.id, entity: 'User', entityId: user.id });

  res.status(204).send();
};

// POST /api/v1/auth/logout-all
const logoutAll = async (req, res) => {
  await tokens.revokeAllForUser(req.user.id);
  tokens.clearRefreshCookie(res);
  audit.record('auth.logout_all', { actorId: req.user.id, entity: 'User', entityId: req.user.id });
  res.status(204).send();
};

// POST /api/v1/auth/mfa/setup
const mfaSetup = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const secret = totp.generateSecret();

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaSecret: secret, mfaEnabled: false },
  });

  audit.record('account.mfa_setup', { actorId: user.id, entity: 'User', entityId: user.id });

  res.json({
    secret: secret,
    otpauthUrl: totp.otpauthUrl(secret, user.phone),
    mfaEnabled: false,
  });
};

// POST /api/v1/auth/mfa/enable
const mfaEnable = async (req, res) => {
  const body = req.body || {};
  const code = typeof body.totp === 'string' ? body.totp.trim() : '';
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!user.mfaSecret) {
    res.status(400).json({ error: 'Start the authenticator setup first' });
    return;
  }

  if (!totp.verify(user.mfaSecret, code)) {
    res.status(400).json({ error: 'Invalid authenticator code' });
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
  audit.record('account.mfa_enabled', { actorId: user.id, entity: 'User', entityId: user.id });

  res.json({ mfaEnabled: true });
};

// POST /api/v1/auth/mfa/disable
const mfaDisable = async (req, res) => {
  const body = req.body || {};
  const password = typeof body.password === 'string' ? body.password : '';
  const code = typeof body.totp === 'string' ? body.totp.trim() : '';
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const matches = await bcrypt.compare(password, user.passwordHash);

  if (!matches || !totp.verify(user.mfaSecret, code)) {
    res.status(400).json({ error: 'Enter the current password and a valid authenticator code' });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaSecret: null, mfaEnabled: false },
  });
  audit.record('account.mfa_disabled', { actorId: user.id, entity: 'User', entityId: user.id });

  res.status(204).send();
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  updateMe,
  changePassword,
  logoutAll,
  mfaSetup,
  mfaEnable,
  mfaDisable,
};
