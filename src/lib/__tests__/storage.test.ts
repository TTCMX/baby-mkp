import { describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "key");

const { listingPhotoUrl, thumbPath } = await import("@/lib/storage");

describe("storage paths", () => {
  it("derives the thumbnail path", () => {
    expect(thumbPath("u/l/abc.webp")).toBe("u/l/abc.thumb.webp");
    expect(thumbPath("u/l/abc.jpg")).toBe("u/l/abc.thumb.jpg");
  });

  it("builds public URLs", () => {
    expect(listingPhotoUrl("u/l/a.webp", "thumb")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/listing-images/u/l/a.thumb.webp",
    );
  });
});
