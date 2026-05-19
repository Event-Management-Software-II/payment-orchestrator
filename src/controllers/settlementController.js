const prisma = require('../prisma');
const { createTransactionLog } = require('../services/logService');
const logger = require('../utils/logger');

const settlePayments = async (req, res) => {
  const transactionIds = req.body.transactionIds;
  const company = req.company;
  const sourceIp = req.ip;

  try {
    const transactions = await prisma.paymentTransaction.findMany({
      where: {
        id: { in: transactionIds },
        companyId: company.id,
        status: 'APPROVED',
      },
    });

    if (transactions.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'No approved transactions were found for this company with the provided IDs.',
      });
    }

    const foundIds = transactions.map((transaction) => transaction.id);
    const missingIds = transactionIds.filter((id) => !foundIds.includes(id));
    const settlementDate = new Date();

    await prisma.paymentTransaction.updateMany({
      where: {
        id: { in: foundIds },
        companyId: company.id,
      },
      data: { status: 'SETTLED', settlementDate },
    });

    await createTransactionLog({
      level: 'INFO',
      event: 'BATCH_SETTLEMENT',
      details: {
        companyId: company.id,
        settledCount: foundIds.length,
        settledIds: foundIds,
        missingIds,
        settlementDate,
      },
      sourceIp,
    });

    return res.json({
      ok: true,
      message: `${foundIds.length} transaction(s) settled successfully.`,
      settled: foundIds.length,
      notProcessed: missingIds,
      settlementDate,
    });
  } catch (error) {
    logger.error('Batch settlement failed', { error: error.message });
    return res.status(500).json({ ok: false, error: 'Internal settlement error.' });
  }
};

const getSettlementReport = async (req, res) => {
  const company = req.company;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return res.status(422).json({
        ok: false,
        error: 'startDate cannot be greater than endDate.',
      });
    }
  }

  const where = {
    companyId: company.id,
    status: { in: ['APPROVED', 'UNSETTLED'] },
  };

  if (startDate || endDate) {
    where.transactionDate = {};
    if (startDate) where.transactionDate.gte = new Date(startDate);
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      where.transactionDate.lte = endOfDay;
    }
  }

  try {
    const transactions = await prisma.paymentTransaction.findMany({
      where,
      select: {
        id: true,
        externalReference: true,
        amount: true,
        currency: true,
        cardType: true,
        maskedPan: true,
        cardHolder: true,
        status: true,
        transactionDate: true,
        description: true,
      },
      orderBy: { transactionDate: 'desc' },
    });

    const totalsByCurrency = {};
    transactions.forEach((transaction) => {
      if (!totalsByCurrency[transaction.currency]) totalsByCurrency[transaction.currency] = 0;
      totalsByCurrency[transaction.currency] += Number(transaction.amount);
    });

    return res.json({
      ok: true,
      company: { id: company.id, name: company.name },
      filters: { startDate: startDate || null, endDate: endDate || null },
      summary: {
        totalTransactions: transactions.length,
        totalsByCurrency,
      },
      transactions,
    });
  } catch (error) {
    logger.error('Failed to build settlement report', { error: error.message });
    return res.status(500).json({ ok: false, error: 'Internal error while building the report.' });
  }
};

const getCompanySummary = async (req, res) => {
  const company = req.company;

  try {
    const rawStats = await prisma.paymentTransaction.groupBy({
      by: ['status'],
      where: { companyId: company.id },
      _count: { id: true },
      _sum: { amount: true },
    });

    const stats = rawStats.map((item) => ({
      status: item.status,
      count: item._count.id,
      total: item._sum.amount ? Number(item._sum.amount) : 0,
    }));

    return res.json({
      ok: true,
      company: { id: company.id, name: company.name },
      stats,
    });
  } catch (error) {
    logger.error('Failed to get company summary', { error: error.message });
    return res.status(500).json({ ok: false, error: 'Internal error.' });
  }
};

module.exports = { settlePayments, getSettlementReport, getCompanySummary };
