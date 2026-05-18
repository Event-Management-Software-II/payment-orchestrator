const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const dbPath = process.env.DB_PATH || './payment_gateway.db';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.resolve(dbPath),
  logging: false,
});

// ─── Modelo: Empresa (Comercio) ───────────────────────────────────────────────
const Empresa = sequelize.define('Empresa', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  nit: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  activa: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  api_key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
}, {
  tableName: 'empresas',
  timestamps: true,
});

// ─── Modelo: Transacción ──────────────────────────────────────────────────────
const Transaccion = sequelize.define('Transaccion', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  empresa_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: Empresa, key: 'id' },
  },
  referencia_externa: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'ID único del intento de compra desde el sistema de boletas. Previene duplicados.',
  },
  monto: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  moneda: {
    type: DataTypes.STRING(3),
    defaultValue: 'COP',
  },
  tipo_tarjeta: {
    type: DataTypes.ENUM('VISA', 'MASTERCARD'),
    allowNull: false,
  },
  pan_enmascarado: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Solo los últimos 4 dígitos: ****1234',
  },
  titular_tarjeta: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  estado: {
    type: DataTypes.ENUM('PENDIENTE', 'APROBADO', 'RECHAZADO', 'NO_LIQUIDADO', 'LIQUIDADO'),
    defaultValue: 'NO_LIQUIDADO',
  },
  respuesta_proveedor: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Respuesta raw del servicio Visa o Mastercard',
  },
  fecha_transaccion: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  fecha_liquidacion: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  descripcion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'transacciones',
  timestamps: true,
  indexes: [
    { fields: ['empresa_id'] },
    { fields: ['estado'] },
    { fields: ['referencia_externa'], unique: true },
    { fields: ['fecha_transaccion'] },
  ],
});

// ─── Modelo: Log de Transacciones ────────────────────────────────────────────
const LogTransaccion = sequelize.define('LogTransaccion', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  transaccion_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  nivel: {
    type: DataTypes.ENUM('INFO', 'WARN', 'ERROR'),
    defaultValue: 'INFO',
  },
  evento: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  detalle: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  ip_origen: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'logs_transacciones',
  timestamps: true,
});

// ─── Asociaciones ─────────────────────────────────────────────────────────────
Empresa.hasMany(Transaccion, { foreignKey: 'empresa_id', as: 'transacciones' });
Transaccion.belongsTo(Empresa, { foreignKey: 'empresa_id', as: 'empresa' });

// ─── Sync y Export ────────────────────────────────────────────────────────────
const syncDB = async () => {
  await sequelize.sync({ alter: true });
};

module.exports = { sequelize, Empresa, Transaccion, LogTransaccion, syncDB };
