import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Category, Listing } from "@/lib/domain/types";
import { normalizeLocation, toTsQuery, type CatalogFilters } from "./filters";

export type ListingCardData = Pick<
  Listing,
  "id" | "title" | "price_cents" | "currency" | "condition" | "city" | "municipality" | "age_stages" | "status"
> & { listing_images: { storage_path: string; position: number }[] };

const CARD_COLUMNS =
  "id, title, price_cents, currency, condition, city, municipality, age_stages, status, listing_images(storage_path, position)";

export const PAGE_SIZE = 24;

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

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").eq("slug", slug).eq("is_active", true).maybeSingle();
  return data;
}

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Active listings with only their cover photo. Synchronous on purpose: the
 * builder is thenable, so returning it from an async function would run it.
 */
function cardQuery(supabase: Client) {
  return supabase
    .from("listings")
    .select(CARD_COLUMNS, { count: "exact" })
    .eq("status", "active")
    .order("position", { referencedTable: "listing_images" })
    .limit(1, { referencedTable: "listing_images" });
}

export async function getLatestListings(limit = 12): Promise<ListingCardData[]> {
  const { data, error } = await cardQuery(await createClient())
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ListingCardData[];
}

export async function getPopularListings(limit = 8): Promise<ListingCardData[]> {
  const { data, error } = await cardQuery(await createClient())
    .gt("favorite_count", 0)
    .order("favorite_count", { ascending: false })
    .order("view_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ListingCardData[];
}

export async function getListingsNear(city: string, limit = 8): Promise<ListingCardData[]> {
  const { data, error } = await cardQuery(await createClient())
    .ilike("location_text", `${normalizeLocation(city)}%`)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ListingCardData[];
}

export type SearchResult = { items: ListingCardData[]; total: number; categoryId: string | null };

/** Catalogue search: full-text + combinable filters, paginated. */
export async function searchListings(f: CatalogFilters): Promise<SearchResult> {
  let categoryId: string | null = null;
  if (f.category) {
    const category = await getCategoryBySlug(f.category);
    if (!category) return { items: [], total: 0, categoryId: null };
    categoryId = category.id;
  }

  let query = cardQuery(await createClient());

  const tsQuery = toTsQuery(f.q);
  if (tsQuery) query = query.filter("search_vector", "fts(es_unaccent)", tsQuery);
  if (categoryId) query = query.or(`category_id.eq.${categoryId},subcategory_id.eq.${categoryId}`);
  if (f.minPriceCents) query = query.gte("price_cents", f.minPriceCents);
  if (f.maxPriceCents) query = query.lte("price_cents", f.maxPriceCents);
  if (f.brand) query = query.ilike("brand", `%${f.brand}%`);
  if (f.conditions.length) query = query.in("condition", f.conditions);
  if (f.ages.length) query = query.overlaps("age_stages", f.ages);
  if (f.delivery.length) query = query.overlaps("delivery_methods", f.delivery);
  const location = normalizeLocation(f.city);
  if (location) query = query.ilike("location_text", `%${location}%`);

  switch (f.sort) {
    case "price_asc":
      query = query.order("price_cents", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price_cents", { ascending: false });
      break;
    case "popular":
      query = query.order("favorite_count", { ascending: false }).order("view_count", { ascending: false });
      break;
  }
  query = query.order("published_at", { ascending: false });

  const from = (f.page - 1) * PAGE_SIZE;
  const { data, error, count, status } = await query.range(from, from + PAGE_SIZE - 1);
  // A page past the end answers 416 (e.g. an old link after listings sold): show it empty.
  if (status === 416) return { items: [], total: 0, categoryId };
  if (error) throw error;
  return { items: (data ?? []) as ListingCardData[], total: count ?? 0, categoryId };
}
