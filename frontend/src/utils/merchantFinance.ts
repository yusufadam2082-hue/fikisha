export interface MerchantOrderFinancials {
  itemsSubtotal: number;
  deliveryFee: number;
  platformFee: number;
  discountAmount: number;
  merchantTaxAdjustment: number;
  merchantNetIncome: number;
  customerTotal: number;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getMerchantOrderFinancials(order: any): MerchantOrderFinancials {
  const customerTotal = toNumber(order?.customerTotal ?? order?.total, 0);
  const deliveryFee = toNumber(order?.deliveryFee, 0);
  const taxAmount = toNumber(order?.taxAmount ?? order?.tax, 0);
  const platformFee = toNumber(order?.platformFee ?? order?.platformCommission, 0);
  const discountAmount = toNumber(order?.discountAmount, 0);
  const merchantTaxAdjustment = toNumber(order?.merchantTaxAdjustment, 0);

  const lineItemsTotal = Array.isArray(order?.items)
    ? order.items.reduce((sum: number, item: any) => {
        const qty = toNumber(item?.quantity, 0);
        const unitPrice = toNumber(item?.price, 0);
        return sum + qty * unitPrice;
      }, 0)
    : NaN;

  const fallbackItemsSubtotal = Math.max(0, customerTotal - deliveryFee - taxAmount + discountAmount);
  const itemsSubtotal = Number.isFinite(toNumber(order?.itemsSubtotal, NaN))
    ? toNumber(order?.itemsSubtotal, fallbackItemsSubtotal)
    : Number.isFinite(lineItemsTotal)
      ? lineItemsTotal
      : fallbackItemsSubtotal;

  const derivedNetIncome = Math.max(0, itemsSubtotal - platformFee - discountAmount + merchantTaxAdjustment);
  const merchantNetIncome = Number.isFinite(toNumber(order?.merchantNetIncome ?? order?.merchantPayout, NaN))
    ? Math.max(0, toNumber(order?.merchantNetIncome ?? order?.merchantPayout, derivedNetIncome))
    : derivedNetIncome;

  return {
    itemsSubtotal: Number(itemsSubtotal.toFixed(2)),
    deliveryFee: Number(deliveryFee.toFixed(2)),
    platformFee: Number(platformFee.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    merchantTaxAdjustment: Number(merchantTaxAdjustment.toFixed(2)),
    merchantNetIncome: Number(merchantNetIncome.toFixed(2)),
    customerTotal: Number(customerTotal.toFixed(2))
  };
}
