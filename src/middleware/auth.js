const prisma = require('../prisma');
const logger = require('../utils/logger');

const authenticateCompany = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      ok: false,
      error: 'The X-Api-Key header is required.',
    });
  }

  try {
    const company = await prisma.company.findFirst({
      where: { apiKey, isActive: true },
    });

    if (!company) {
      logger.warn('Access attempt with invalid API key or inactive company', {
        apiKeyPrefix: apiKey.slice(0, 10) + '...',
        ip: req.ip,
      });
      return res.status(403).json({
        ok: false,
        error: 'Invalid API key or unauthorized company.',
      });
    }

    req.company = company;
    next();
  } catch (error) {
    logger.error('Company authentication failed', { error: error.message });
    res.status(500).json({ ok: false, error: 'Internal authentication error.' });
  }
};

module.exports = { authenticateCompany };
