const fs = require('fs');
const path = require('path');
const prisma = require('../prisma');

const listLogs = async (req, res) => {
  const transactionId = req.query.transactionId;
  const { level, limit = 100, offset = 0 } = req.query;

  const where = {};
  if (transactionId) where.transactionId = transactionId;
  if (level) where.level = level.toUpperCase();

  const take = Math.min(parseInt(limit), 500);
  const skip = parseInt(offset);
  const [total, logs] = await Promise.all([
    prisma.transactionLog.count({ where }),
    prisma.transactionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
  ]);

  return res.json({
    ok: true,
    total,
    limit: parseInt(limit),
    offset: parseInt(offset),
    logs,
  });
};

const readLogFile = async (req, res) => {
  const { lines = 100, type = 'combined' } = req.query;
  const files = {
    combined: 'combined.log',
    error: 'error.log',
    transactions: 'transactions.log',
  };

  const fileName = files[type] || files.combined;
  const logPath = path.join(__dirname, '../../logs', fileName);

  if (!fs.existsSync(logPath)) {
    return res.status(404).json({ ok: false, error: 'Log file not found yet.' });
  }

  const content = fs.readFileSync(logPath, 'utf-8');
  const allLines = content.split('\n').filter(Boolean);
  const latestLines = allLines.slice(-parseInt(lines));

  const logs = latestLines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { raw: line };
    }
  });

  return res.json({
    ok: true,
    file: fileName,
    totalLines: allLines.length,
    returned: logs.length,
    logs: logs.reverse(),
  });
};

module.exports = { listLogs, readLogFile };
