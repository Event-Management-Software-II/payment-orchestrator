const prisma = require('../prisma');
const {
  detectCardType,
  maskPan,
  verifyRegisteredCustomer,
  chargeProvider,
} = require('../services/cardRouter');
const { createTransactionLog } = require('../services/logService');
const logger = require('../utils/logger');

const readPaymentPayload = (body) => ({
  amount: body.amount,
  currency: body.currency ?? 'COP',
  pan: body.pan,
  cvv: body.cvv,
  cardHolder: body.cardHolder,
  externalReference: body.externalReference,
  description: body.description,
});

const processPayment = async (req, res) => {
  const {
    amount,
    currency,
    pan,
    cvv,
    cardHolder,
    externalReference,
    description,
  } = readPaymentPayload(req.body);
  const company = req.company;
  const sourceIp = req.ip;

  const cardType = detectCardType(pan);
  if (!cardType) {
    await createTransactionLog({
      level: 'WARN',
      event: 'CARD_TYPE_NOT_SUPPORTED',
      details: { maskedPan: maskPan(pan), companyId: company.id },
      sourceIp,
    });
    return res.status(422).json({
      ok: false,
      error: 'Unsupported card type. Only Visa (4xxx) and Mastercard (5xxx) are accepted.',
    });
  }

  const existingTransaction = await prisma.paymentTransaction.findUnique({
    where: { externalReference },
  });
  if (existingTransaction) {
    await createTransactionLog({
      transactionId: existingTransaction.id,
      level: 'WARN',
      event: 'DUPLICATE_PAYMENT_DETECTED',
      details: { externalReference, existingStatus: existingTransaction.status },
      sourceIp,
    });
    return res.status(409).json({
      ok: false,
      error: 'This purchase reference has already been processed.',
      transactionId: existingTransaction.id,
      status: existingTransaction.status,
    });
  }

  const customerValidation = await verifyRegisteredCustomer(cardType, pan, cvv);

  if (!customerValidation.ok) {
    await createTransactionLog({
      level: 'WARN',
      event: 'CUSTOMER_NOT_REGISTERED_WITH_PROVIDER',
      details: {
        cardType,
        maskedPan: maskPan(pan),
        companyId: company.id,
        response: customerValidation.data,
      },
      sourceIp,
    });

    if (customerValidation.rejected) {
      return res.status(402).json({
        ok: false,
        error: `The customer is not registered in the ${cardType} service. Payment rejected.`,
      });
    }

    return res.status(502).json({
      ok: false,
      error: `Could not connect to the ${cardType} service. Try again later.`,
    });
  }

  let transaction;
  try {
    transaction = await prisma.paymentTransaction.create({
      data: {
        companyId: company.id,
        externalReference,
        amount,
        currency,
        cardType,
        maskedPan: maskPan(pan),
        cardHolder,
        status: 'UNSETTLED',
        description,
        transactionDate: new Date(),
      },
    });
  } catch (error) {
    logger.error('Failed to create payment transaction', { error: error.message });
    return res.status(500).json({ ok: false, error: 'Internal error while registering the transaction.' });
  }

  await createTransactionLog({
    transactionId: transaction.id,
    level: 'INFO',
    event: 'TRANSACTION_CREATED',
    details: {
      amount,
      currency,
      cardType,
      maskedPan: maskPan(pan),
      companyId: company.id,
      externalReference,
    },
    sourceIp,
  });

  const paymentResult = await chargeProvider(cardType, {
    pan,
    cvv,
    amount,
    currency,
    cardHolder,
    reference: transaction.id,
  });

  const newStatus = paymentResult.approved ? 'APPROVED' : 'REJECTED';
  transaction = await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      status: newStatus,
      providerResponse: paymentResult.data || null,
    },
  });

  await createTransactionLog({
    transactionId: transaction.id,
    level: paymentResult.approved ? 'INFO' : 'WARN',
    event: paymentResult.approved ? 'PAYMENT_APPROVED' : 'PAYMENT_REJECTED',
    details: {
      cardType,
      amount,
      providerResponse: paymentResult.data,
    },
    sourceIp,
  });

  if (!paymentResult.approved) {
    return res.status(402).json({
      ok: false,
      transactionId: transaction.id,
      status: 'REJECTED',
      error: 'The payment was rejected by the card provider.',
      details: paymentResult.data,
    });
  }

  return res.status(201).json({
    ok: true,
    transactionId: transaction.id,
    status: 'APPROVED',
    cardType,
    maskedPan: maskPan(pan),
    amount,
    currency,
    transactionDate: transaction.transactionDate,
    message: 'Payment processed successfully. The ticket purchase can be confirmed.',
  });
};

const getTransaction = async (req, res) => {
  const { id } = req.params;
  const company = req.company;

  const transaction = await prisma.paymentTransaction.findFirst({
    where: { id, companyId: company.id },
    include: { company: { select: { name: true, taxId: true } } },
  });

  if (!transaction) {
    return res.status(404).json({ ok: false, error: 'Transaction not found for this company.' });
  }

  const { providerResponse, ...data } = transaction;

  return res.json({ ok: true, transaction: data });
};

module.exports = { processPayment, getTransaction };
