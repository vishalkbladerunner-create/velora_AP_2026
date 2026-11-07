// Read the environment once at start-up so a missing key fails loudly.
const required = ['DATABASE_URL'];
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

const config = {
  databaseUrl: process.env.DATABASE_URL,
  port: port,
  nodeEnv: process.env.NODE_ENV || 'development',
};

module.exports = Object.freeze(config);
