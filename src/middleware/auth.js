const { Empresa } = require('../models');
const logger = require('../utils/logger');

/**
 * Middleware: verifica que el header X-Api-Key corresponda
 * a una empresa activa y registrada.
 */
const autenticarEmpresa = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      ok: false,
      error: 'Se requiere el header X-Api-Key para autenticarse.',
    });
  }

  try {
    const empresa = await Empresa.findOne({ where: { api_key: apiKey, activa: true } });

    if (!empresa) {
      logger.warn('Intento de acceso con API key inválida o empresa inactiva', {
        api_key_prefix: apiKey.slice(0, 10) + '...',
        ip: req.ip,
      });
      return res.status(403).json({
        ok: false,
        error: 'API Key inválida o empresa no autorizada.',
      });
    }

    // Adjuntar empresa al request para uso posterior
    req.empresa = empresa;
    next();
  } catch (error) {
    logger.error('Error en autenticación de empresa', { error: error.message });
    res.status(500).json({ ok: false, error: 'Error interno de autenticación.' });
  }
};

module.exports = { autenticarEmpresa };
