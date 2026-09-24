import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { track } from "@/lib/analytics/server";
import { CatalogView } from "@/features/catalog/catalog-view";
import { activeFilterKeys, parseFilters } from "@/features/catalog/filters";
import { getTopLevelCategories, searchListings } from "@/features/catalog/queries";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const { q } = parseFilters(await searchParams);
  return { title: q ? `${q} — Buscar` : "Explorar" };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const filters = parseFilters(await searchParams);
  const [result, categories, user] = await Promise.all([
    searchListings(filters),
    getTopLevelCategories(),
    getCurrentUser(),
  ]);

  const distinctId = user?.id ?? "anonymous";
  const applied = activeFilterKeys(filters);
  if (filters.q) await track("search_performed", distinctId, { q: filters.q, results: result.total });
  if (applied.length) await track("filter_used", distinctId, { filters: applied.join(","), results: result.total });

  return (
    <CatalogView
      title={filters.q ? `Resultados para “${filters.q}”` : "Explorar"}
      filters={filters}
      result={result}
      basePath="/search"
      categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
    />
  );
}
