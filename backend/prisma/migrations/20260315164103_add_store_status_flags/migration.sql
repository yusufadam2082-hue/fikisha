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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Store_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Store" ("address", "category", "createdAt", "deliveryFee", "description", "id", "image", "name", "ownerId", "phone", "rating", "time", "updatedAt") SELECT "address", "category", "createdAt", "deliveryFee", "description", "id", "image", "name", "ownerId", "phone", "rating", "time", "updatedAt" FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
CREATE INDEX "Store_ownerId_idx" ON "Store"("ownerId");
CREATE INDEX "Store_category_idx" ON "Store"("category");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
