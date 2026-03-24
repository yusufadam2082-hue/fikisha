-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "ctaText" TEXT NOT NULL DEFAULT 'Order now',
    "ctaLink" TEXT,
    "bgColor" TEXT NOT NULL DEFAULT '#FF5A5F',
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
