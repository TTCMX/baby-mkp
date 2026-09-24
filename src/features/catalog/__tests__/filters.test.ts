import { describe, expect, it } from "vitest";
import { activeFilterKeys, filtersToQuery, parseFilters, toTsQuery } from "@/features/catalog/filters";

describe("parseFilters", () => {
  it("parses a full query string", () => {
    const f = parseFilters({
      q: " Nuna  PIPA ",
      category: "sillas-de-auto",
      min: "1,000",
      max: "4000",
      condition: "like_new,excellent",
      age: ["0_3m", "3_6m"],
      city: "CDMX",
      delivery: "shipping",
      sort: "price_asc",
      page: "2",
    });
    expect(f).toEqual({
      q: "Nuna PIPA",
      category: "sillas-de-auto",
      minPriceCents: 100_000,
      maxPriceCents: 400_000,
      brand: "",
      conditions: ["like_new", "excellent"],
      ages: ["0_3m", "3_6m"],
      city: "CDMX",
      delivery: ["shipping"],
      sort: "price_asc",
      page: 2,
    });
  });

  it("ignores invalid values instead of failing", () => {
    const f = parseFilters({
      condition: "broken,good",
      age: "99y",
      sort: "hack",
      page: "-3",
      category: "../x",
      min: "abc",
    });
    expect(f.conditions).toEqual(["good"]);
    expect(f.ages).toEqual([]);
    expect(f.sort).toBe("recent");
    expect(f.page).toBe(1);
    expect(f.category).toBeNull();
    expect(f.minPriceCents).toBeNull();
  });

  it("swaps inverted price ranges", () => {
    const f = parseFilters({ min: "5000", max: "1000" });
    expect([f.minPriceCents, f.maxPriceCents]).toEqual([100_000, 500_000]);
  });

  it("strips characters that could alter PostgREST filters", () => {
    expect(parseFilters({ city: "CDMX),status.eq.draft" }).city).toBe("CDMX status.eq.draft");
    expect(parseFilters({ q: "silla (alta)*" }).q).toBe("silla alta");
  });
});

describe("filtersToQuery", () => {
  it("round-trips and omits defaults", () => {
    const f = parseFilters({ q: "cuna", age: "0_3m", min: "500", sort: "recent", page: "1" });
    expect(filtersToQuery(f)).toBe("?q=cuna&min=500&age=0_3m");
    expect(parseFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f))))).toEqual(f);
    expect(filtersToQuery({})).toBe("");
  });
});

describe("toTsQuery", () => {
  it("builds a prefix AND query", () => {
    expect(toTsQuery("Carri Nuna")).toBe("carri:* & nuna:*");
    expect(toTsQuery("ropa 6 meses")).toBe("ropa:* & 6:* & meses:*");
    expect(toTsQuery("   ")).toBeNull();
  });
});

describe("activeFilterKeys", () => {
  it("lists applied filters", () => {
    expect(activeFilterKeys(parseFilters({ q: "x", max: "100", age: "1_2y" }))).toEqual(["price", "age"]);
  });
});

describe("normalizeLocation", () => {
  it("removes accents and expands aliases", async () => {
    const { normalizeLocation } = await import("@/features/catalog/filters");
    expect(normalizeLocation("Coyoacán")).toBe("coyoacan");
    expect(normalizeLocation(" CDMX ")).toBe("ciudad de mexico");
    expect(normalizeLocation("Ciudad de México")).toBe("ciudad de mexico");
    expect(normalizeLocation("San Pedro Garza García")).toBe("san pedro garza garcia");
  });
});
