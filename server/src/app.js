const express = require('express');
const path = require('path');
const session = require('express-session');

const config = require('./config/env');
const logger = require('./middlewares/logger');
const healthRouter = require('./routes/health.router');
const medicinesRouter = require('./routes/medicines.router');
const pharmaciesRouter = require('./routes/pharmacies.router');
const stockRouter = require('./routes/stock.router');
const authRouter = require('./routes/auth.router');
const holdsRouter = require('./routes/holds.router');

const app = express();

// Parsers first, then the logger, then the session, then static files, then
// the routes.
app.use(express.json());
app.use(logger);
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/health', healthRouter);
app.use('/medicines', medicinesRouter);
app.use('/pharmacies', pharmaciesRouter);
app.use('/stock', stockRouter);
app.use('/auth', authRouter);
app.use('/holds', holdsRouter);

// Terminal 404: it sends the response and never calls next().
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
