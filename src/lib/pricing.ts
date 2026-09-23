/**
 * Order money breakdown. Pure and deterministic so it can be unit-tested
 * and reused by checkout, webhooks and admin.
 *
 * Policy (MVP):
 *   - The buyer pays item price + shipping.
 *   - The platform commission is a percentage of the ITEM price only.
 *   - Shipping is passed through to the seller (the seller ships).
 *   - Payment processor fees are absorbed by the platform; they are known
 *     only after the charge, so platformNet is recomputed then.
 * The commission percentage comes from platform_settings, never hardcoded.
 */
export type OrderAmountsInput = {
  itemPriceCents: number;
  shippingCents?: number;
  commissionPercentage: number;
  paymentFeeCents?: number;
};

export type OrderAmounts = {
  itemPriceCents: number;
  shippingCents: number;
  totalCents: number;
  commissionPercentage: number;
  platformCommissionCents: number;
  paymentFeeCents: number;
  sellerNetCents: number;
  platformNetCents: number;
};

function assertCents(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative integer (cents)`);
}

export function computeOrderAmounts(input: OrderAmountsInput): OrderAmounts {
  const { itemPriceCents, shippingCents = 0, commissionPercentage, paymentFeeCents = 0 } = input;
  assertCents("itemPriceCents", itemPriceCents);
  assertCents("shippingCents", shippingCents);
  assertCents("paymentFeeCents", paymentFeeCents);
  if (!Number.isFinite(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) {
    throw new RangeError("commissionPercentage must be between 0 and 100");
  }

  // Round half up to whole cents, computed in basis points to avoid float drift.
  const bps = Math.round(commissionPercentage * 100);
  const platformCommissionCents = Math.round((itemPriceCents * bps) / 10_000);

  return {
    itemPriceCents,
    shippingCents,
    totalCents: itemPriceCents + shippingCents,
    commissionPercentage,
    platformCommissionCents,
    paymentFeeCents,
    sellerNetCents: itemPriceCents - platformCommissionCents + shippingCents,
    platformNetCents: platformCommissionCents - paymentFeeCents,
  };
}
