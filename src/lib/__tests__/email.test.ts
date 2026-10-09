import { describe, expect, it } from "vitest";
import { normalizeFrom } from "../email";

describe("normalizeFrom", () => {
  it("keeps valid values", () => {
    expect(normalizeFrom("mercadito.baby <avisos@mercadito.baby>")).toBe("mercadito.baby <avisos@mercadito.baby>");
    expect(normalizeFrom("avisos@mercadito.baby")).toBe("avisos@mercadito.baby");
  });

  it("fixes what gets pasted into dashboards", () => {
    for (const raw of [
      '"mercadito.baby <avisos@mercadito.baby>"',
      "  mercadito.baby <avisos@mercadito.baby>  ",
      "'mercadito.baby <avisos@mercadito.baby>'",
      '"mercadito.baby" <avisos@mercadito.baby>',
      "mercadito.baby<avisos@mercadito.baby>",
      "mercadito.baby < avisos@mercadito.baby >",
      "mercadito.baby avisos@mercadito.baby",
    ]) {
      expect(normalizeFrom(raw)).toBe("mercadito.baby <avisos@mercadito.baby>");
    }
    expect(normalizeFrom('"avisos@mercadito.baby"')).toBe("avisos@mercadito.baby");
    expect(normalizeFrom("<avisos@mercadito.baby>")).toBe("avisos@mercadito.baby");
  });

  it("is empty when unset", () => {
    expect(normalizeFrom(undefined)).toBe("");
    expect(normalizeFrom('  ""  ')).toBe("");
  });
});
