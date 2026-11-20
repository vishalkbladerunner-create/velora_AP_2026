const config = require('./config/env');
const app = require('./app');
const metrics = require('./runtime/metrics');
const tokens = require('./services/token.service');

app.listen(config.port, () => {
  console.log('Server listening on port ' + config.port);
});

const metricsServer = metrics.start(config.metricsPort);

metricsServer.on('listening', () => {
  console.log('Metrics listening on port ' + config.metricsPort);
});

metricsServer.on('error', (error) => {
  console.error('Metrics server failed: ' + error.message);
});

// Remove expired and long-revoked refresh tokens at boot and once an hour.
function cleanup() {
  tokens.cleanupExpiredTokens().catch((error) => {
    console.error('Token cleanup failed: ' + error.message);
  });
}

cleanup();
const cleanupTimer = setInterval(cleanup, 60 * 60 * 1000);
cleanupTimer.unref();
