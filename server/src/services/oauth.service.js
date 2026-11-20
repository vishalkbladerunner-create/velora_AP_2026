const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../db/prisma');
const tokens = require('./token.service');

const CODE_TTL_MS = 5 * 60 * 1000;
const OAUTH_ACCESS_TTL = '30m';
const OAUTH_REFRESH_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_SCOPES = 'openid profile holds:read';

// OIDC signing key. RS256 is used for ID tokens so a relying party can verify
// them against /oauth/jwks without the client secret.
const keyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const keyId = crypto.createHash('sha256').update(keyPair.publicKey).digest('hex').slice(0, 16);

function publicJwk() {
  const jwk = crypto.createPublicKey(keyPair.publicKey).export({ format: 'jwk' });

  return Object.assign({}, jwk, {
    kid: keyId,
    use: 'sig',
    alg: 'RS256',
  });
}

function randomToken(bytes) {
  return crypto.randomBytes(bytes || 32).toString('base64url');
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function splitList(value) {
  return String(value || '')
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

async function createClient(input) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const redirectUris = Array.isArray(input.redirectUris) ? input.redirectUris : splitList(input.redirectUris);
  const scopes = Array.isArray(input.scopes) ? input.scopes : splitList(input.scopes);

  if (name.length < 2 || redirectUris.length === 0 || scopes.length === 0) {
    return null;
  }

  const clientId = 'vlr_' + randomToken(12);
  const clientSecret = 'vls_' + randomToken(24);
  const client = await prisma.oAuthClient.create({
    data: {
      name: name,
      clientId: clientId,
      clientSecretHash: await bcrypt.hash(clientSecret, 10),
      redirectUris: redirectUris.join('\n'),
      scopes: scopes.join(' '),
    },
  });

  return {
    id: client.id,
    name: client.name,
    clientId: client.clientId,
    clientSecret: clientSecret,
    redirectUris: redirectUris,
    scopes: scopes,
  };
}

function publicClient(client) {
  return {
    id: client.id,
    name: client.name,
    clientId: client.clientId,
    redirectUris: client.redirectUris.split('\n').filter(Boolean),
    scopes: client.scopes.split(' ').filter(Boolean),
    createdAt: client.createdAt,
  };
}

async function authenticateClient(clientId, clientSecret) {
  if (!clientId || !clientSecret) {
    return null;
  }

  const client = await prisma.oAuthClient.findUnique({ where: { clientId: clientId } });

  if (!client) {
    return null;
  }

  const matches = await bcrypt.compare(clientSecret, client.clientSecretHash);

  return matches ? client : null;
}

async function issueAuthorizationCode(input) {
  const code = randomToken(32);

  await prisma.authorizationCode.create({
    data: {
      codeHash: hash(code),
      clientId: input.client.id,
      userId: input.userId,
      scopes: input.scopes.join(' '),
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge || null,
      codeChallengeMethod: input.codeChallengeMethod || null,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  return code;
}

async function consumeAuthorizationCode(code, client, redirectUri, verifier) {
  const row = await prisma.authorizationCode.findUnique({ where: { codeHash: hash(code) } });

  if (!row || row.clientId !== client.id || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (row.redirectUri !== redirectUri) {
    return null;
  }

  // Verify PKCE before spending the code, so a bad verifier can be retried.
  if (!verifyPkce(verifier, row.codeChallenge, row.codeChallengeMethod)) {
    return null;
  }

  const updated = await prisma.authorizationCode.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  if (updated.count === 0) {
    return null;
  }

  return row;
}

function verifyPkce(verifier, challenge, method) {
  if (!challenge) {
    return true;
  }

  if (!verifier) {
    return false;
  }

  if (method === 'plain') {
    return verifier === challenge;
  }

  const computed = crypto.createHash('sha256').update(verifier).digest('base64url');
  return computed === challenge;
}

function signOAuthAccessToken(user, client, scopes) {
  return jwt.sign(
    {
      sub: user ? String(user.id) : undefined,
      client_id: client.clientId,
      scope: scopes.join(' '),
      type: 'oauth',
    },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: OAUTH_ACCESS_TTL,
      issuer: config.oauthIssuer,
      audience: config.jwtAudience,
    }
  );
}

function signIdToken(user, client, scopes) {
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iss: config.oauthIssuer,
      sub: String(user.id),
      aud: client.clientId,
      iat: now,
      exp: now + 30 * 60,
      auth_time: now,
      name: user.name,
      phone_number: user.phone,
      role: user.role,
      scope: scopes.join(' '),
    },
    keyPair.privateKey,
    {
      algorithm: 'RS256',
      keyid: keyId,
    }
  );
}

async function issueOAuthRefreshToken(userId, client, scopes) {
  const raw = randomToken(48);

  await prisma.oAuthRefreshToken.create({
    data: {
      tokenHash: hash(raw),
      clientId: client.id,
      userId: userId,
      scopes: scopes.join(' '),
      expiresAt: new Date(Date.now() + OAUTH_REFRESH_TTL_MS),
    },
  });

  return raw;
}

async function rotateOAuthRefreshToken(raw, client) {
  const row = await prisma.oAuthRefreshToken.findUnique({ where: { tokenHash: hash(raw) } });

  if (!row || row.clientId !== client.id || row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  const next = randomToken(48);

  await prisma.$transaction([
    prisma.oAuthRefreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } }),
    prisma.oAuthRefreshToken.create({
      data: {
        tokenHash: hash(next),
        clientId: client.id,
        userId: row.userId,
        scopes: row.scopes,
        expiresAt: new Date(Date.now() + OAUTH_REFRESH_TTL_MS),
      },
    }),
  ]);

  return { token: next, scopes: row.scopes.split(' '), userId: row.userId };
}

async function buildTokenSet(user, client, scopes, refreshToken) {
  const result = {
    access_token: signOAuthAccessToken(user, client, scopes),
    token_type: 'Bearer',
    expires_in: 1800,
    scope: scopes.join(' '),
  };

  if (scopes.indexOf('openid') !== -1 && user) {
    result.id_token = signIdToken(user, client, scopes);
  }

  if (refreshToken) {
    result.refresh_token = refreshToken;
  }

  return result;
}

function verifyOAuthAccessToken(token) {
  const payload = jwt.verify(token, config.jwtSecret, {
    algorithms: ['HS256'],
    issuer: config.oauthIssuer,
    audience: config.jwtAudience,
  });

  if (payload.type !== 'oauth') {
    throw new Error('Not an OAuth access token');
  }

  return payload;
}

module.exports = {
  DEFAULT_SCOPES,
  publicJwk,
  createClient,
  publicClient,
  authenticateClient,
  issueAuthorizationCode,
  consumeAuthorizationCode,
  verifyPkce,
  signOAuthAccessToken,
  signIdToken,
  issueOAuthRefreshToken,
  rotateOAuthRefreshToken,
  buildTokenSet,
  verifyOAuthAccessToken,
  hash,
};
