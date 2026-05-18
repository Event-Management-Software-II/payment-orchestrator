const { LogTransaccion } = require('../models');
const logger = require('../utils/logger');

const registrarLog = async ({ transaccion_id, nivel = 'INFO', evento, detalle = {}, ip_origen }) => {
  try {
    await LogTransaccion.create({ transaccion_id, nivel, evento, detalle, ip_origen });
  } catch (err) {
    logger.error('No se pudo guardar log en BD', { error: err.message });
  }
  // También al archivo de winston
  logger[nivel.toLowerCase()]?.(evento, { transaccion_id, ...detalle });
};

const obtenerLogs = async (transaccion_id) => {
  return LogTransaccion.findAll({
    where: transaccion_id ? { transaccion_id } : {},
    order: [['createdAt', 'DESC']],
    limit: 500,
  });
};

module.exports = { registrarLog, obtenerLogs };
