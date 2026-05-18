const { body, query, validationResult } = require('express-validator');

const manejarErrores = (req, res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(422).json({
      ok: false,
      error: 'Datos de entrada inválidos.',
      detalles: errores.array().map(e => ({ campo: e.path, mensaje: e.msg })),
    });
  }
  next();
};

// ─── Validaciones de Pago ─────────────────────────────────────────────────────
const validarPago = [
  body('monto')
    .isFloat({ min: 0.01 })
    .withMessage('El monto debe ser un número positivo mayor a 0.'),
  body('moneda')
    .optional()
    .isIn(['COP', 'USD', 'EUR'])
    .withMessage('Moneda no soportada. Use COP, USD o EUR.'),
  body('pan')
    .notEmpty().withMessage('El número de tarjeta (pan) es requerido.')
    .isLength({ min: 13, max: 19 }).withMessage('El PAN debe tener entre 13 y 19 dígitos.')
    .matches(/^\d+$/).withMessage('El PAN solo debe contener números.'),
  body('cvv')
    .notEmpty().withMessage('El CVV es requerido.')
    .matches(/^\d{3,4}$/).withMessage('El CVV debe tener 3 o 4 dígitos.'),
  body('titular_tarjeta')
    .notEmpty().withMessage('El nombre del titular de la tarjeta es requerido.')
    .isLength({ min: 2, max: 100 }),
  body('referencia_externa')
    .notEmpty().withMessage('La referencia_externa es requerida para control de duplicados.')
    .isLength({ min: 4, max: 100 }),
  body('descripcion')
    .optional()
    .isLength({ max: 255 }),
  manejarErrores,
];

// ─── Validaciones de Reporte ──────────────────────────────────────────────────
const validarReporte = [
  query('fecha_inicio')
    .optional()
    .isISO8601().withMessage('fecha_inicio debe ser una fecha válida (ISO 8601).'),
  query('fecha_fin')
    .optional()
    .isISO8601().withMessage('fecha_fin debe ser una fecha válida (ISO 8601).'),
  manejarErrores,
];

// ─── Validaciones de Liquidación ─────────────────────────────────────────────
const validarLiquidacion = [
  body('transaccion_ids')
    .isArray({ min: 1 }).withMessage('Se requiere un array de transaccion_ids con al menos un elemento.')
    .custom(ids => ids.every(id => typeof id === 'string' && id.length > 0))
    .withMessage('Todos los IDs deben ser strings válidos.'),
  manejarErrores,
];

module.exports = { validarPago, validarReporte, validarLiquidacion };
