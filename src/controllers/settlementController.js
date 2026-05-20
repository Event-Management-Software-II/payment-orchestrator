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
        error: 'No approved transactions found for the provided IDs.',
      });
    }

    const foundIds = transactions.map((t) => t.id);
    const notProcessed = transactionIds.filter((id) => !foundIds.includes(id));
    const settledAt = new Date();
    const commissionRate = company.commissionRate;

    // Group by currency and calculate commission per currency
    const byCurrency = {};
    for (const tx of transactions) {
      if (!byCurrency[tx.currency]) byCurrency[tx.currency] = 0;
      byCurrency[tx.currency] += Number(tx.amount);
    }

    const breakdown = Object.entries(byCurrency).map(([currency, gross]) => {
      const grossRounded = Math.round(gross * 100) / 100;
      const commissionAmount = Math.round(grossRounded * commissionRate * 100) / 100;
      return {
        currency,
        grossAmount: grossRounded,
        commissionAmount,
        netAmount: Math.round((grossRounded - commissionAmount) * 100) / 100,
      };
    });

    const settlement = await prisma.settlement.create({
      data: {
        companyId: company.id,
        transactionCount: foundIds.length,
        commissionRate,
        breakdown,
        settledAt,
      },
    });

    await prisma.paymentTransaction.updateMany({
      where: { id: { in: foundIds }, companyId: company.id },
      data: { status: 'SETTLED', settlementDate: settledAt, settlementId: settlement.id },
    });

    await createTransactionLog({
      level: 'INFO',
      event: 'BATCH_SETTLEMENT',
      details: {
        settlementId: settlement.id,
        companyId: company.id,
        commissionRate,
        settledCount: foundIds.length,
        breakdown,
        notProcessed,
        settledAt,
      },
      sourceIp,
    });

    logger.info('Settlement completed', {
      settlementId: settlement.id,
      company: company.name,
      count: foundIds.length,
      commissionRate,
    });

    return res.json({
      ok: true,
      message: `${foundIds.length} transaction(s) settled successfully.`,
      settlementId: settlement.id,
      settled: foundIds.length,
      notProcessed,
      commissionRate,
      breakdown,
      settledAt,
    });
  } catch (error) {
    logger.error('Batch settlement failed', { error: error.message });
    return res.status(500).json({ ok: false, error: 'Internal settlement error.' });
  }
};

const getSettlements = async (req, res) => {
  const company = req.company;

  try {
    const settlements = await prisma.settlement.findMany({
      where: { companyId: company.id },
      orderBy: { settledAt: 'desc' },
      select: {
        id: true,
        transactionCount: true,
        commissionRate: true,
        breakdown: true,
        settledAt: true,
        createdAt: true,
      },
    });

    return res.json({
      ok: true,
      company: { id: company.id, name: company.name, commissionRate: company.commissionRate },
      total: settlements.length,
      settlements,
    });
  } catch (error) {
    logger.error('Failed to list settlements', { error: error.message });
    return res.status(500).json({ ok: false, error: 'Internal error.' });
  }
};

const getSettlementById = async (req, res) => {
  const company = req.company;
  const { id } = req.params;

  try {
    const settlement = await prisma.settlement.findFirst({
      where: { id, companyId: company.id },
      include: {
        transactions: {
          select: {
            id: true,
            externalReference: true,
            amount: true,
            currency: true,
            cardType: true,
            maskedPan: true,
            cardHolder: true,
            transactionDate: true,
            settlementDate: true,
            description: true,
          },
        },
      },
    });

    if (!settlement) {
      return res.status(404).json({ ok: false, error: 'Settlement not found.' });
    }

    return res.json({
      ok: true,
      company: { id: company.id, name: company.name },
      settlement,
    });
  } catch (error) {
    logger.error('Failed to get settlement', { id, error: error.message });
    return res.status(500).json({ ok: false, error: 'Internal error.' });
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

    // Totals and projected commission per currency
    const byCurrency = {};
    for (const tx of transactions) {
      if (!byCurrency[tx.currency]) byCurrency[tx.currency] = 0;
      byCurrency[tx.currency] += Number(tx.amount);
    }

    const projectedCommission = Object.entries(byCurrency).map(([currency, gross]) => {
      const grossRounded = Math.round(gross * 100) / 100;
      const commissionAmount = Math.round(grossRounded * company.commissionRate * 100) / 100;
      return {
        currency,
        grossAmount: grossRounded,
        commissionAmount,
        netAmount: Math.round((grossRounded - commissionAmount) * 100) / 100,
      };
    });

    return res.json({
      ok: true,
      company: {
        id: company.id,
        name: company.name,
        commissionRate: company.commissionRate,
      },
      filters: { startDate: startDate || null, endDate: endDate || null },
      summary: {
        totalTransactions: transactions.length,
        projectedCommission,
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

    const settledStats = stats.find((s) => s.status === 'SETTLED');
    const settledGross = settledStats ? settledStats.total : 0;
    const totalCommissionEarned = Math.round(settledGross * company.commissionRate * 100) / 100;

    return res.json({
      ok: true,
      company: {
        id: company.id,
        name: company.name,
        commissionRate: company.commissionRate,
      },
      stats,
      commissionSummary: {
        settledGross,
        totalCommissionEarned,
        totalNetPaidToCompany: Math.round((settledGross - totalCommissionEarned) * 100) / 100,
      },
    });
  } catch (error) {
    logger.error('Failed to get company summary', { error: error.message });
    return res.status(500).json({ ok: false, error: 'Internal error.' });
  }
};

module.exports = {
  settlePayments,
  getSettlements,
  getSettlementById,
  getSettlementReport,
  getCompanySummary,
};