const express = require('express');

const logger = require('./middlewares/logger');
const healthRouter = require('./routes/health.router');

const app = express();

// Parsers first, then the logger, then the routes.
app.use(express.json());
app.use(logger);

app.use('/health', healthRouter);

// Terminal 404: it sends the response and never calls next().
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
