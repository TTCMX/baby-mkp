import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

// Regenerated at most hourly; search engines don't need it fresher.
export const revalidate = 3600;

const MAX_LISTINGS = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: "daily", priority: 0.8 },
  ];
  try {
    const supabase = createPublicClient();
    const [{ data: categories }, { data: listings }] = await Promise.all([
      supabase.from("categories").select("slug, updated_at").eq("is_active", true).is("parent_id", null),
      supabase
        .from("listings")
        .select("id, updated_at")
        .eq("status", "active")
        .order("published_at", { ascending: false })
        .limit(MAX_LISTINGS),
    ]);
    for (const c of categories ?? []) {
      entries.push({ url: `${SITE_URL}/category/${c.slug}`, lastModified: c.updated_at, priority: 0.7 });
    }
    for (const l of listings ?? []) {
      entries.push({ url: `${SITE_URL}/listing/${l.id}`, lastModified: l.updated_at, priority: 0.6 });
    }
  } catch (err) {
    // Without the database (e.g. a build without env vars) still serve the static entries.
    console.error("[sitemap]", err);
  }
  return entries;
}
