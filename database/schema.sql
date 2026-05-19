CREATE TYPE "CardType" AS ENUM ('VISA', 'MASTERCARD');
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'UNSETTLED', 'SETTLED');
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

CREATE TABLE companies (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  "taxId"      TEXT UNIQUE NOT NULL,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "apiKey"     TEXT UNIQUE NOT NULL,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_transactions (
  id                  TEXT PRIMARY KEY,
  "companyId"         TEXT NOT NULL REFERENCES companies(id),
  "externalReference" TEXT UNIQUE NOT NULL,
  amount              DECIMAL NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'COP',
  "cardType"          "CardType" NOT NULL,
  "maskedPan"         TEXT NOT NULL,
  "cardHolder"        TEXT NOT NULL,
  status              "TransactionStatus" NOT NULL DEFAULT 'UNSETTLED',
  "providerResponse"  JSONB,
  "transactionDate"   TIMESTAMP NOT NULL DEFAULT NOW(),
  "settlementDate"    TIMESTAMP,
  description         TEXT,
  "createdAt"         TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pt_company ON payment_transactions("companyId");
CREATE INDEX idx_pt_status  ON payment_transactions(status);
CREATE INDEX idx_pt_date    ON payment_transactions("transactionDate");

CREATE TABLE transaction_logs (
  id              TEXT PRIMARY KEY,
  "transactionId" TEXT REFERENCES payment_transactions(id),
  level           "LogLevel" NOT NULL DEFAULT 'INFO',
  event           TEXT NOT NULL,
  details         JSONB,
  "sourceIp"      TEXT,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tl_transaction ON transaction_logs("transactionId");
CREATE INDEX idx_tl_level       ON transaction_logs(level);
CREATE INDEX idx_tl_created     ON transaction_logs("createdAt");
