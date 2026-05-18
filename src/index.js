require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { syncDB } = require('./models');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares globales ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging HTTP con morgan → winston
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.info(message.trim(), { type: 'HTTP' }) },
  })
);

// ─── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api/tesoreria', require('./routes/tesoreria'));
app.use('/api/logs', require('./routes/logs'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    servicio: 'Pasarela de Pagos - Orquestador',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ambiente: process.env.NODE_ENV || 'development',
  });
});

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Ruta ${req.method} ${req.path} no encontrada.` });
});

// Error handler global
app.use((err, req, res, next) => {
  logger.error('Error no manejado', { error: err.message, stack: err.stack });
  res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
});

// ─── Arranque ─────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await syncDB();
    logger.info('✅ Base de datos sincronizada');

    app.listen(PORT, () => {
      logger.info(`🚀 Pasarela de Pagos corriendo en http://localhost:${PORT}`);
      logger.info(`📋 Health check: http://localhost:${PORT}/health`);
      logger.info(`💳 Procesar pago: POST http://localhost:${PORT}/api/pagos/procesar-pago`);
      logger.info(`📊 Tesorería reporte: GET http://localhost:${PORT}/api/tesoreria/reporte`);
    });
  } catch (error) {
    logger.error('❌ Error al iniciar el servidor', { error: error.message });
    process.exit(1);
  }
};

start();
