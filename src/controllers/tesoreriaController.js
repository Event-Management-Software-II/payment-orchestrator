const { Op } = require('sequelize');
const { Transaccion, Empresa } = require('../models');
const { registrarLog } = require('../services/logService');
const logger = require('../utils/logger');

/**
 * POST /api/tesoreria/liquidar
 * Liquidación masiva (Batch): cambia el estado de varios pagos APROBADOS a LIQUIDADO.
 */
const liquidarPagos = async (req, res) => {
  const { transaccion_ids } = req.body;
  const empresa = req.empresa;
  const ip = req.ip;

  try {
    // Solo liquidar transacciones APROBADAS que pertenezcan a la empresa
    const transacciones = await Transaccion.findAll({
      where: {
        id: { [Op.in]: transaccion_ids },
        empresa_id: empresa.id,
        estado: 'APROBADO',
      },
    });

    if (transacciones.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'No se encontraron transacciones APROBADAS con los IDs proporcionados para su empresa.',
      });
    }

    const idsEncontrados = transacciones.map(t => t.id);
    const idsNoEncontrados = transaccion_ids.filter(id => !idsEncontrados.includes(id));

    // Actualizar estado en batch
    const ahora = new Date();
    await Transaccion.update(
      { estado: 'LIQUIDADO', fecha_liquidacion: ahora },
      {
        where: {
          id: { [Op.in]: idsEncontrados },
          empresa_id: empresa.id,
        },
      }
    );

    await registrarLog({
      nivel: 'INFO',
      evento: 'LIQUIDACION_BATCH',
      detalle: {
        empresa_id: empresa.id,
        total_liquidadas: idsEncontrados.length,
        ids_liquidadas: idsEncontrados,
        ids_no_encontradas: idsNoEncontrados,
        fecha_liquidacion: ahora,
      },
      ip_origen: ip,
    });

    return res.json({
      ok: true,
      mensaje: `${idsEncontrados.length} transacción(es) liquidada(s) exitosamente.`,
      liquidadas: idsEncontrados.length,
      no_procesadas: idsNoEncontrados,
      fecha_liquidacion: ahora,
    });
  } catch (error) {
    logger.error('Error en liquidación batch', { error: error.message });
    return res.status(500).json({ ok: false, error: 'Error interno en el proceso de liquidación.' });
  }
};

/**
 * GET /api/tesoreria/reporte
 * Reporte de transacciones pendientes (NO_LIQUIDADO/APROBADO) con total a pagar.
 * Filtros opcionales: fecha_inicio, fecha_fin
 */
const generarReporte = async (req, res) => {
  const empresa = req.empresa;
  const { fecha_inicio, fecha_fin } = req.query;

  // Validación: coherencia cronológica
  if (fecha_inicio && fecha_fin) {
    const inicio = new Date(fecha_inicio);
    const fin = new Date(fecha_fin);
    if (inicio > fin) {
      return res.status(422).json({
        ok: false,
        error: 'La fecha_inicio no puede ser mayor que la fecha_fin.',
      });
    }
  }

  const whereClause = {
    empresa_id: empresa.id, // Privacidad: solo ve sus propias transacciones
    estado: { [Op.in]: ['APROBADO', 'NO_LIQUIDADO'] },
  };

  // Aplicar filtro de fechas si se proveen
  if (fecha_inicio || fecha_fin) {
    whereClause.fecha_transaccion = {};
    if (fecha_inicio) whereClause.fecha_transaccion[Op.gte] = new Date(fecha_inicio);
    if (fecha_fin) {
      // Incluir todo el día de fecha_fin
      const finDelDia = new Date(fecha_fin);
      finDelDia.setHours(23, 59, 59, 999);
      whereClause.fecha_transaccion[Op.lte] = finDelDia;
    }
  }

  try {
    const transacciones = await Transaccion.findAll({
      where: whereClause,
      attributes: [
        'id', 'referencia_externa', 'monto', 'moneda',
        'tipo_tarjeta', 'pan_enmascarado', 'titular_tarjeta',
        'estado', 'fecha_transaccion', 'descripcion',
      ],
      order: [['fecha_transaccion', 'DESC']],
    });

    // Calcular totales por moneda
    const totalesPorMoneda = {};
    transacciones.forEach(t => {
      const moneda = t.moneda;
      if (!totalesPorMoneda[moneda]) totalesPorMoneda[moneda] = 0;
      totalesPorMoneda[moneda] += parseFloat(t.monto);
    });

    return res.json({
      ok: true,
      empresa: { id: empresa.id, nombre: empresa.nombre },
      filtros: { fecha_inicio: fecha_inicio || null, fecha_fin: fecha_fin || null },
      resumen: {
        total_transacciones: transacciones.length,
        totales_por_moneda: totalesPorMoneda,
      },
      transacciones,
    });
  } catch (error) {
    logger.error('Error al generar reporte', { error: error.message });
    return res.status(500).json({ ok: false, error: 'Error interno al generar el reporte.' });
  }
};

/**
 * GET /api/tesoreria/resumen
 * Resumen general: conteo por estado para la empresa autenticada.
 */
const resumenEmpresa = async (req, res) => {
  const empresa = req.empresa;

  try {
    const estadisticas = await Transaccion.findAll({
      where: { empresa_id: empresa.id },
      attributes: [
        'estado',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'cantidad'],
        [require('sequelize').fn('SUM', require('sequelize').col('monto')), 'total'],
      ],
      group: ['estado'],
      raw: true,
    });

    return res.json({
      ok: true,
      empresa: { id: empresa.id, nombre: empresa.nombre },
      estadisticas,
    });
  } catch (error) {
    logger.error('Error al obtener resumen', { error: error.message });
    return res.status(500).json({ ok: false, error: 'Error interno.' });
  }
};

module.exports = { liquidarPagos, generarReporte, resumenEmpresa };
