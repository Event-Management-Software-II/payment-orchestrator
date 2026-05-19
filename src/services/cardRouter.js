const axios = require('axios');
const logger = require('../utils/logger');

const NU_URL = process.env.NU_SERVICE_URL;
const MASTERCARD_URL = process.env.MASTERCARD_SERVICE_URL || 'http://localhost:3003';

const detectCardType = (pan) => {
  const cleanPan = String(pan).replace(/\s/g, '');
  if (cleanPan.startsWith('4')) return 'VISA';
  if (cleanPan.startsWith('5')) return 'MASTERCARD';
  return null;
};

const maskPan = (pan) => {
  const cleanPan = String(pan).replace(/\s/g, '');
  return `****${cleanPan.slice(-4)}`;
};

// Random auth token in the range Nu requires (1000–2000)
const nuToken = () => Math.floor(Math.random() * 1001) + 1000;

const verifyNuCard = async (pan, cvv) => {
  try {
    logger.info('Verifying card with Nu service', { maskedPan: maskPan(pan) });

    const response = await axios.post(
      `${NU_URL}/validate`,
      { number: pan, csv: cvv, token: nuToken() },
      { timeout: 10000, headers: { 'Content-Type': 'application/json' } }
    );

    const result = String(response.data).trim();
    logger.info('Nu service validation response', { result });

    if (result === 'VALID') {
      return { ok: true, data: { service: 'nu', status: 'VALID' } };
    }

    return { ok: false, data: { service: 'nu', status: result }, rejected: true };
  } catch (error) {
    const status = error.response?.status;
    logger.warn('Nu service validation failed', { status, message: error.message });

    if (status === 400) {
      return { ok: false, data: { service: 'nu', error: 'Invalid token' }, rejected: false };
    }

    return { ok: false, data: null, rejected: false, error: error.message };
  }
};

const verifyMastercardCustomer = async (pan, cvv) => {
  try {
    logger.info('Verifying customer in MASTERCARD service', { maskedPan: maskPan(pan) });

    const response = await axios.post(
      `${MASTERCARD_URL}/api/validate`,
      { pan, cvv },
      { timeout: 10000, headers: { 'Content-Type': 'application/json' } }
    );

    logger.info('MASTERCARD validation response', { status: response.status, data: response.data });
    return { ok: true, data: response.data };
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;

    logger.warn('Failed to validate customer in MASTERCARD service', { status, data, message: error.message });

    if (status === 404 || status === 422) {
      return { ok: false, data, rejected: true };
    }

    return { ok: false, data, rejected: false, error: error.message };
  }
};

const verifyRegisteredCustomer = async (cardType, pan, cvv) => {
  if (cardType === 'VISA') {
    return verifyNuCard(pan, cvv);
  }
  return verifyMastercardCustomer(pan, cvv);
};

const chargeMastercard = async (payload) => {
  try {
    logger.info('Sending charge to MASTERCARD service', {
      amount: payload.amount,
      maskedPan: maskPan(payload.pan),
    });

    const response = await axios.post(`${MASTERCARD_URL}/api/charge`, payload, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });

    logger.info('MASTERCARD payment approved', { status: response.status, data: response.data });
    return { ok: true, approved: true, data: response.data };
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;

    logger.warn('MASTERCARD payment rejected or failed', { status, data, message: error.message });

    if (status === 402 || status === 422 || status === 400) {
      return { ok: false, approved: false, data };
    }

    return { ok: false, approved: false, error: error.message, data };
  }
};

const chargeProvider = async (cardType, payload) => {
  if (cardType === 'VISA') {
    // Nu service has no charge endpoint — card was already validated, transaction is approved
    logger.info('Nu service: charge implicit from prior validation', {
      maskedPan: maskPan(payload.pan),
      amount: payload.amount,
    });
    return {
      ok: true,
      approved: true,
      data: { service: 'nu', status: 'APPROVED', amount: payload.amount },
    };
  }

  return chargeMastercard(payload);
};

module.exports = {
  detectCardType,
  maskPan,
  verifyRegisteredCustomer,
  chargeProvider,
};