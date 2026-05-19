const axios = require('axios');
const logger = require('../utils/logger');

const VISA_URL = process.env.VISA_SERVICE_URL || 'http://localhost:3001';
const MASTERCARD_URL = process.env.MASTERCARD_SERVICE_URL || 'http://localhost:3002';

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

const getProviderUrl = (cardType) => (cardType === 'VISA' ? VISA_URL : MASTERCARD_URL);

const verifyRegisteredCustomer = async (cardType, pan, cvv) => {
  const providerUrl = getProviderUrl(cardType);

  try {
    logger.info(`Verifying customer in ${cardType} service`, {
      cardType,
      maskedPan: maskPan(pan),
    });

    const response = await axios.post(
      `${providerUrl}/api/validate`,
      { pan, cvv },
      { timeout: 10000, headers: { 'Content-Type': 'application/json' } }
    );

    logger.info(`${cardType} validation response`, {
      status: response.status,
      data: response.data,
    });

    return { ok: true, data: response.data };
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;

    logger.warn(`Failed to validate customer in ${cardType} service`, {
      status,
      data,
      message: error.message,
    });

    if (status === 404 || status === 422) {
      return { ok: false, data, rejected: true };
    }

    return { ok: false, data, rejected: false, error: error.message };
  }
};

const chargeProvider = async (cardType, payload) => {
  const providerUrl = getProviderUrl(cardType);

  try {
    logger.info(`Sending charge to ${cardType} service`, {
      cardType,
      amount: payload.amount,
      maskedPan: maskPan(payload.pan),
    });

    const response = await axios.post(`${providerUrl}/api/charge`, payload, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });

    logger.info(`${cardType} payment approved`, {
      status: response.status,
      data: response.data,
    });

    return { ok: true, approved: true, data: response.data };
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;

    logger.warn(`${cardType} payment rejected or failed`, {
      status,
      data,
      message: error.message,
    });

    if (status === 402 || status === 422 || status === 400) {
      return { ok: false, approved: false, data };
    }

    return { ok: false, approved: false, error: error.message, data };
  }
};

module.exports = {
  detectCardType,
  maskPan,
  verifyRegisteredCustomer,
  chargeProvider,
};
