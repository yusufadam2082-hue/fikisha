import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const legacyLedgerPath = path.join(__dirname, '..', 'accounting-payout-ledger.json');

async function loadLegacyLedger() {
  try {
    const raw = await readFile(legacyLedgerPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sumBy(items, predicate) {
  return items
    .filter(predicate)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

async function run() {
  const [legacy, merchant, driver, dbLedger] = await Promise.all([
    loadLegacyLedger(),
    prisma.merchantPayoutEntry.findMany({ select: { storeId: true, amount: true, status: true } }),
    prisma.driverPayoutEntry.findMany({ select: { driverId: true, amount: true, status: true } }),
    prisma.payoutLedger.findMany({ select: { storeId: true, driverId: true, amount: true } })
  ]);

  const legacyMerchantTotal = sumBy(legacy, (row) => !row.driverId);
  const legacyDriverTotal = sumBy(legacy, (row) => Boolean(row.driverId));

  const dbMerchantTotal = merchant.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const dbDriverTotal = driver.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const merchantDelta = Number((dbMerchantTotal - legacyMerchantTotal).toFixed(2));
  const driverDelta = Number((dbDriverTotal - legacyDriverTotal).toFixed(2));

  const report = {
    generatedAt: new Date().toISOString(),
    legacy: {
      totalEntries: legacy.length,
      merchantTotal: Number(legacyMerchantTotal.toFixed(2)),
      driverTotal: Number(legacyDriverTotal.toFixed(2))
    },
    database: {
      payoutLedgerEntries: dbLedger.length,
      merchantPayoutEntries: merchant.length,
      driverPayoutEntries: driver.length,
      merchantTotal: Number(dbMerchantTotal.toFixed(2)),
      driverTotal: Number(dbDriverTotal.toFixed(2))
    },
    delta: {
      merchant: merchantDelta,
      driver: driverDelta
    }
  };

  console.log(JSON.stringify(report, null, 2));
}

run()
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
