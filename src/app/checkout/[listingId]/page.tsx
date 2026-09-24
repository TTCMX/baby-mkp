import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { listingPhotoUrl } from "@/lib/storage";
import { isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { CheckoutForm, type SavedAddress } from "@/features/checkout/checkout-form";
import { releaseCheckout } from "@/features/checkout/release";
import { getListingDetail } from "@/features/listings/queries";

export const metadata: Metadata = { title: "Comprar" };

export default async function CheckoutPage({ params, searchParams }: PageProps<"/checkout/[listingId]">) {
  const { listingId } = await params;
  const { cancelled } = await searchParams;
  if (!z.uuid().safeParse(listingId).success) notFound();
  const user = await requireUser(`/checkout/${listingId}`);

  // Came back from Stripe without paying: free the listing right away.
  if (typeof cancelled === "string") await releaseCheckout(cancelled, user.id);

  const listing = await getListingDetail(listingId);
  if (!listing) notFound();

  const unavailable =
    listing.seller_id === user.id
      ? "Este es tu producto."
      : listing.status !== "active"
        ? "Este producto ya no está disponible."
        : !isStripeConfigured()
          ? "Los pagos se activarán muy pronto."
          : null;

  const supabase = await createClient();
  const { data: address } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_default", true)
    .maybeSingle();
  const savedAddress: SavedAddress = address
    ? {
        recipientName: address.recipient_name,
        phone: address.phone ?? "",
        street: address.street,
        exteriorNumber: address.exterior_number ?? "",
        interiorNumber: address.interior_number ?? "",
        neighborhood: address.neighborhood ?? "",
        municipality: address.municipality,
        city: address.city,
        state: address.state,
        postalCode: address.postal_code,
        references: address.references_note ?? "",
      }
    : {
        recipientName: user.profile.display_name,
        city: user.profile.city ?? "",
        municipality: user.profile.municipality ?? "",
      };

  const cover = listing.listing_images[0];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-extrabold">Comprar</h1>

      {typeof cancelled === "string" && (
        <p className="rounded-2xl bg-secondary p-4 text-sm font-semibold">
          No se completó el pago. No se te hizo ningún cargo.
        </p>
      )}

      <Link href={`/listing/${listing.id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listingPhotoUrl(cover.storage_path, "thumb")} alt="" className="size-16 rounded-xl object-cover" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{listing.title}</p>
          <p className="text-sm font-extrabold text-primary">{formatPrice(listing.price_cents, listing.currency)}</p>
          <p className="truncate text-xs text-muted-foreground">Vende {listing.seller.display_name}</p>
        </div>
      </Link>

      {unavailable ? (
        <div className="rounded-2xl border border-dashed p-6 text-center">
          <p className="font-bold">{unavailable}</p>
          <Link href="/search" className={buttonVariants({ variant: "outline", className: "mt-4" })}>
            Seguir explorando
          </Link>
        </div>
      ) : (
        <CheckoutForm
          listingId={listing.id}
          priceCents={listing.price_cents}
          shippingPriceCents={listing.shipping_price_cents}
          deliveryMethods={listing.delivery_methods}
          sellerLocation={[listing.municipality, listing.city].filter(Boolean).join(", ")}
          savedAddress={savedAddress}
        />
      )}
    </div>
  );
}
