import { describe, expect, it } from "vitest";
import { bankFromClabe, cleanClabe, isValidClabe, maskClabe, payoutDate } from "../clabe";

describe("CLABE", () => {
  it("validates the check digit", () => {
    expect(isValidClabe("002180001234567896")).toBe(true);
    expect(isValidClabe("012180009876543215")).toBe(true);
    expect(isValidClabe("002180001234567890")).toBe(false);
    expect(isValidClabe("00218000123456789")).toBe(false);
    expect(isValidClabe("00218000123456789a")).toBe(false);
  });

  it("cleans pasted input and suggests the bank", () => {
    expect(cleanClabe("002 180-0012 3456 7896")).toBe("002180001234567896");
    expect(bankFromClabe("012180009876543215")).toBe("BBVA México");
    expect(bankFromClabe("999180009876543215")).toBeNull();
    expect(maskClabe("002180001234567896")).toBe("•••• 7896");
  });
});

describe("payoutDate (Friday cutoff → Tuesday)", () => {
  it.each([
    ["2026-10-02", "2026-10-06"], // Friday → next Tuesday
    ["2026-10-03", "2026-10-13"], // Saturday → Tuesday after next Friday
    ["2026-10-04", "2026-10-13"], // Sunday
    ["2026-10-05", "2026-10-13"], // Monday
    ["2026-10-06", "2026-10-13"], // Tuesday (payout day itself) → next week
    ["2026-10-09", "2026-10-13"], // Friday
    ["2026-12-26", "2027-01-05"], // across the year
  ])("%s → %s", (day, tuesday) => {
    expect(payoutDate(day)).toBe(tuesday);
  });
});

describe("formatPayoutDate", () => {
  it("formats the calendar date without timezone shifts", async () => {
    const { formatPayoutDate } = await import("../format");
    expect(formatPayoutDate("2026-10-13")).toBe("martes 13 de octubre");
  });
});

describe("withdrawalsCsv", () => {
  it("escapes cells and formats amounts", async () => {
    const { withdrawalsCsv } = await import("../csv");
    const csv = withdrawalsCsv([
      {
        holder_name: 'Ana "Anita" López, P.',
        clabe: "002180001234567896",
        bank_name: "Banamex",
        amount_cents: 123450,
        id: "abcdef12-0000",
      },
    ]);
    expect(csv.startsWith("﻿Beneficiario,CLABE,Banco,Monto,Concepto,Referencia\r\n")).toBe(true);
    expect(csv).toContain(
      '"Ana ""Anita"" López, P.",002180001234567896,Banamex,1234.50,Retiro mercadito.baby,abcdef12',
    );
  });
});
