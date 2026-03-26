-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUIRES_ACTION',
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "idempotencyKey" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentIntent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentIntent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PayoutLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "orderId" TEXT,
    "storeId" TEXT,
    "storeName" TEXT,
    "driverId" TEXT,
    "driverName" TEXT,
    "cycleKey" TEXT,
    "amount" REAL NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "source" TEXT NOT NULL DEFAULT 'AUTO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "driverId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total" REAL NOT NULL,
    "deliveryFee" REAL NOT NULL,
    "tax" REAL NOT NULL DEFAULT 0,
    "deliveryOtp" TEXT,
    "deliveryOtpVerifiedAt" DATETIME,
    "pickedUpAt" DATETIME,
    "deliveredAt" DATETIME,
    "customerInfo" TEXT NOT NULL,
    "deliveryAddress" TEXT,
    "cancellationReason" TEXT,
    "refundedAt" DATETIME,
    "refundAmount" REAL,
    "refundReason" TEXT,
    "rating" REAL,
    "ratingComment" TEXT,
    "merchantResponse" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paymentProvider" TEXT,
    "paymentIntentRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("cancellationReason", "createdAt", "customerId", "customerInfo", "deliveredAt", "deliveryAddress", "deliveryFee", "deliveryOtp", "deliveryOtpVerifiedAt", "driverId", "id", "merchantResponse", "orderNumber", "pickedUpAt", "rating", "ratingComment", "refundAmount", "refundReason", "refundedAt", "status", "storeId", "tax", "total", "updatedAt") SELECT "cancellationReason", "createdAt", "customerId", "customerInfo", "deliveredAt", "deliveryAddress", "deliveryFee", "deliveryOtp", "deliveryOtpVerifiedAt", "driverId", "id", "merchantResponse", "orderNumber", "pickedUpAt", "rating", "ratingComment", "refundAmount", "refundReason", "refundedAt", "status", "storeId", "tax", "total", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE INDEX "Order_storeId_idx" ON "Order"("storeId");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX "Order_driverId_idx" ON "Order"("driverId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_orderId_key" ON "PaymentIntent"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_idempotencyKey_key" ON "PaymentIntent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentIntent_customerId_idx" ON "PaymentIntent"("customerId");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_idx" ON "PaymentIntent"("status");

-- CreateIndex
CREATE INDEX "PaymentIntent_provider_idx" ON "PaymentIntent"("provider");

-- CreateIndex
CREATE INDEX "PaymentEvent_provider_idx" ON "PaymentEvent"("provider");

-- CreateIndex
CREATE INDEX "PaymentEvent_eventType_idx" ON "PaymentEvent"("eventType");

-- CreateIndex
CREATE INDEX "PaymentEvent_createdAt_idx" ON "PaymentEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_providerEventId_key" ON "PaymentEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "PayoutLedger_type_idx" ON "PayoutLedger"("type");

-- CreateIndex
CREATE INDEX "PayoutLedger_orderId_idx" ON "PayoutLedger"("orderId");

-- CreateIndex
CREATE INDEX "PayoutLedger_storeId_idx" ON "PayoutLedger"("storeId");

-- CreateIndex
CREATE INDEX "PayoutLedger_driverId_idx" ON "PayoutLedger"("driverId");

-- CreateIndex
CREATE INDEX "PayoutLedger_cycleKey_idx" ON "PayoutLedger"("cycleKey");

-- CreateIndex
CREATE INDEX "PayoutLedger_createdAt_idx" ON "PayoutLedger"("createdAt");
