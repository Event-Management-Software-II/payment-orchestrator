const prisma = require('../prisma');
const logger = require('../utils/logger');

const createTransactionLog = async ({
  transactionId,
  level = 'INFO',
  event,
  details = {},
  sourceIp,
}) => {
  try {
    await prisma.transactionLog.create({
      data: { transactionId, level, event, details, sourceIp },
    });
  } catch (error) {
    logger.error('Failed to save transaction log in database', { error: error.message });
  }

  logger[level.toLowerCase()]?.(event, { transactionId, ...details });
};

const getTransactionLogs = async (transactionId) => {
  return prisma.transactionLog.findMany({
    where: transactionId ? { transactionId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
};

module.exports = { createTransactionLog, getTransactionLogs };
