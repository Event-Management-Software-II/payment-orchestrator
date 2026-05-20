const express = require('express');
const { authenticateCompany } = require('../middleware/auth');
const { validateReport, validateSettlement } = require('../middleware/validators');
const {
  settlePayments,
  getSettlements,
  getSettlementById,
  getSettlementReport,
  getCompanySummary,
} = require('../controllers/settlementController');

const router = express.Router();

router.post('/settle', authenticateCompany, validateSettlement, settlePayments);
router.get('/report', authenticateCompany, validateReport, getSettlementReport);
router.get('/summary', authenticateCompany, getCompanySummary);
router.get('/', authenticateCompany, getSettlements);
router.get('/:id', authenticateCompany, getSettlementById);

module.exports = router;