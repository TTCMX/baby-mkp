import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { track } from "@/lib/analytics/server";
import { CatalogView } from "@/features/catalog/catalog-view";
import { activeFilterKeys, parseFilters } from "@/features/catalog/filters";
import { getCategoryBySlug, searchListings } from "@/features/catalog/queries";

export async function generateMetadata({ params, searchParams }: PageProps<"/category/[category]">): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Categoría" };
  const filters = parseFilters({ ...(await searchParams), category: slug });
  // Filtered/paged views are near-duplicates of the category page itself.
  const refined = Boolean(filters.q) || activeFilterKeys(filters).some((k) => k !== "category") || filters.page > 1;
  return {
    title: `${category.name} de bebé de segunda mano`,
    description: `${category.name} de bebé de segunda mano en México, por edad y talla. Compra seguro y vende lo que tu bebé ya no usa.`,
    alternates: { canonical: `/category/${slug}` },
    ...(refined && { robots: { index: false, follow: true } }),
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/category/[category]">) {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const filters = parseFilters({ ...(await searchParams), category: slug });
  const [result, user] = await Promise.all([searchListings(filters), getCurrentUser()]);

  const applied = activeFilterKeys(filters).filter((k) => k !== "category");
  if (applied.length || filters.q) {
    await track("filter_used", user?.id ?? "anonymous", {
      category: slug,
      filters: applied.join(","),
      q: filters.q || undefined,
      results: result.total,
    });
  }

  return (
    <CatalogView
      title={category.name}
      filters={filters}
      result={result}
      basePath={`/category/${slug}`}
      categories={null}
    />
  );
}
