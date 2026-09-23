import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Category, Listing } from "@/lib/domain/types";

export type ListingCardData = Pick<
  Listing,
  "id" | "title" | "price_cents" | "currency" | "condition" | "city" | "municipality" | "age_stages" | "status"
> & { listing_images: { storage_path: string; position: number }[] };

const CARD_COLUMNS =
  "id, title, price_cents, currency, condition, city, municipality, age_stages, status, listing_images(storage_path, position)";

export async function getTopLevelCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .is("parent_id", null)
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function getLatestListings(limit = 12): Promise<ListingCardData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(CARD_COLUMNS)
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .order("position", { referencedTable: "listing_images" })
    .limit(1, { referencedTable: "listing_images" })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ListingCardData[];
}
