// Read the environment once at start-up so a missing key fails loudly.
const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = [];

required.forEach((key) => {
  if (!process.env[key]) {
    missing.push(key);
  }
});

if (missing.length > 0) {
  throw new Error('Missing environment variables: ' + missing.join(', '));
}

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

if (!Number.isInteger(port)) {
  throw new Error('PORT must be an integer');
}

const metricsPort = process.env.METRICS_PORT ? Number(process.env.METRICS_PORT) : 9464;

if (!Number.isInteger(metricsPort)) {
  throw new Error('METRICS_PORT must be an integer');
}

const refreshTokenDays = Number(process.env.REFRESH_TOKEN_DAYS || 30);

const config = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtIssuer: process.env.JWT_ISSUER || 'velora',
  jwtAudience: process.env.JWT_AUDIENCE || 'velora-api',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenDays: refreshTokenDays,
  oauthIssuer: process.env.OAUTH_ISSUER || 'http://localhost:' + port,
  autoVerifyPharmacies: process.env.AUTO_VERIFY_PHARMACIES !== 'false',
  metricsPort: metricsPort,
  port: port,
  nodeEnv: process.env.NODE_ENV || 'development',
};

module.exports = Object.freeze(config);
