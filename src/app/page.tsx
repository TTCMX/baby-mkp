import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { AGE_STAGES, keysOf } from "@/lib/domain/constants";
import { CategoryIcon } from "@/features/catalog/category-icon";
import { ListingCard } from "@/features/catalog/listing-card";
import {
  getLatestListings,
  getListingsNear,
  getPopularListings,
  getTopLevelCategories,
  type ListingCardData,
} from "@/features/catalog/queries";
import { buttonVariants } from "@/components/ui/button";

export default async function HomePage() {
  const user = await getCurrentUser();
  const city = user?.profile.city ?? null;
  const [categories, latest, popular, near] = await Promise.all([
    getTopLevelCategories(),
    getLatestListings(12),
    getPopularListings(8),
    city ? getListingsNear(city, 8) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-secondary px-5 py-6 md:px-8 md:py-10">
        <h1 className="max-w-lg text-2xl font-extrabold leading-tight md:text-4xl">
          Lo que tu bebé ya no usa, otra familia lo necesita
        </h1>
        <p className="mt-2 max-w-md text-sm text-secondary-foreground/80 md:text-base">
          Compra de segunda mano con confianza. Vende en un par de minutos.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/sell/new" className={buttonVariants()}>
            Vender algo
          </Link>
          <Link href="/search" className={buttonVariants({ variant: "outline" })}>
            Explorar
          </Link>
        </div>
      </section>

      <section aria-labelledby="categories-heading">
        <h2 id="categories-heading" className="sr-only">
          Categorías
        </h2>
        <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-5 md:px-0">
          {categories.map((c) => (
            <li key={c.id} className="shrink-0">
              <Link
                href={`/category/${c.slug}`}
                className="flex w-20 flex-col items-center gap-1.5 text-center text-xs font-semibold md:w-auto md:flex-row md:rounded-2xl md:border md:bg-card md:p-3 md:text-left md:text-sm"
              >
                <span className="flex size-14 items-center justify-center rounded-2xl bg-card shadow-sm md:size-10 md:bg-muted md:shadow-none">
                  <CategoryIcon icon={c.icon} className="size-6 text-primary md:size-5" />
                </span>
                <span className="leading-tight">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="stages-heading">
        <h2 id="stages-heading" className="mb-3 text-lg font-extrabold">
          Compra por etapa
        </h2>
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
          {keysOf(AGE_STAGES)
            .filter((a) => a !== "all_ages")
            .map((a) => (
              <li key={a} className="shrink-0">
                <Link
                  href={`/search?age=${a}`}
                  className="inline-block rounded-full border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted"
                >
                  {AGE_STAGES[a]}
                </Link>
              </li>
            ))}
        </ul>
      </section>

      {latest.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no hay productos publicados.{" "}
          <Link href="/sell/new" className="font-semibold text-primary">
            ¡Sé la primera persona en vender!
          </Link>
        </div>
      ) : (
        <>
          <ListingSection title="Nuevos" href="/search" listings={latest} />
          {near.length > 0 && city && (
            <ListingSection
              title={`Cerca de ti · ${city}`}
              href={`/search?city=${encodeURIComponent(city)}`}
              listings={near}
            />
          )}
          {popular.length > 0 && <ListingSection title="Populares" href="/search?sort=popular" listings={popular} />}
        </>
      )}
    </div>
  );
}

function ListingSection({ title, href, listings }: { title: string; href: string; listings: ListingCardData[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <Link href={href} className="inline-flex items-center text-sm font-semibold text-primary">
          Ver todo <ChevronRight className="size-4" />
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
        {listings.map((listing) => (
          <li key={listing.id}>
            <ListingCard listing={listing} />
          </li>
        ))}
      </ul>
    </section>
  );
}
