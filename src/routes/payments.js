const express = require('express');
const { authenticateCompany } = require('../middleware/auth');
const { validatePayment } = require('../middleware/validators');
const { processPayment, getTransaction } = require('../controllers/paymentController');

const router = express.Router();

router.post('/process-payment', authenticateCompany, validatePayment, processPayment);
router.get('/:id', authenticateCompany, getTransaction);

module.exports = router;
