const { body, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      ok: false,
      error: 'Invalid input data.',
      details: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    });
  }
  next();
};

const validatePayment = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('amount must be greater than 0.'),
  body('currency')
    .optional()
    .isIn(['COP', 'USD', 'EUR'])
    .withMessage('Unsupported currency. Use COP, USD, or EUR.'),
  body('pan')
    .notEmpty()
    .withMessage('pan is required.')
    .isLength({ min: 13, max: 19 })
    .withMessage('pan must have between 13 and 19 digits.')
    .matches(/^\d+$/)
    .withMessage('pan must contain only digits.'),
  body('cvv')
    .notEmpty()
    .withMessage('cvv is required.')
    .matches(/^\d{3,4}$/)
    .withMessage('cvv must have 3 or 4 digits.'),
  body('cardHolder')
    .notEmpty()
    .withMessage('cardHolder is required.')
    .isLength({ min: 2, max: 100 }),
  body('externalReference')
    .notEmpty()
    .withMessage('externalReference is required.')
    .isLength({ min: 4, max: 100 }),
  body('description').optional().isLength({ max: 255 }),
  handleValidationErrors,
];

const validateReport = [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  handleValidationErrors,
];

const validateSettlement = [
  body('transactionIds')
    .isArray({ min: 1 })
    .withMessage('transactionIds must be a non-empty array.')
    .custom((ids) => ids.every((id) => typeof id === 'string' && id.length > 0))
    .withMessage('transactionIds must contain only non-empty strings.'),
  handleValidationErrors,
];

module.exports = { validatePayment, validateReport, validateSettlement };
