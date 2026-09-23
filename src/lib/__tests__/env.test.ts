import { afterEach, describe, expect, it, vi } from "vitest";

describe("publicEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("keeps only the origin of the Supabase URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co/rest/v1/");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "key");
    const { publicEnv } = await import("@/lib/env");
    expect(publicEnv().NEXT_PUBLIC_SUPABASE_URL).toBe("https://abc.supabase.co");
  });
});
