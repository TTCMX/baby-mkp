import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Category, Listing, Profile } from "@/lib/domain/types";

export type ListingImageRow = { storage_path: string; position: number; width: number | null; height: number | null };
export type ListingWithImages = Listing & { listing_images: ListingImageRow[] };

export type SellerSummary = Pick<
  Profile,
  | "id"
  | "username"
  | "display_name"
  | "avatar_url"
  | "city"
  | "municipality"
  | "sales_count"
  | "rating_avg"
  | "rating_count"
> & { active_listings: number };

export type ListingDetail = ListingWithImages & {
  category: Pick<Category, "id" | "slug" | "name"> | null;
  seller: SellerSummary;
};

const SELLER_COLUMNS =
  "id, username, display_name, avatar_url, city, municipality, sales_count, rating_avg, rating_count";

function sortImages<T extends { listing_images: ListingImageRow[] }>(row: T): T {
  row.listing_images.sort((a, b) => a.position - b.position);
  return row;
}

/** A listing the current user owns, for the edit wizard. RLS hides others' drafts. */
export async function getOwnListing(id: string, userId: string): Promise<ListingWithImages | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("*, listing_images(storage_path, position, width, height)")
    .eq("id", id)
    .eq("seller_id", userId)
    .maybeSingle<ListingWithImages>();
  return data ? sortImages(data) : null;
}

export async function getMyListings(userId: string): Promise<ListingWithImages[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*, listing_images(storage_path, position, width, height)")
    .eq("seller_id", userId)
    .order("updated_at", { ascending: false })
    .returns<ListingWithImages[]>();
  if (error) throw error;
  return (data ?? []).map(sortImages);
}

export async function getSellerSummary(userId: string): Promise<SellerSummary | null> {
  const supabase = await createClient();
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select(SELLER_COLUMNS).eq("id", userId).maybeSingle(),
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", userId)
      .eq("status", "active"),
  ]);
  return profile ? { ...(profile as Omit<SellerSummary, "active_listings">), active_listings: count ?? 0 } : null;
}

/** Public listing page. Returns null when missing or not visible to the viewer (RLS). */
export async function getListingDetail(id: string): Promise<ListingDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(
      "*, listing_images(storage_path, position, width, height), category:categories!listings_category_id_fkey(id, slug, name)",
    )
    .eq("id", id)
    .maybeSingle<ListingWithImages & { category: ListingDetail["category"] }>();
  if (!data) return null;

  const seller = await getSellerSummary(data.seller_id);
  if (!seller) return null;
  return { ...sortImages(data), seller };
}

export async function getActiveCategories(): Promise<Category[]> {
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

export async function getBrandNames(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("brands").select("name").eq("is_active", true).order("name");
  return (data ?? []).map((b) => b.name as string);
}
