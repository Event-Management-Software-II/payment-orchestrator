require('dotenv').config();

const cors = require('cors');
const express = require('express');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerDefinition = require('./swagger');
const prisma = require('./prisma');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  morgan('combined', {
    stream: { write: (message) => logger.info(message.trim(), { type: 'HTTP' }) },
  })
);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition));

app.use('/api/payments', require('./routes/payments'));
app.use('/api/settlements', require('./routes/settlements'));
app.use('/api/logs', require('./routes/logs'));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'payment-orchestrator',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Route ${req.method} ${req.path} not found.` });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ ok: false, error: 'Internal server error.' });
});

const start = async () => {
  try {
    await prisma.$connect();
    logger.info('Prisma database connected');

    app.listen(PORT, () => {
      logger.info(`Payment orchestrator running at http://localhost:${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Process payment: POST http://localhost:${PORT}/api/payments/process-payment`);
      logger.info(`Settlement report: GET http://localhost:${PORT}/api/settlements/report`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

start();

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
