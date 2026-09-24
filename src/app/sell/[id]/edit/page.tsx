import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOwnListing } from "@/features/listings/queries";
import { SellWizard } from "@/features/listings/sell/sell-wizard";
import { loadWizardContext } from "@/features/listings/sell/load-wizard";

export const metadata: Metadata = { title: "Editar producto" };

const centsToInput = (cents: number | null) => (cents == null ? "" : String(cents / 100));

export default async function EditListingPage({ params }: PageProps<"/sell/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser(`/sell/${id}/edit`);
  const listing = await getOwnListing(id, user.id);
  if (!listing) notFound();
  if (listing.status === "reserved" || listing.status === "sold") redirect(`/listing/${id}`);

  const context = await loadWizardContext(user);

  return (
    <SellWizard
      {...context}
      mode="edit"
      userId={user.id}
      listingId={listing.id}
      initialPhotos={listing.listing_images.map((i) => ({ path: i.storage_path, width: i.width, height: i.height }))}
      initialFields={{
        title: listing.title,
        description: listing.description,
        categoryId: listing.category_id,
        brand: listing.brand ?? "",
        model: listing.model ?? "",
        condition: listing.condition,
        ageStages: listing.age_stages,
        isBundle: listing.listing_type === "bundle",
        bundleItemCount: listing.bundle_item_count ? String(listing.bundle_item_count) : "",
        price: centsToInput(listing.price_cents),
        city: listing.city,
        municipality: listing.municipality ?? "",
        deliveryMethods: listing.delivery_methods,
        shippingPrice: centsToInput(listing.shipping_price_cents),
      }}
    />
  );
}
