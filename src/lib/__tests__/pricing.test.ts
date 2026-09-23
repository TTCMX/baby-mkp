import { describe, expect, it } from "vitest";
import { computeOrderAmounts } from "@/lib/pricing";

describe("computeOrderAmounts", () => {
  it("splits item price between platform and seller", () => {
    const r = computeOrderAmounts({ itemPriceCents: 450_000, commissionPercentage: 10 });
    expect(r).toMatchObject({
      totalCents: 450_000,
      platformCommissionCents: 45_000,
      sellerNetCents: 405_000,
      platformNetCents: 45_000,
    });
  });

  it("passes shipping through to the seller and never takes commission on it", () => {
    const r = computeOrderAmounts({ itemPriceCents: 100_000, shippingCents: 15_000, commissionPercentage: 12 });
    expect(r.totalCents).toBe(115_000);
    expect(r.platformCommissionCents).toBe(12_000);
    expect(r.sellerNetCents).toBe(103_000);
  });

  it("subtracts payment fees from the platform net only", () => {
    const r = computeOrderAmounts({ itemPriceCents: 100_000, commissionPercentage: 10, paymentFeeCents: 4_000 });
    expect(r.sellerNetCents).toBe(90_000);
    expect(r.platformNetCents).toBe(6_000);
  });

  it("rounds commission to whole cents and supports fractional percentages", () => {
    expect(computeOrderAmounts({ itemPriceCents: 999, commissionPercentage: 12.5 }).platformCommissionCents).toBe(125);
    expect(computeOrderAmounts({ itemPriceCents: 33_333, commissionPercentage: 7.25 }).platformCommissionCents).toBe(
      2_417,
    );
  });

  it("always balances: total = seller net + commission", () => {
    for (const price of [1_000, 12_345, 500_000, 9_999_999]) {
      for (const pct of [0, 8, 10, 15.5, 25]) {
        const r = computeOrderAmounts({ itemPriceCents: price, shippingCents: 9_900, commissionPercentage: pct });
        expect(r.sellerNetCents + r.platformCommissionCents).toBe(r.totalCents);
      }
    }
  });

  it("rejects invalid input", () => {
    expect(() => computeOrderAmounts({ itemPriceCents: 10.5, commissionPercentage: 10 })).toThrow(RangeError);
    expect(() => computeOrderAmounts({ itemPriceCents: -1, commissionPercentage: 10 })).toThrow(RangeError);
    expect(() => computeOrderAmounts({ itemPriceCents: 100, commissionPercentage: 101 })).toThrow(RangeError);
  });
});
