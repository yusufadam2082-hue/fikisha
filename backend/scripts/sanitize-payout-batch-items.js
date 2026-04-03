import { PrismaClient } from '@prisma/client';

const databaseUrl = String(process.env.DATABASE_URL || '').trim().toLowerCase();
if (!databaseUrl || (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://'))) {
  console.log('DATABASE_URL is not PostgreSQL; skipping payout batch duplicate sanitization.');
  process.exit(0);
}

const prisma = new PrismaClient();

async function run() {
  const tableExistsRows = await prisma.$queryRawUnsafe(
    "SELECT to_regclass('public.\"PayoutBatchItem\"') AS table_name"
  );

  const tableName = Array.isArray(tableExistsRows) ? tableExistsRows[0]?.table_name : null;
  if (!tableName) {
    console.log('PayoutBatchItem table not found yet; skipping duplicate cleanup.');
    return;
  }

  const beforeRows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS duplicate_rows
    FROM (
      SELECT "entryType", "entryId", COUNT(*) AS c
      FROM "PayoutBatchItem"
      GROUP BY "entryType", "entryId"
      HAVING COUNT(*) > 1
    ) d
  `);

  const duplicateGroups = Array.isArray(beforeRows) ? Number(beforeRows[0]?.duplicate_rows || 0) : 0;

  if (duplicateGroups === 0) {
    console.log('No duplicate payout batch items found.');
    return;
  }

  const deleted = await prisma.$executeRawUnsafe(`
    DELETE FROM "PayoutBatchItem" a
    USING "PayoutBatchItem" b
    WHERE a."entryType" = b."entryType"
      AND a."entryId" = b."entryId"
      AND a."id" > b."id"
  `);

  console.log(`Removed ${deleted} duplicate payout batch item rows across ${duplicateGroups} duplicate groups.`);
}

run()
  .catch((error) => {
    console.error('Failed to sanitize payout batch item duplicates:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
