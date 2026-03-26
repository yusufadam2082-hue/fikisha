-- AlterTable
ALTER TABLE "Order" ADD COLUMN "merchantResponse" TEXT;
ALTER TABLE "Order" ADD COLUMN "rating" REAL;
ALTER TABLE "Order" ADD COLUMN "ratingComment" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "lowStockThreshold" INTEGER;
ALTER TABLE "Product" ADD COLUMN "maxQuantityPerOrder" INTEGER;
ALTER TABLE "Product" ADD COLUMN "prepTimeOverride" INTEGER;
ALTER TABLE "Product" ADD COLUMN "quantityAvailable" INTEGER;
ALTER TABLE "Product" ADD COLUMN "sku" TEXT;

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT,
    "merchantId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "adminResponse" TEXT,
    "attachmentUrls" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportTicket_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rating" REAL NOT NULL DEFAULT 5.0,
    "time" TEXT NOT NULL DEFAULT '15-25 min',
    "deliveryFee" REAL NOT NULL DEFAULT 2.99,
    "category" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "pausedOrders" BOOLEAN NOT NULL DEFAULT false,
    "busyMode" BOOLEAN NOT NULL DEFAULT false,
    "prepDelayMinutes" INTEGER,
    "operatingHours" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Store_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Store" ("address", "category", "createdAt", "deliveryFee", "description", "id", "image", "isActive", "isOpen", "name", "ownerId", "phone", "rating", "time", "updatedAt") SELECT "address", "category", "createdAt", "deliveryFee", "description", "id", "image", "isActive", "isOpen", "name", "ownerId", "phone", "rating", "time", "updatedAt" FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
CREATE INDEX "Store_ownerId_idx" ON "Store"("ownerId");
CREATE INDEX "Store_category_idx" ON "Store"("category");
CREATE TABLE "new_Promotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "ctaText" TEXT NOT NULL DEFAULT 'Order now',
    "ctaLink" TEXT,
    "bgColor" TEXT NOT NULL DEFAULT '#FF5A5F',
    "image" TEXT,
    "discountType" TEXT,
    "discountValue" REAL,
    "minOrderValue" REAL,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "storeId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Promotion_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Promotion" ("active", "bgColor", "createdAt", "ctaLink", "ctaText", "endsAt", "id", "image", "startsAt", "subtitle", "title", "updatedAt") SELECT "active", "bgColor", "createdAt", "ctaLink", "ctaText", "endsAt", "id", "image", "startsAt", "subtitle", "title", "updatedAt" FROM "Promotion";
DROP TABLE "Promotion";
ALTER TABLE "new_Promotion" RENAME TO "Promotion";
CREATE INDEX "Promotion_storeId_idx" ON "Promotion"("storeId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE INDEX "SupportTicket_storeId_idx" ON "SupportTicket"("storeId");

-- CreateIndex
CREATE INDEX "SupportTicket_merchantId_idx" ON "SupportTicket"("merchantId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");
