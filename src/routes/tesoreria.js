const express = require('express');
const router = express.Router();
const { autenticarEmpresa } = require('../middleware/auth');
const { validarReporte, validarLiquidacion } = require('../middleware/validators');
const { liquidarPagos, generarReporte, resumenEmpresa } = require('../controllers/tesoreriaController');

/**
 * @openapi
 * /api/tesoreria/liquidar:
 *   post:
 *     summary: Liquidación masiva (batch) de transacciones aprobadas
 *     security: [{ ApiKey: [] }]
 *     tags: [Tesorería]
 */
router.post('/liquidar', autenticarEmpresa, validarLiquidacion, liquidarPagos);

/**
 * @openapi
 * /api/tesoreria/reporte:
 *   get:
 *     summary: Reporte de transacciones pendientes de liquidar con total a pagar
 *     security: [{ ApiKey: [] }]
 *     tags: [Tesorería]
 */
router.get('/reporte', autenticarEmpresa, validarReporte, generarReporte);

/**
 * @openapi
 * /api/tesoreria/resumen:
 *   get:
 *     summary: Resumen general de transacciones por estado para la empresa autenticada
 *     security: [{ ApiKey: [] }]
 *     tags: [Tesorería]
 */
router.get('/resumen', autenticarEmpresa, resumenEmpresa);

module.exports = router;
