const { LogTransaccion } = require('../models');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');

/**
 * GET /api/logs
 * Lista logs almacenados en BD. Filtrable por transaccion_id y nivel.
 */
const listarLogs = async (req, res) => {
  const { transaccion_id, nivel, limit = 100, offset = 0 } = req.query;

  const where = {};
  if (transaccion_id) where.transaccion_id = transaccion_id;
  if (nivel) where.nivel = nivel.toUpperCase();

  const logs = await LogTransaccion.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: Math.min(parseInt(limit), 500),
    offset: parseInt(offset),
  });

  return res.json({
    ok: true,
    total: logs.count,
    limit: parseInt(limit),
    offset: parseInt(offset),
    logs: logs.rows,
  });
};

/**
 * GET /api/logs/archivo
 * Lee los logs del archivo combined.log (últimas N líneas).
 */
const leerArchivoLog = async (req, res) => {
  const { lineas = 100, tipo = 'combined' } = req.query;
  const archivos = {
    combined: 'combined.log',
    error: 'error.log',
    transactions: 'transactions.log',
  };

  const archivo = archivos[tipo] || archivos.combined;
  const rutaLog = path.join(__dirname, '../../logs', archivo);

  if (!fs.existsSync(rutaLog)) {
    return res.status(404).json({ ok: false, error: 'Archivo de log no encontrado aún.' });
  }

  const contenido = fs.readFileSync(rutaLog, 'utf-8');
  const lineasArray = contenido.split('\n').filter(Boolean);
  const ultimasLineas = lineasArray.slice(-parseInt(lineas));

  const logs = ultimasLineas.map(linea => {
    try { return JSON.parse(linea); }
    catch { return { raw: linea }; }
  });

  return res.json({
    ok: true,
    archivo,
    total_lineas: lineasArray.length,
    retornadas: logs.length,
    logs: logs.reverse(), // Más recientes primero
  });
};

module.exports = { listarLogs, leerArchivoLog };
