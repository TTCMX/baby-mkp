import { publicEnv } from "@/lib/env";

export const LISTING_IMAGES_BUCKET = "listing-images";

/** Public CDN URL for an object in a public Supabase Storage bucket. */
export function publicImageUrl(path: string, bucket = LISTING_IMAGES_BUCKET) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${publicEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${encoded}`;
}
