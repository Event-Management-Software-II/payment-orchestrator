const express = require('express');
const router = express.Router();
const { autenticarEmpresa } = require('../middleware/auth');
const { validarPago } = require('../middleware/validators');
const { procesarPago, consultarTransaccion } = require('../controllers/pagoController');

/**
 * @openapi
 * /api/pagos/procesar-pago:
 *   post:
 *     summary: Procesar un pago con tarjeta de crédito
 *     description: Orquesta el flujo completo. Detecta tipo de tarjeta, verifica cliente, registra y envía al proveedor.
 *     security: [{ ApiKey: [] }]
 *     tags: [Pagos]
 */
router.post('/procesar-pago', autenticarEmpresa, validarPago, procesarPago);

/**
 * @openapi
 * /api/pagos/{id}:
 *   get:
 *     summary: Consultar estado de una transacción
 *     security: [{ ApiKey: [] }]
 *     tags: [Pagos]
 */
router.get('/:id', autenticarEmpresa, consultarTransaccion);

module.exports = router;
