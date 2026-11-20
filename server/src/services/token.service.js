const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../db/prisma');

const REFRESH_COOKIE = 'velora_refresh';
const REFRESH_TTL_MS = config.refreshTokenDays * 24 * 60 * 60 * 1000;
const ACCESS_TTL_SECONDS = 15 * 60;

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, type: 'access' },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: config.accessTokenTtl,
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    }
  );
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, config.jwtSecret, {
    algorithms: ['HS256'],
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });

  if (payload.type !== 'access') {
    throw new Error('Not an access token');
  }

  return payload;
}

// Issue a rotating refresh token. Only the hash is stored; the raw value is
// returned once and written to an HttpOnly cookie.
async function issueRefreshToken(userId, familyId) {
  const raw = crypto.randomBytes(48).toString('hex');
  const family = familyId || crypto.randomUUID();

  await prisma.refreshToken.create({
    data: {
      userId: userId,
      tokenHash: hashToken(raw),
      familyId: family,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  return { token: raw, familyId: family };
}

async function findRefreshUser(raw) {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });

  if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return row.user;
}

// Rotate the refresh token. A token that is presented after it was replaced
// revokes the whole family, which contains replay of a stolen token.
async function rotateRefreshToken(raw) {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
  });

  if (!row) {
    return null;
  }

  if (row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
    await prisma.refreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  const next = crypto.randomBytes(48).toString('hex');

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date(), replacedByHash: hashToken(next) },
    }),
    prisma.refreshToken.create({
      data: {
        userId: row.userId,
        tokenHash: hashToken(next),
        familyId: row.familyId,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    }),
  ]);

  return { token: next, userId: row.userId };
}

async function revokeRefreshToken(raw) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function revokeAllForUser(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId: userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
    maxAge: REFRESH_TTL_MS,
  };
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
  });
}

async function cleanupExpiredTokens() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { not: null }, createdAt: { lt: cutoff } },
      ],
    },
  });
}

module.exports = {
  REFRESH_COOKIE,
  ACCESS_TTL_SECONDS,
  hashToken,
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  findRefreshUser,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  setRefreshCookie,
  clearRefreshCookie,
  cleanupExpiredTokens,
};
