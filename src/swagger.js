const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Payment Orchestrator API',
    version: '1.0.0',
    description:
      'Pasarela de pagos central. Enruta transacciones a Nu (tarjetas Visa, prefijo 4) o Mastercard (prefijo 5). Requiere cabecera `X-Api-Key` en todos los endpoints de pago.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Servidor local' }],
  components: {
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Api-Key',
        description: 'API key de la empresa registrada en el sistema',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: false },
          error: { type: 'string' },
        },
      },
      Transaction: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          companyId: { type: 'string', format: 'uuid' },
          externalReference: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string', enum: ['COP', 'USD', 'EUR'] },
          cardType: { type: 'string', enum: ['VISA', 'MASTERCARD'] },
          maskedPan: { type: 'string', example: '**** **** **** 1234' },
          cardHolder: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'UNSETTLED', 'SETTLED'] },
          transactionDate: { type: 'string', format: 'date-time' },
          settlementDate: { type: 'string', format: 'date-time', nullable: true },
          description: { type: 'string' },
        },
      },
      TransactionLog: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          transactionId: { type: 'string', format: 'uuid' },
          level: { type: 'string', enum: ['INFO', 'WARN', 'ERROR'] },
          event: { type: 'string' },
          details: { type: 'object' },
          sourceIp: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Sistema'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Servicio operativo',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    service: { type: 'string' },
                    version: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                    environment: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/payments/process-payment': {
      post: {
        tags: ['Pagos'],
        summary: 'Procesar un pago',
        description:
          'Enruta el pago según el prefijo de la tarjeta: **4xxx → Nu/Visa** (servicio externo), **5xxx → Mastercard** (servicio interno). Requiere autenticación con `X-Api-Key`.',
        security: [{ apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['amount', 'currency', 'pan', 'cvv', 'cardHolder', 'externalReference'],
                properties: {
                  amount: { type: 'number', example: 150000, description: 'Monto en la moneda especificada (> 0)' },
                  currency: { type: 'string', enum: ['COP', 'USD', 'EUR'], example: 'COP' },
                  pan: { type: 'string', example: '5412345678901234', description: 'Número de tarjeta (13-19 dígitos)' },
                  cvv: { type: 'string', example: '123', description: 'Código de seguridad (3-4 dígitos)' },
                  cardHolder: { type: 'string', example: 'Juan Pérez' },
                  externalReference: { type: 'string', example: 'ORD-2024-001', description: 'Referencia única de la transacción en el sistema origen' },
                  description: { type: 'string', example: 'Compra de tickets - Festival de Rock' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Pago aprobado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                    transactionId: { type: 'string', format: 'uuid' },
                    status: { type: 'string', example: 'APPROVED' },
                    cardType: { type: 'string', example: 'MASTERCARD' },
                    maskedPan: { type: 'string', example: '**** **** **** 1234' },
                    amount: { type: 'number', example: 150000 },
                    currency: { type: 'string', example: 'COP' },
                    transactionDate: { type: 'string', format: 'date-time' },
                    message: { type: 'string', example: 'Payment approved' },
                  },
                },
              },
            },
          },
          402: { description: 'Pago rechazado (fondos insuficientes u otro motivo)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          409: { description: 'Referencia externa duplicada', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          422: { description: 'Tipo de tarjeta no soportado (solo prefijos 4 y 5)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          502: { description: 'Error al contactar el proveedor de pago', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/payments/{id}': {
      get: {
        tags: ['Pagos'],
        summary: 'Obtener una transacción por ID',
        security: [{ apiKey: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' }, description: 'UUID de la transacción' }],
        responses: {
          200: {
            description: 'Transacción encontrada',
            content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, transaction: { $ref: '#/components/schemas/Transaction' } } } } },
          },
          404: { description: 'Transacción no encontrada' },
        },
      },
    },

    '/api/settlements/settle': {
      post: {
        tags: ['Liquidaciones'],
        summary: 'Liquidar un conjunto de transacciones aprobadas',
        security: [{ apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['transactionIds'],
                properties: {
                  transactionIds: {
                    type: 'array',
                    items: { type: 'string', format: 'uuid' },
                    minItems: 1,
                    example: ['uuid-1', 'uuid-2'],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Liquidación procesada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    message: { type: 'string' },
                    settled: { type: 'integer', description: 'Cantidad de transacciones liquidadas' },
                    notProcessed: { type: 'array', items: { type: 'string' }, description: 'IDs no liquidados' },
                    settlementDate: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          400: { description: 'Lista de IDs vacía o inválida' },
        },
      },
    },

    '/api/settlements/report': {
      get: {
        tags: ['Liquidaciones'],
        summary: 'Reporte de liquidaciones',
        security: [{ apiKey: [] }],
        parameters: [
          { in: 'query', name: 'startDate', schema: { type: 'string', format: 'date-time' }, description: 'Fecha de inicio (ISO 8601)' },
          { in: 'query', name: 'endDate', schema: { type: 'string', format: 'date-time' }, description: 'Fecha de fin (ISO 8601)' },
        ],
        responses: {
          200: {
            description: 'Reporte de liquidaciones',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    company: { type: 'object' },
                    filters: { type: 'object', properties: { startDate: { type: 'string' }, endDate: { type: 'string' } } },
                    summary: { type: 'object', properties: { totalSettled: { type: 'integer' }, totalAmount: { type: 'number' } } },
                    transactions: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/settlements/summary': {
      get: {
        tags: ['Liquidaciones'],
        summary: 'Resumen de estadísticas de la empresa',
        security: [{ apiKey: [] }],
        responses: {
          200: {
            description: 'Resumen por estado de transacción',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    company: { type: 'object' },
                    stats: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          status: { type: 'string' },
                          count: { type: 'integer' },
                          total: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/logs': {
      get: {
        tags: ['Logs'],
        summary: 'Listar logs de transacciones',
        parameters: [
          { in: 'query', name: 'transactionId', schema: { type: 'string', format: 'uuid' }, description: 'Filtrar por ID de transacción' },
          { in: 'query', name: 'level', schema: { type: 'string', enum: ['INFO', 'WARN', 'ERROR'] }, description: 'Filtrar por nivel de log' },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 100, maximum: 500 }, description: 'Límite de resultados' },
          { in: 'query', name: 'offset', schema: { type: 'integer', default: 0 }, description: 'Desplazamiento para paginación' },
        ],
        responses: {
          200: {
            description: 'Lista de logs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    total: { type: 'integer' },
                    limit: { type: 'integer' },
                    offset: { type: 'integer' },
                    logs: { type: 'array', items: { $ref: '#/components/schemas/TransactionLog' } },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/logs/file': {
      get: {
        tags: ['Logs'],
        summary: 'Leer archivo de log del servidor',
        parameters: [
          { in: 'query', name: 'lines', schema: { type: 'integer', default: 100 }, description: 'Cantidad de líneas a retornar' },
          { in: 'query', name: 'type', schema: { type: 'string', enum: ['combined', 'error', 'transactions'], default: 'combined' }, description: 'Tipo de archivo de log' },
        ],
        responses: {
          200: {
            description: 'Contenido del archivo de log',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    file: { type: 'string' },
                    totalLines: { type: 'integer' },
                    returned: { type: 'integer' },
                    logs: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

module.exports = swaggerDefinition;