import { describe, expect, it } from "vitest";
import { formatPrice, parsePriceToCents } from "@/lib/money";

describe("money", () => {
  it("formats MXN prices", () => {
    expect(formatPrice(450_000)).toBe("$4,500");
    expect(formatPrice(450_050)).toBe("$4,500.50");
  });

  it("parses user input into cents", () => {
    expect(parsePriceToCents("4500")).toBe(450_000);
    expect(parsePriceToCents("$4,500.5")).toBe(450_050);
    expect(parsePriceToCents("12.34")).toBe(1_234);
    expect(parsePriceToCents("abc")).toBeNull();
    expect(parsePriceToCents("1.234")).toBeNull();
    expect(parsePriceToCents("")).toBeNull();
  });
});
