# 💳 Pasarela de Pagos — Orquestador Central

Servicio central de la pasarela de pagos para el sistema de venta de boletas. Orquesta transacciones entre la app cliente, los servicios de Visa y Mastercard, y el módulo de tesorería.

## 🏗️ Arquitectura

```
App (Boletas)
    │
    │ POST /api/pagos/procesar-pago
    ▼
[Pasarela de Pagos - Orquestador] ← este servicio (puerto 3000)
    │                      │
    │ REST request          │ BD SQLite (transacciones + logs)
    ▼                      │
[Servicio Visa]            │
[Servicio Mastercard]      │
    │                      │
    └──────────────────────┘
```

## 🚀 Instalación y Arranque

```bash
# 1. Clonar el repositorio
git clone https://github.com/Event-Management-Software-II/payment-orchestrator.git
cd payment-orchestrator

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con las URLs reales de los servicios de tarjetas

# 4. Cargar datos iniciales (empresas y API keys)
npm run seed

# 5. Iniciar el servidor
npm run dev       # Desarrollo (con hot-reload)
npm start         # Producción
```

El servidor arrancará en `http://localhost:3000`.

## 📁 Estructura del Proyecto

```
payment-orchestrator/
├── src/
│   ├── index.js                    # Entry point Express
│   ├── models/
│   │   └── index.js                # Sequelize models (Empresa, Transaccion, LogTransaccion)
│   ├── routes/
│   │   ├── pagos.js                # POST /api/pagos/procesar-pago, GET /api/pagos/:id
│   │   ├── tesoreria.js            # POST /liquidar, GET /reporte, GET /resumen
│   │   └── logs.js                 # GET /api/logs, GET /api/logs/archivo
│   ├── controllers/
│   │   ├── pagoController.js       # Orquestación del flujo de pago
│   │   ├── tesoreriaController.js  # Liquidación batch y reportes
│   │   └── logController.js        # Consulta de logs
│   ├── middleware/
│   │   ├── auth.js                 # Verificación de X-Api-Key (empresa_id)
│   │   └── validators.js           # Validaciones con express-validator
│   ├── services/
│   │   ├── cardRouter.js           # Enrutamiento Visa/Mastercard + llamadas REST
│   │   └── logService.js           # Registro de eventos en BD y archivo
│   └── utils/
│       ├── logger.js               # Configuración Winston (archivos + consola)
│       └── seed.js                 # Datos iniciales
├── logs/                           # Archivos de log generados por Winston
│   ├── combined.log
│   ├── error.log
│   └── transactions.log
├── openapi.yaml                    # Especificación OpenAPI 3.0
├── postman_collection.json         # Colección Postman con tests
├── .env.example
└── package.json
```

## 🔑 Autenticación

Todas las rutas de `/api/pagos` y `/api/tesoreria` requieren el header:
```
X-Api-Key: sk_boletas_abc123def456
```

Las API keys se generan al registrar una empresa. Ver el seed para las keys de prueba.

## 📌 Endpoints Principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Estado del servicio |
| `POST` | `/api/pagos/procesar-pago` | Procesar pago (orquestador) |
| `GET` | `/api/pagos/:id` | Consultar estado de transacción |
| `POST` | `/api/tesoreria/liquidar` | Liquidación batch |
| `GET` | `/api/tesoreria/reporte` | Reporte pendientes de liquidar |
| `GET` | `/api/tesoreria/resumen` | Estadísticas por estado |
| `GET` | `/api/logs` | Logs en BD |
| `GET` | `/api/logs/archivo` | Logs en archivos Winston |

## 🔄 Flujo de un Pago

1. **Autenticación** → Valida `X-Api-Key` → identifica empresa
2. **Detección** → PAN empieza en `4` → VISA | `5` → MASTERCARD
3. **Anti-duplicados** → Verifica que `referencia_externa` sea única
4. **Verificación** → Llama al servicio de tarjetas para confirmar que el cliente existe
5. **Registro** → Crea transacción con estado `NO_LIQUIDADO`
6. **Procesamiento** → Envía el cobro al proveedor
7. **Actualización** → Actualiza estado a `APROBADO` o `RECHAZADO`
8. **Respuesta** → Retorna resultado al sistema de boletas

## 📊 Postman

Importar `postman_collection.json` en Postman. La colección incluye:
- Tests automáticos para cada endpoint
- Variables de entorno (`BASE_URL`, `API_KEY_*`, `TRANSACCION_ID`)
- El `TRANSACCION_ID` se auto-rellena tras un pago exitoso

## 📋 OpenAPI

La especificación completa está en `openapi.yaml`. Se puede visualizar en:
- [Swagger Editor](https://editor.swagger.io) (pegar el contenido del YAML)
- [Redoc](https://redocly.github.io/redoc/) 

## 🗂️ Variables de Entorno

```env
PORT=3000
NODE_ENV=development
VISA_SERVICE_URL=http://localhost:3001
MASTERCARD_SERVICE_URL=http://localhost:3002
BOLETAS_SERVICE_URL=http://localhost:4000
DB_PATH=./payment_gateway.db
```

## 🔗 Servicios Relacionados

| Servicio | Repositorio | Puerto |
|----------|------------|--------|
| App Boletas | `event-management-project` | 4000 |
| Servicio Visa | `card-service` (rama visa) | 3001 |
| Servicio Mastercard | `card-service` (rama mastercard) | 3002 |
| **Pasarela (este)** | `payment-orchestrator` | **3000** |
