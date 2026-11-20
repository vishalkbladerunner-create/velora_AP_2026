const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../db/prisma');
const tokens = require('../services/token.service');
const oauth = require('../services/oauth.service');
const audit = require('../services/audit.service');

const CONSENT_AUDIENCE = 'velora-oauth-consent';

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function signConsent(payload) {
  return jwt.sign(
    Object.assign({ type: 'consent' }, payload),
    config.jwtSecret,
    { algorithm: 'HS256', expiresIn: '10m', issuer: config.oauthIssuer, audience: CONSENT_AUDIENCE }
  );
}

function verifyConsent(token) {
  const payload = jwt.verify(token, config.jwtSecret, {
    algorithms: ['HS256'],
    issuer: config.oauthIssuer,
    audience: CONSENT_AUDIENCE,
  });

  if (payload.type !== 'consent') {
    throw new Error('Not a consent token');
  }

  return payload;
}

function splitScopes(value) {
  return String(value || '')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function errorPage(res, status, message) {
  res.status(status).type('html').send(
    '<!doctype html><meta charset="utf-8"><title>Velora authorization</title>' +
    '<body style="font-family:system-ui;background:#f7f4ec;color:#1d2a24;padding:48px">' +
    '<h1 style="font-family:Georgia,serif">Authorization error</h1><p>' + escapeHtml(message) + '</p></body>'
  );
}

function consentPage(input) {
  const scopeItems = input.scopes.map((scope) => '<li><code>' + escapeHtml(scope) + '</code></li>').join('');
  const clientName = escapeHtml(input.client.name);
  const userName = escapeHtml(input.user.name);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize ${clientName} · Velora</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
      background: radial-gradient(circle at 20% 10%, #eef4ee, #f7f4ec 55%); color: #1d2a24;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(460px, 100%); padding: 32px; border: 1px solid #d9d3c2; border-radius: 20px;
      background: #fffdf7; box-shadow: 0 24px 60px rgba(29, 42, 36, .12); }
    .mark { display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 12px;
      background: #0f5a45; color: #fff; font-weight: 800; font-size: 22px; }
    h1 { margin: 18px 0 6px; font-family: Georgia, "Times New Roman", serif; font-size: 30px; line-height: 1.1; }
    p { margin: 0 0 18px; color: #4d5a53; font-size: 14px; line-height: 1.6; }
    ul { margin: 0 0 22px; padding: 14px 14px 14px 32px; border: 1px solid #e4dfd1; border-radius: 12px;
      background: #f7f4ec; font-size: 13px; line-height: 1.9; }
    .actions { display: grid; gap: 10px; }
    button { min-height: 46px; border-radius: 10px; border: 1px solid #0f5a45; font: inherit;
      font-weight: 700; cursor: pointer; }
    .allow { background: #0f5a45; color: #fff; }
    .deny { background: transparent; color: #0f5a45; border-color: #cfc8b6; }
    footer { margin-top: 18px; color: #7b857f; font-size: 11px; }
  </style>
</head>
<body>
  <main>
    <span class="mark">+</span>
    <h1>Authorize ${clientName}</h1>
    <p><strong>${clientName}</strong> wants to access your Velora account as <strong>${userName}</strong>.</p>
    <ul>${scopeItems}</ul>
    <form method="post" action="/oauth/authorize" class="actions">
      <input type="hidden" name="consent" value="${escapeHtml(input.consent)}">
      <button class="allow" type="submit" name="decision" value="approve">Allow access</button>
      <button class="deny" type="submit" name="decision" value="deny">Deny</button>
    </form>
    <footer>You can revoke this access at any time from your account.</footer>
  </main>
</body>
</html>`;
}

// GET /oauth/authorize
const authorizePage = async (req, res) => {
  const clientId = typeof req.query.client_id === 'string' ? req.query.client_id : '';
  const redirectUri = typeof req.query.redirect_uri === 'string' ? req.query.redirect_uri : '';
  const responseType = typeof req.query.response_type === 'string' ? req.query.response_type : 'code';
  const scope = typeof req.query.scope === 'string' ? req.query.scope : 'openid profile';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const codeChallenge = typeof req.query.code_challenge === 'string' ? req.query.code_challenge : '';
  const codeChallengeMethod = typeof req.query.code_challenge_method === 'string' ? req.query.code_challenge_method : 'S256';

  const client = await prisma.oAuthClient.findUnique({ where: { clientId: clientId } });

  if (!client) {
    errorPage(res, 400, 'Unknown client.');
    return;
  }

  const allowedRedirects = client.redirectUris.split('\n').filter(Boolean);

  if (allowedRedirects.indexOf(redirectUri) === -1) {
    errorPage(res, 400, 'The redirect URI is not registered for this client.');
    return;
  }

  if (responseType !== 'code') {
    errorPage(res, 400, 'Only the authorization code flow is supported.');
    return;
  }

  const scopes = splitScopes(scope);
  const allowedScopes = splitScopes(client.scopes);

  if (scopes.some((item) => allowedScopes.indexOf(item) === -1)) {
    errorPage(res, 400, 'One or more requested scopes are not available.');
    return;
  }

  const raw = req.cookies[tokens.REFRESH_COOKIE];
  const user = raw ? await tokens.findRefreshUser(raw) : null;

  if (!user) {
    res.redirect('/account.html?next=' + encodeURIComponent(req.originalUrl));
    return;
  }

  const consent = signConsent({
    clientId: client.clientId,
    userId: user.id,
    redirectUri: redirectUri,
    scopes: scopes,
    state: state,
    codeChallenge: codeChallenge || null,
    codeChallengeMethod: codeChallenge ? codeChallengeMethod : null,
  });

  res.type('html').send(consentPage({ client: client, user: user, scopes: scopes, consent: consent }));
};

// POST /oauth/authorize
const authorizeDecision = async (req, res) => {
  let payload;

  try {
    payload = verifyConsent(req.body.consent);
  } catch (error) {
    errorPage(res, 400, 'The authorization request expired. Start again.');
    return;
  }

  const raw = req.cookies[tokens.REFRESH_COOKIE];
  const user = raw ? await tokens.findRefreshUser(raw) : null;

  if (!user || user.id !== payload.userId) {
    errorPage(res, 401, 'Sign in again before approving access.');
    return;
  }

  const client = await prisma.oAuthClient.findUnique({ where: { clientId: payload.clientId } });

  if (!client) {
    errorPage(res, 400, 'Unknown client.');
    return;
  }

  const target = new URL(payload.redirectUri);

  if (req.body.decision !== 'approve') {
    target.searchParams.set('error', 'access_denied');
    if (payload.state) {
      target.searchParams.set('state', payload.state);
    }
    res.redirect(target.toString());
    return;
  }

  const code = await oauth.issueAuthorizationCode({
    client: client,
    userId: user.id,
    scopes: payload.scopes,
    redirectUri: payload.redirectUri,
    codeChallenge: payload.codeChallenge,
    codeChallengeMethod: payload.codeChallengeMethod,
  });

  audit.record('oauth.authorize', {
    actorId: user.id,
    entity: 'OAuthClient',
    entityId: client.id,
    metadata: { scopes: payload.scopes, redirectUri: payload.redirectUri },
  });

  target.searchParams.set('code', code);
  if (payload.state) {
    target.searchParams.set('state', payload.state);
  }
  res.redirect(target.toString());
};

// POST /oauth/token
const token = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const body = req.body || {};
  let clientId = body.client_id;
  let clientSecret = body.client_secret;
  const header = req.headers.authorization || '';

  // client_secret_basic
  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');

    if (separator !== -1) {
      clientId = decoded.slice(0, separator);
      clientSecret = decoded.slice(separator + 1);
    }
  }

  const client = await oauth.authenticateClient(clientId, clientSecret);

  if (!client) {
    res.status(401).json({ error: 'invalid_client' });
    return;
  }

  const grant = body.grant_type;

  if (grant === 'authorization_code') {
    const code = typeof body.code === 'string' ? body.code : '';
    const redirectUri = typeof body.redirect_uri === 'string' ? body.redirect_uri : '';
    const verifier = typeof body.code_verifier === 'string' ? body.code_verifier : '';
    const row = await oauth.consumeAuthorizationCode(code, client, redirectUri, verifier);

    if (!row) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: row.userId } });

    if (!user) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    const scopes = splitScopes(row.scopes);
    const refresh = await oauth.issueOAuthRefreshToken(user.id, client, scopes);
    const tokenSet = await oauth.buildTokenSet(user, client, scopes, refresh);
    audit.record('oauth.token', {
      actorId: user.id,
      entity: 'OAuthClient',
      entityId: client.id,
      metadata: { grant: grant, scopes: scopes },
    });
    res.json(tokenSet);
    return;
  }

  if (grant === 'refresh_token') {
    const rotated = await oauth.rotateOAuthRefreshToken(body.refresh_token, client);

    if (!rotated) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: rotated.userId } });

    if (!user) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    const tokenSet = await oauth.buildTokenSet(user, client, rotated.scopes, rotated.token);
    audit.record('oauth.token', {
      actorId: user.id,
      entity: 'OAuthClient',
      entityId: client.id,
      metadata: { grant: grant, scopes: rotated.scopes },
    });
    res.json(tokenSet);
    return;
  }

  if (grant === 'client_credentials') {
    const requested = body.scope ? splitScopes(body.scope) : splitScopes(client.scopes).filter((item) => item !== 'openid');
    const allowed = splitScopes(client.scopes);

    if (requested.length === 0 || requested.some((item) => allowed.indexOf(item) === -1 || item === 'openid')) {
      res.status(400).json({ error: 'invalid_scope' });
      return;
    }

    res.json({
      access_token: oauth.signOAuthAccessToken(null, client, requested),
      token_type: 'Bearer',
      expires_in: 1800,
      scope: requested.join(' '),
    });
    return;
  }

  res.status(400).json({ error: 'unsupported_grant_type' });
};

// GET /oauth/userinfo
const userinfo = async (req, res) => {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    res.set('WWW-Authenticate', 'Bearer');
    res.status(401).json({ error: 'invalid_token' });
    return;
  }

  let payload;

  try {
    payload = oauth.verifyOAuthAccessToken(header.slice(7));
  } catch (error) {
    res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
    res.status(401).json({ error: 'invalid_token' });
    return;
  }

  const scopes = splitScopes(payload.scope);

  if (scopes.indexOf('openid') === -1) {
    res.status(403).json({ error: 'insufficient_scope' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });

  if (!user) {
    res.status(401).json({ error: 'invalid_token' });
    return;
  }

  res.json({
    sub: String(user.id),
    name: user.name,
    phone_number: user.phone,
    role: user.role,
  });
};

// GET /.well-known/openid-configuration
const discovery = (req, res) => {
  const issuer = config.oauthIssuer;

  res.json({
    issuer: issuer,
    authorization_endpoint: issuer + '/oauth/authorize',
    token_endpoint: issuer + '/oauth/token',
    userinfo_endpoint: issuer + '/oauth/userinfo',
    jwks_uri: issuer + '/oauth/jwks',
    scopes_supported: ['openid', 'profile', 'holds:read', 'stock:read'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    code_challenge_methods_supported: ['S256', 'plain'],
    id_token_signing_alg_values_supported: ['RS256'],
    subject_types_supported: ['public'],
  });
};

// GET /oauth/jwks
const jwks = (req, res) => {
  res.json({ keys: [oauth.publicJwk()] });
};

module.exports = {
  authorizePage,
  authorizeDecision,
  token,
  userinfo,
  discovery,
  jwks,
};
