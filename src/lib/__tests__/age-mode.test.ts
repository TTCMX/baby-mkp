import { describe, expect, it } from "vitest";
import { expandRange, formatAgeRange, normalizeAgeStages, rangeBounds } from "@/lib/domain/age-mode";

describe("age modes", () => {
  it("expands a range in either order", () => {
    expect(expandRange("3_6m", "1_2y")).toEqual(["3_6m", "6_12m", "1_2y"]);
    expect(expandRange("1_2y", "3_6m")).toEqual(["3_6m", "6_12m", "1_2y"]);
    expect(expandRange("newborn", "newborn")).toEqual(["newborn"]);
  });

  it("finds the bounds of a selection", () => {
    expect(rangeBounds(["1_2y", "0_3m"])).toEqual({ from: "0_3m", to: "1_2y" });
    expect(rangeBounds(["pregnancy"])).toBeNull();
    expect(rangeBounds([])).toBeNull();
  });

  it("none: always all ages", () => {
    expect(normalizeAgeStages("none", ["0_3m"])).toEqual(["all_ages"]);
    expect(normalizeAgeStages("none", [])).toEqual(["all_ages"]);
  });

  it("range: fills gaps, drops pregnancy, keeps 'all ages'", () => {
    expect(normalizeAgeStages("range", ["0_3m", "1_2y"])).toEqual(["0_3m", "3_6m", "6_12m", "1_2y"]);
    expect(normalizeAgeStages("range", ["pregnancy"])).toEqual([]);
    expect(normalizeAgeStages("range", ["all_ages", "0_3m"])).toEqual(["all_ages"]);
  });

  it("exact: chosen stages only, never 'all ages'", () => {
    expect(normalizeAgeStages("exact", ["0_3m", "all_ages", "0_3m"])).toEqual(["0_3m"]);
    expect(normalizeAgeStages("exact", ["pregnancy", "1_2y"])).toEqual(["pregnancy", "1_2y"]);
  });

  it("formats ranges for people", () => {
    expect(formatAgeRange(["6_12m", "1_2y", "2_4y"])).toBe("De 6–12 meses a 2–4 años");
    expect(formatAgeRange(["3_6m"])).toBe("3–6 meses");
    expect(formatAgeRange(["all_ages"])).toBe("Todas las edades");
    expect(formatAgeRange(["pregnancy"])).toBe("Embarazo");
  });
});
