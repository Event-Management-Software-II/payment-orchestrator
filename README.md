# Payment Gateway - Central Orchestrator

Central payment gateway service for the ticket sales system. It orchestrates transactions between the client app, Visa/Mastercard services, and the settlement module.

The gateway stores in its own database:

- Companies that use the gateway, including API keys and active/inactive status.
- Payment transactions linked to each company.
- Audit logs linked to transactions.

## Stack

- Node.js + Express
- Prisma ORM
- Dedicated SQLite database
- Winston file logging

## Setup

```bash
npm install
cp .env.example .env
npm run db:push
npm run seed
npm run dev
```

The server runs at `http://localhost:3000` by default.

## Environment Variables

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="file:./payment_gateway.db"
VISA_SERVICE_URL=http://localhost:3001
MASTERCARD_SERVICE_URL=http://localhost:3002
TICKETS_SERVICE_URL=http://localhost:4000
```

## Company Authentication

Payment and settlement routes require:

```http
X-Api-Key: sk_tickets_abc123def456
```

Initial companies are loaded with `npm run seed`.

## Endpoints

| Method | Route | Description |
| --- | --- | --- |
| GET | `/health` | Service health |
| POST | `/api/payments/process-payment` | Process a payment |
| GET | `/api/payments/:id` | Get a transaction |
| POST | `/api/settlements/settle` | Settle approved transactions |
| GET | `/api/settlements/report` | Settlement report by company |
| GET | `/api/settlements/summary` | Company totals by transaction status |
| GET | `/api/logs` | Database logs |
| GET | `/api/logs/file` | Winston file logs |

## Payment Flow

1. Authenticate the company through `X-Api-Key`.
2. Detect card type from PAN: `4` for Visa, `5` for Mastercard.
3. Prevent duplicates with `externalReference`.
4. Call the card service at `/api/validate`.
5. Store the transaction with Prisma.
6. Call the card service at `/api/charge`.
7. Update the transaction as `APPROVED` or `REJECTED`.
