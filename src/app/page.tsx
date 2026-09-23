import Link from "next/link";
import { CategoryIcon } from "@/features/catalog/category-icon";
import { ListingCard } from "@/features/catalog/listing-card";
import { getLatestListings, getTopLevelCategories } from "@/features/catalog/queries";
import { buttonVariants } from "@/components/ui/button";

export default async function HomePage() {
  const [categories, latest] = await Promise.all([getTopLevelCategories(), getLatestListings(12)]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-secondary px-5 py-6 md:px-8 md:py-10">
        <h1 className="max-w-lg text-2xl font-extrabold leading-tight md:text-4xl">
          Lo que tu bebé ya no usa, otra familia lo necesita
        </h1>
        <p className="mt-2 max-w-md text-sm text-secondary-foreground/80 md:text-base">
          Compra de segunda mano con confianza. Vende en un par de minutos.
        </p>
        <Link href="/sell/new" className={buttonVariants({ className: "mt-4" })}>
          Vender algo
        </Link>
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

      <section aria-labelledby="latest-heading">
        <h2 id="latest-heading" className="mb-3 text-lg font-extrabold">
          Nuevos
        </h2>
        {latest.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aún no hay productos publicados.{" "}
            <Link href="/sell/new" className="font-semibold text-primary">
              ¡Sé la primera persona en vender!
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {latest.map((listing) => (
              <li key={listing.id}>
                <ListingCard listing={listing} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
