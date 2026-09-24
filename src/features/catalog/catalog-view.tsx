import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AGE_STAGES, DELIVERY_METHODS, LISTING_CONDITIONS } from "@/lib/domain/constants";
import { formatPrice } from "@/lib/money";
import { activeFilterKeys, filtersToQuery, type CatalogFilters } from "./filters";
import { FiltersButton, FiltersPanel, FiltersProvider } from "./filters-panel";
import { ListingCard } from "./listing-card";
import { PAGE_SIZE, type SearchResult } from "./queries";
import { SortSelect } from "./sort-select";

type Props = {
  title: string;
  filters: CatalogFilters;
  result: SearchResult;
  basePath: string;
  /** Category selector shown in filters; null on category pages (category is fixed). */
  categories: { slug: string; name: string }[] | null;
};

export function CatalogView({ title, filters, result, basePath, categories }: Props) {
  // On /category/[slug] the category lives in the path, not the query.
  const fixed = categories === null;
  const href = (f: Partial<CatalogFilters>) =>
    basePath + filtersToQuery({ ...filters, ...(fixed ? { category: null } : {}), page: 1, ...f });
  const chips = buildChips(filters, categories).map((c) => ({ ...c, href: href(c.remove) }));
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <FiltersProvider>
      <div className="space-y-4">
        <form action={basePath} role="search" className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Busca por producto, marca o edad…"
            aria-label="Buscar"
            className="h-12 w-full rounded-full border border-input bg-card pl-11 pr-4 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-extrabold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {result.total === 1 ? "1 producto" : `${result.total.toLocaleString("es-MX")} productos`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FiltersButton activeCount={activeFilterKeys(filters).filter((k) => !(fixed && k === "category")).length} />
            <SortSelect filters={fixed ? { ...filters, category: null } : filters} basePath={basePath} />
          </div>
        </div>

        {chips.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <li key={c.key}>
                <Link
                  href={c.href}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
                  aria-label={`Quitar filtro ${c.label}`}
                >
                  {c.label} <X className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:gap-8">
          <FiltersPanel filters={filters} basePath={basePath} categories={categories} />
          {result.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <p className="font-bold">
                {filters.page > 1 ? "Esta página ya no tiene productos" : "No encontramos productos con esos filtros"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Prueba con menos filtros o con otras palabras.</p>
              <Link href={basePath} className={buttonVariants({ variant: "outline", className: "mt-4" })}>
                Ver todo
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
                {result.items.map((listing) => (
                  <li key={listing.id}>
                    <ListingCard listing={listing} />
                  </li>
                ))}
              </ul>
              {pages > 1 && (
                <nav className="flex items-center justify-center gap-3" aria-label="Paginación">
                  {filters.page > 1 && (
                    <Link
                      href={href({ page: filters.page - 1 })}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <ChevronLeft /> Anterior
                    </Link>
                  )}
                  <span className="text-sm text-muted-foreground">
                    Página {filters.page} de {pages}
                  </span>
                  {filters.page < pages && (
                    <Link
                      href={href({ page: filters.page + 1 })}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Siguiente <ChevronRight />
                    </Link>
                  )}
                </nav>
              )}
            </div>
          )}
        </div>
      </div>
    </FiltersProvider>
  );
}

function buildChips(f: CatalogFilters, categories: { slug: string; name: string }[] | null) {
  const chips: { key: string; label: string; remove: Partial<CatalogFilters> }[] = [];
  if (f.category && categories) {
    const name = categories.find((c) => c.slug === f.category)?.name ?? f.category;
    chips.push({ key: "category", label: name, remove: { category: null } });
  }
  if (f.minPriceCents || f.maxPriceCents) {
    const label =
      f.minPriceCents && f.maxPriceCents
        ? `${formatPrice(f.minPriceCents)} – ${formatPrice(f.maxPriceCents)}`
        : f.minPriceCents
          ? `Desde ${formatPrice(f.minPriceCents)}`
          : `Hasta ${formatPrice(f.maxPriceCents!)}`;
    chips.push({ key: "price", label, remove: { minPriceCents: null, maxPriceCents: null } });
  }
  for (const a of f.ages)
    chips.push({ key: `age-${a}`, label: AGE_STAGES[a], remove: { ages: f.ages.filter((x) => x !== a) } });
  for (const c of f.conditions)
    chips.push({
      key: `cond-${c}`,
      label: LISTING_CONDITIONS[c].label,
      remove: { conditions: f.conditions.filter((x) => x !== c) },
    });
  if (f.brand) chips.push({ key: "brand", label: f.brand, remove: { brand: "" } });
  if (f.city) chips.push({ key: "city", label: f.city, remove: { city: "" } });
  for (const d of f.delivery)
    chips.push({
      key: `del-${d}`,
      label: DELIVERY_METHODS[d],
      remove: { delivery: f.delivery.filter((x) => x !== d) },
    });
  return chips;
}
