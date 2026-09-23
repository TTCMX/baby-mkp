import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";
import { isProtectedPath } from "@/lib/supabase/proxy";

describe("safeNextPath", () => {
  it("keeps relative paths", () => {
    expect(safeNextPath("/sell/new?x=1")).toBe("/sell/new?x=1");
  });
  it("blocks open redirects", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", null, 42]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});

describe("isProtectedPath", () => {
  it("protects private areas only", () => {
    expect(isProtectedPath("/sell/new")).toBe(true);
    expect(isProtectedPath("/admin")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/listing/123")).toBe(false);
    expect(isProtectedPath("/seller")).toBe(false);
  });
});
