const axios = require('axios');
const logger = require('../utils/logger');

const VISA_URL = process.env.VISA_SERVICE_URL || 'http://localhost:3001';
const MASTERCARD_URL = process.env.MASTERCARD_SERVICE_URL || 'http://localhost:3002';

/**
 * Detecta el tipo de tarjeta según el primer dígito del PAN.
 * Visa: empieza en 4
 * Mastercard: empieza en 5
 */
const detectarTipoTarjeta = (pan) => {
  const panStr = String(pan).replace(/\s/g, '');
  if (panStr.startsWith('4')) return 'VISA';
  if (panStr.startsWith('5')) return 'MASTERCARD';
  return null;
};

/**
 * Enmascara el PAN mostrando solo los últimos 4 dígitos.
 */
const enmascararPAN = (pan) => {
  const panStr = String(pan).replace(/\s/g, '');
  return `****${panStr.slice(-4)}`;
};

/**
 * Consulta si un cliente está registrado en el servicio de tarjetas.
 */
const verificarClienteRegistrado = async (tipoTarjeta, pan, cvv) => {
  const url = tipoTarjeta === 'VISA' ? VISA_URL : MASTERCARD_URL;
  const serviceName = tipoTarjeta === 'VISA' ? 'Visa' : 'Mastercard';

  try {
    logger.info(`Verificando cliente en servicio ${serviceName}`, {
      tipo_tarjeta: tipoTarjeta,
      pan_enmascarado: enmascararPAN(pan),
    });

    const response = await axios.post(
      `${url}/api/validate`,
      { pan, cvv },
      { timeout: 10000, headers: { 'Content-Type': 'application/json' } }
    );

    logger.info(`Respuesta de ${serviceName}`, {
      status: response.status,
      data: response.data,
    });

    return { ok: true, data: response.data };
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;

    logger.warn(`Error al consultar servicio ${serviceName}`, {
      status,
      data,
      message: error.message,
    });

    // Si el servicio responde con 404 o similar = cliente no registrado
    if (status === 404 || status === 422) {
      return { ok: false, data, rechazado: true };
    }

    // Error de conectividad u otro
    return { ok: false, data, rechazado: false, error: error.message };
  }
};

/**
 * Envía la solicitud de pago al servicio de tarjetas correspondiente.
 */
const procesarPagoEnServicio = async (tipoTarjeta, payload) => {
  const url = tipoTarjeta === 'VISA' ? VISA_URL : MASTERCARD_URL;
  const serviceName = tipoTarjeta === 'VISA' ? 'Visa' : 'Mastercard';

  try {
    logger.info(`Enviando pago a servicio ${serviceName}`, {
      tipo_tarjeta: tipoTarjeta,
      monto: payload.monto,
      pan_enmascarado: enmascararPAN(payload.pan),
    });

    const response = await axios.post(
      `${url}/api/charge`,
      payload,
      { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
    );

    logger.info(`Pago aprobado por ${serviceName}`, {
      status: response.status,
      data: response.data,
    });

    return { ok: true, aprobado: true, data: response.data };
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;

    logger.warn(`Pago rechazado/error en ${serviceName}`, {
      status,
      data,
      message: error.message,
    });

    if (status === 402 || status === 422 || status === 400) {
      return { ok: false, aprobado: false, data };
    }

    return { ok: false, aprobado: false, error: error.message, data };
  }
};

module.exports = {
  detectarTipoTarjeta,
  enmascararPAN,
  verificarClienteRegistrado,
  procesarPagoEnServicio,
};
