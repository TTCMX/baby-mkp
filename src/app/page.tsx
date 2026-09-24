import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ListingCard } from "@/features/catalog/listing-card";
import { getListingsForStages } from "@/features/catalog/queries";
import { BundleStrip } from "@/features/home/bundle-strip";
import { DEMO_BUNDLES, DEMO_FAMILY } from "@/features/home/demo-data";
import { FamilyHome } from "@/features/home/family-home";

export default async function HomePage() {
  const user = await getCurrentUser();
  const city = user?.profile.city ?? null;
  const family = DEMO_FAMILY;
  const listingsByBaby = await Promise.all(family.babies.map((b) => getListingsForStages(b.shopStages, 5)));

  const feeds = Object.fromEntries(
    family.babies.map((baby, i) => {
      const listings = listingsByBaby[i];
      return [
        baby.id,
        listings.length === 0 ? (
          <div className="rounded-[22px] border-[1.5px] border-dashed p-8 text-center text-sm text-muted-foreground">
            Aún no hay productos en talla {baby.shopSize}.{" "}
            <Link href="/sell/new" className="font-semibold text-primary">
              ¡Sé la primera persona en vender!
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-[18px] lg:grid-cols-5">
            {listings.map((listing) => (
              <li key={listing.id}>
                <ListingCard listing={listing} />
              </li>
            ))}
          </ul>
        ),
      ];
    }),
  );

  return (
    <div className="flex flex-col gap-8 md:gap-10 md:pt-5">
      <FamilyHome
        family={family}
        feeds={feeds}
        nearHref={city ? `/search?city=${encodeURIComponent(city)}` : "/search"}
      />
      <BundleStrip bundles={DEMO_BUNDLES} />
    </div>
  );
}
