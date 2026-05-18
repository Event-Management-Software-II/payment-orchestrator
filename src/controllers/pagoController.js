const { Transaccion } = require('../models');
const {
  detectarTipoTarjeta,
  enmascararPAN,
  verificarClienteRegistrado,
  procesarPagoEnServicio,
} = require('../services/cardRouter');
const { registrarLog } = require('../services/logService');
const logger = require('../utils/logger');

/**
 * POST /api/pagos/procesar-pago
 * Orquesta el flujo completo de un pago con tarjeta de crédito.
 */
const procesarPago = async (req, res) => {
  const { monto, moneda = 'COP', pan, cvv, titular_tarjeta, referencia_externa, descripcion } = req.body;
  const empresa = req.empresa;
  const ip = req.ip;

  // 1. DETECCIÓN DE TIPO DE TARJETA
  const tipoTarjeta = detectarTipoTarjeta(pan);
  if (!tipoTarjeta) {
    await registrarLog({
      nivel: 'WARN',
      evento: 'TARJETA_NO_RECONOCIDA',
      detalle: { pan_enmascarado: enmascararPAN(pan), empresa_id: empresa.id },
      ip_origen: ip,
    });
    return res.status(422).json({
      ok: false,
      error: 'Tipo de tarjeta no reconocido. Solo se aceptan Visa (4xxx) y Mastercard (5xxx).',
    });
  }

  // 2. CONTROL DE DUPLICADOS: verificar si ya existe la referencia_externa
  const transaccionExistente = await Transaccion.findOne({ where: { referencia_externa } });
  if (transaccionExistente) {
    await registrarLog({
      transaccion_id: transaccionExistente.id,
      nivel: 'WARN',
      evento: 'PAGO_DUPLICADO_DETECTADO',
      detalle: { referencia_externa, estado_existente: transaccionExistente.estado },
      ip_origen: ip,
    });
    return res.status(409).json({
      ok: false,
      error: 'Esta referencia de compra ya fue procesada. No se permite duplicar cobros.',
      transaccion_id: transaccionExistente.id,
      estado: transaccionExistente.estado,
    });
  }

  // 3. VERIFICAR CLIENTE REGISTRADO EN SERVICIO DE TARJETAS
  const verificacion = await verificarClienteRegistrado(tipoTarjeta, pan, cvv);

  if (!verificacion.ok) {
    await registrarLog({
      nivel: 'WARN',
      evento: 'CLIENTE_NO_REGISTRADO_EN_PROVEEDOR',
      detalle: {
        tipo_tarjeta: tipoTarjeta,
        pan_enmascarado: enmascararPAN(pan),
        empresa_id: empresa.id,
        respuesta: verificacion.data,
      },
      ip_origen: ip,
    });

    if (verificacion.rechazado) {
      return res.status(402).json({
        ok: false,
        error: `El cliente no está registrado en el servicio ${tipoTarjeta}. Pago rechazado.`,
      });
    }

    return res.status(502).json({
      ok: false,
      error: `No se pudo conectar con el servicio ${tipoTarjeta}. Intente más tarde.`,
    });
  }

  // 4. CREAR TRANSACCIÓN con estado inicial "NO_LIQUIDADO"
  let transaccion;
  try {
    transaccion = await Transaccion.create({
      empresa_id: empresa.id,
      referencia_externa,
      monto,
      moneda,
      tipo_tarjeta: tipoTarjeta,
      pan_enmascarado: enmascararPAN(pan),
      titular_tarjeta,
      estado: 'NO_LIQUIDADO',
      descripcion,
      fecha_transaccion: new Date(),
    });
  } catch (err) {
    logger.error('Error al crear transacción en BD', { error: err.message });
    return res.status(500).json({ ok: false, error: 'Error interno al registrar la transacción.' });
  }

  await registrarLog({
    transaccion_id: transaccion.id,
    nivel: 'INFO',
    evento: 'TRANSACCION_CREADA',
    detalle: {
      monto,
      moneda,
      tipo_tarjeta: tipoTarjeta,
      pan_enmascarado: enmascararPAN(pan),
      empresa_id: empresa.id,
      referencia_externa,
    },
    ip_origen: ip,
  });

  // 5. ENVIAR PAGO AL SERVICIO DE TARJETAS
  const resultadoPago = await procesarPagoEnServicio(tipoTarjeta, {
    pan,
    cvv,
    monto,
    moneda,
    titular: titular_tarjeta,
    referencia: transaccion.id,
  });

  // 6. ACTUALIZAR ESTADO SEGÚN RESPUESTA DEL PROVEEDOR
  const nuevoEstado = resultadoPago.aprobado ? 'APROBADO' : 'RECHAZADO';
  await transaccion.update({
    estado: nuevoEstado,
    respuesta_proveedor: resultadoPago.data || null,
  });

  await registrarLog({
    transaccion_id: transaccion.id,
    nivel: resultadoPago.aprobado ? 'INFO' : 'WARN',
    evento: resultadoPago.aprobado ? 'PAGO_APROBADO' : 'PAGO_RECHAZADO',
    detalle: {
      tipo_tarjeta: tipoTarjeta,
      monto,
      respuesta_proveedor: resultadoPago.data,
    },
    ip_origen: ip,
  });

  if (!resultadoPago.aprobado) {
    return res.status(402).json({
      ok: false,
      transaccion_id: transaccion.id,
      estado: 'RECHAZADO',
      error: 'El pago fue rechazado por el proveedor de tarjetas.',
      detalle: resultadoPago.data,
    });
  }

  // 7. ÉXITO: Retornar resultado para que el sistema de boletas confirme la reserva
  return res.status(201).json({
    ok: true,
    transaccion_id: transaccion.id,
    estado: 'APROBADO',
    tipo_tarjeta: tipoTarjeta,
    pan_enmascarado: enmascararPAN(pan),
    monto,
    moneda,
    fecha_transaccion: transaccion.fecha_transaccion,
    mensaje: 'Pago procesado exitosamente. La boleta puede ser confirmada.',
  });
};

/**
 * GET /api/pagos/:id
 * Consulta el estado de una transacción específica.
 */
const consultarTransaccion = async (req, res) => {
  const { id } = req.params;
  const empresa = req.empresa;

  const transaccion = await Transaccion.findOne({
    where: { id, empresa_id: empresa.id },
    include: [{ association: 'empresa', attributes: ['nombre', 'nit'] }],
  });

  if (!transaccion) {
    return res.status(404).json({ ok: false, error: 'Transacción no encontrada o no pertenece a su empresa.' });
  }

  // Nunca exponer datos sensibles
  const { respuesta_proveedor, ...data } = transaccion.toJSON();

  return res.json({ ok: true, transaccion: data });
};

module.exports = { procesarPago, consultarTransaccion };
