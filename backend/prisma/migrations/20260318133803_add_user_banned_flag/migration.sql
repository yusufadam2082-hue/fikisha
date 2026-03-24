-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "storeId" TEXT,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "password", "phone", "role", "storeId", "updatedAt", "username") SELECT "createdAt", "email", "id", "name", "password", "phone", "role", "storeId", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_storeId_idx" ON "User"("storeId");
CREATE INDEX "User_role_idx" ON "User"("role");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
