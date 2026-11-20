const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const config = require('./config/env');
const logger = require('./middlewares/logger');
const errorHandler = require('./middlewares/error');

const healthRouter = require('./routes/health.router');
const medicinesRouter = require('./routes/medicines.router');
const pharmaciesRouter = require('./routes/pharmacies.router');
const stockRouter = require('./routes/stock.router');
const authRouter = require('./routes/auth.router');
const holdsRouter = require('./routes/holds.router');
const adminRouter = require('./routes/admin.router');
const oauthRouter = require('./routes/oauth.router');
const oauthController = require('./controllers/oauth.controller');

const app = express();

app.disable('x-powered-by');

// Parsers and cookies first, then the logger, then static files, then the API.
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(logger);

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// Versioned API. The legacy mounts below keep older links working.
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/medicines', medicinesRouter);
app.use('/api/v1/pharmacies', pharmaciesRouter);
app.use('/api/v1/stock', stockRouter);
app.use('/api/v1/holds', holdsRouter);
app.use('/api/v1/admin', adminRouter);

// OAuth 2.0 authorization server and OpenID Connect metadata.
app.use('/oauth', oauthRouter);
app.get('/.well-known/openid-configuration', oauthController.discovery);

// Legacy aliases.
app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/medicines', medicinesRouter);
app.use('/pharmacies', pharmaciesRouter);
app.use('/stock', stockRouter);
app.use('/holds', holdsRouter);

// Terminal 404: it sends the response and never calls next().
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Central error handler, last in the chain.
app.use(errorHandler);

module.exports = app;
