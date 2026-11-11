const express = require('express');
const path = require('path');

const logger = require('./middlewares/logger');
const healthRouter = require('./routes/health.router');
const medicinesRouter = require('./routes/medicines.router');

const app = express();

// Parsers first, then the logger, then static files, then the routes.
app.use(express.json());
app.use(logger);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/health', healthRouter);
app.use('/medicines', medicinesRouter);

// Terminal 404: it sends the response and never calls next().
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
