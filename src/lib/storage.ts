import { publicEnv } from "@/lib/env";

export const LISTING_IMAGES_BUCKET = "listing-images";

/** Public CDN URL for an object in a public Supabase Storage bucket. */
export function publicImageUrl(path: string, bucket = LISTING_IMAGES_BUCKET) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${publicEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${encoded}`;
}

/** Every listing photo is stored twice: `name.ext` (≤1600px) and `name.thumb.ext` (≤600px). */
export function thumbPath(path: string) {
  return path.replace(/\.(webp|jpg)$/, ".thumb.$1");
}

export function listingPhotoUrl(path: string, size: "full" | "thumb" = "full") {
  return publicImageUrl(size === "thumb" ? thumbPath(path) : path);
}

/** Storage folder that a user may write photos of a listing into. */
export function listingFolder(userId: string, listingId: string) {
  return `${userId}/${listingId}/`;
}
