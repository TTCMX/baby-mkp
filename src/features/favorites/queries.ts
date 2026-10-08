import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ListingCardData } from "@/features/catalog/queries";

export async function isFavorite(userId: string, listingId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("favorites")
    .select("listing_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("listing_id", listingId);
  return (count ?? 0) > 0;
}

/** Saved listings, newest saved first. Listings no longer visible (deleted, paused) drop out via RLS. */
export async function getMyFavorites(userId: string): Promise<ListingCardData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select(
      "created_at, listing:listings(id, title, price_cents, currency, condition, city, municipality, age_stages, status, listing_images(storage_path, position))",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? [])
    .map((f) => f.listing as unknown as ListingCardData | null)
    .filter((l): l is ListingCardData => Boolean(l))
    .map((l) => ({ ...l, listing_images: [...l.listing_images].sort((a, b) => a.position - b.position).slice(0, 1) }));
}
