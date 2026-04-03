import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORDER_STATUS = {
  DELIVERED: 'DELIVERED'
};

const PAYOUT_STATUS = {
  PENDING: 'PENDING',
  HELD: 'HELD'
};

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeOrderStatus(status) {
  const key = String(status || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
  if (key === 'READYFORPICKUP') return 'READY_FOR_PICKUP';
  if (key === 'OUTFORDELIVERY' || key === 'INTRANSIT' || key === 'ONTHEWAY') return 'OUT_FOR_DELIVERY';
  return key;
}

function computeMerchantOrderFinancials(order = {}) {
  const customerTotal = toNumber(order.customerTotal ?? order.total, 0);
  const deliveryFee = toNumber(order.deliveryFee, 0);
  const taxAmount = toNumber(order.taxAmount ?? order.tax, 0);
  const platformFee = toNumber(order.merchantPlatformFee ?? order.platformFee ?? order.platformCommission, 0);
  const discountAmount = toNumber(order.discountAmount, 0);
  const merchantTaxAdjustment = toNumber(order.merchantTaxAdjustment, 0);

  const itemsFromLines = Array.isArray(order.items)
    ? order.items.reduce((sum, item) => {
      const qty = toNumber(item?.quantity, 0);
      const price = toNumber(item?.price, 0);
      return sum + (qty * price);
    }, 0)
    : NaN;

  const derivedItemsSubtotal = Number.isFinite(itemsFromLines)
    ? itemsFromLines
    : Math.max(0, customerTotal - deliveryFee - taxAmount + discountAmount);

  const explicitItemsSubtotal = Number(order.itemsSubtotal);
  const itemsSubtotal = Number.isFinite(explicitItemsSubtotal)
    ? explicitItemsSubtotal
    : derivedItemsSubtotal;

  const derivedNet = Math.max(0, itemsSubtotal - platformFee - discountAmount + merchantTaxAdjustment);
  const explicitNet = Number(order.merchantNetIncome ?? order.merchantPayout);
  const merchantNetIncome = Number.isFinite(explicitNet)
    ? Math.max(0, explicitNet)
    : derivedNet;

  return {
    itemsSubtotal: Number(itemsSubtotal.toFixed(2)),
    deliveryFee: Number(deliveryFee.toFixed(2)),
    platformFee: Number(platformFee.toFixed(2)),
    merchantNetIncome: Number(merchantNetIncome.toFixed(2)),
    customerTotal: Number(customerTotal.toFixed(2))
  };
}

function computeOrderAccountingSnapshot(order = {}) {
  const financials = computeMerchantOrderFinancials(order);
  const itemSubtotal = toNumber(financials.itemsSubtotal, 0);
  const deliveryFee = toNumber(financials.deliveryFee, 0);
  const taxAmount = toNumber(order.taxAmount ?? order.tax, 0);
  const serviceFee = toNumber(order.serviceFee, 0);
  const otherFees = toNumber(order.otherFees, 0);

  const rawCustomerTotal = toNumber(order.customerTotal ?? order.total, NaN);
  const customerTotal = Number.isFinite(rawCustomerTotal)
    ? rawCustomerTotal
    : itemSubtotal + deliveryFee + taxAmount + serviceFee + otherFees;

  const merchantPlatformFee = toNumber(financials.platformFee, 0);
  const merchantNetPayout = Number(financials.merchantNetIncome.toFixed(2));

  const explicitDriverPayout = Number(order.driverPayout);
  const driverPayout = Number.isFinite(explicitDriverPayout)
    ? Math.max(0, explicitDriverPayout)
    : Math.max(0, deliveryFee);

  const platformDeliveryMargin = Number((deliveryFee - driverPayout).toFixed(2));
  const platformRevenue = Number((merchantPlatformFee + platformDeliveryMargin + serviceFee + otherFees).toFixed(2));
  const payoutEligible = normalizeOrderStatus(order.status) === ORDER_STATUS.DELIVERED && !order.refundedAt && toNumber(order.refundAmount, 0) <= 0;

  return {
    itemSubtotal: Number(itemSubtotal.toFixed(2)),
    deliveryFee: Number(deliveryFee.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    serviceFee: Number(serviceFee.toFixed(2)),
    otherFees: Number(otherFees.toFixed(2)),
    customerTotal: Number(customerTotal.toFixed(2)),
    merchantPlatformFee: Number(merchantPlatformFee.toFixed(2)),
    merchantNetPayout: Number(merchantNetPayout.toFixed(2)),
    driverPayout: Number(driverPayout.toFixed(2)),
    platformDeliveryMargin,
    platformRevenue,
    payoutEligible
  };
}

async function run() {
  const deliveredOrders = await prisma.order.findMany({
    where: {
      status: ORDER_STATUS.DELIVERED,
      refundedAt: null
    },
    include: {
      items: true,
      store: { select: { id: true } },
      driver: { select: { id: true } }
    },
    orderBy: { updatedAt: 'asc' }
  });

  let processed = 0;
  let skipped = 0;

  for (const order of deliveredOrders) {
    const snapshot = computeOrderAccountingSnapshot(order);
    if (!snapshot.payoutEligible) {
      skipped += 1;
      continue;
    }

    const merchantStatus = PAYOUT_STATUS.PENDING;
    const driverStatus = order.driverId ? PAYOUT_STATUS.PENDING : PAYOUT_STATUS.HELD;

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          itemSubtotal: snapshot.itemSubtotal,
          deliveryFee: snapshot.deliveryFee,
          taxAmount: snapshot.taxAmount,
          serviceFee: snapshot.serviceFee,
          otherFees: snapshot.otherFees,
          customerTotal: snapshot.customerTotal,
          merchantPlatformFee: snapshot.merchantPlatformFee,
          merchantNetPayout: snapshot.merchantNetPayout,
          driverPayout: snapshot.driverPayout,
          platformDeliveryMargin: snapshot.platformDeliveryMargin,
          platformRevenue: snapshot.platformRevenue,
          payoutEligible: snapshot.payoutEligible,
          merchantPayoutStatus: merchantStatus,
          driverPayoutStatus: driverStatus
        }
      });

      if (snapshot.merchantNetPayout > 0) {
        await tx.merchantPayoutEntry.upsert({
          where: { orderId: order.id },
          update: {
            amount: snapshot.merchantNetPayout,
            status: merchantStatus,
            note: 'Backfilled from delivered order'
          },
          create: {
            orderId: order.id,
            storeId: order.storeId,
            amount: snapshot.merchantNetPayout,
            status: merchantStatus,
            note: 'Backfilled from delivered order'
          }
        });
      }

      if (order.driverId && snapshot.driverPayout > 0) {
        await tx.driverPayoutEntry.upsert({
          where: { orderId: order.id },
          update: {
            amount: snapshot.driverPayout,
            status: PAYOUT_STATUS.PENDING,
            note: 'Backfilled from delivered order'
          },
          create: {
            orderId: order.id,
            driverId: order.driverId,
            amount: snapshot.driverPayout,
            status: PAYOUT_STATUS.PENDING,
            note: 'Backfilled from delivered order'
          }
        });
      }

      await tx.platformRevenueEntry.upsert({
        where: { orderId: order.id },
        update: {
          merchantPlatformFee: snapshot.merchantPlatformFee,
          deliveryMargin: snapshot.platformDeliveryMargin,
          serviceFee: snapshot.serviceFee,
          otherFees: snapshot.otherFees,
          totalRevenue: snapshot.platformRevenue
        },
        create: {
          orderId: order.id,
          merchantPlatformFee: snapshot.merchantPlatformFee,
          deliveryMargin: snapshot.platformDeliveryMargin,
          serviceFee: snapshot.serviceFee,
          otherFees: snapshot.otherFees,
          totalRevenue: snapshot.platformRevenue
        }
      });
    });

    processed += 1;
  }

  console.log(JSON.stringify({ processed, skipped, totalDelivered: deliveredOrders.length }, null, 2));
}

run()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
