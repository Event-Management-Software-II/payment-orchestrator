# Sistema de Logging - Payment Orchestrator

Este repositorio ya usa Winston para logging avanzado.

## Ubicación
- `src/utils/logger.js` (Winston)

## Archivos de Log
```
logs/
├── combined.log
├── error.log
└── transactions.log
```

## Recomendaciones
- Centralizar logs (ELK, Loki)
- Añadir request IDs en todas las rutas si aún no están
