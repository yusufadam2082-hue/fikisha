import { describe, expect, it } from 'vitest';

function normalizeOrderStatus(status) {
  return String(status || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
}

function isPayoutEligible(order = {}) {
  const status = normalizeOrderStatus(order.status);
  const refunded = Boolean(order.refundedAt) || Number(order.refundAmount || 0) > 0;
  return status === 'DELIVERED' && !refunded;
}

function computeAccounting(order = {}) {
  const itemSubtotal = Number(order.itemSubtotal || 0);
  const deliveryFee = Number(order.deliveryFee || 0);
  const taxAmount = Number(order.taxAmount || 0);
  const serviceFee = Number(order.serviceFee || 0);
  const otherFees = Number(order.otherFees || 0);
  const merchantPlatformFee = Number(order.merchantPlatformFee || 0);
  const driverPayout = Number(order.driverPayout ?? deliveryFee ?? 0);

  const customerTotal = Number((itemSubtotal + deliveryFee + taxAmount + serviceFee + otherFees).toFixed(2));
  const merchantNetPayout = Number((itemSubtotal - merchantPlatformFee).toFixed(2));
  const platformDeliveryMargin = Number((deliveryFee - driverPayout).toFixed(2));
  const platformRevenue = Number((merchantPlatformFee + platformDeliveryMargin + serviceFee + otherFees).toFixed(2));

  return {
    customerTotal,
    merchantNetPayout,
    driverPayout,
    platformDeliveryMargin,
    platformRevenue
  };
}

describe('payout accounting rules', () => {
  it('uses item subtotal only for merchant net payout', () => {
    const result = computeAccounting({
      itemSubtotal: 1000,
      deliveryFee: 200,
      merchantPlatformFee: 100,
      driverPayout: 180
    });

    expect(result.merchantNetPayout).toBe(900);
    expect(result.customerTotal).toBe(1200);
  });

  it('computes platform revenue as fee + delivery margin + service fees', () => {
    const result = computeAccounting({
      itemSubtotal: 500,
      deliveryFee: 150,
      serviceFee: 20,
      otherFees: 10,
      merchantPlatformFee: 50,
      driverPayout: 100
    });

    expect(result.platformDeliveryMargin).toBe(50);
    expect(result.platformRevenue).toBe(130);
  });

  it('marks only delivered and non-refunded orders as payout eligible', () => {
    expect(isPayoutEligible({ status: 'DELIVERED' })).toBe(true);
    expect(isPayoutEligible({ status: 'PREPARING' })).toBe(false);
    expect(isPayoutEligible({ status: 'DELIVERED', refundAmount: 1 })).toBe(false);
  });
});
