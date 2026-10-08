import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Heart, MessageCircle, ShoppingBag } from "lucide-react";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { track } from "@/lib/analytics/server";
import { formatPrice } from "@/lib/money";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { listingPhotoUrl } from "@/lib/storage";
import { createPublicClient } from "@/lib/supabase/public";
import { Button, buttonVariants } from "@/components/ui/button";
import { getListingDetail, type ListingDetail } from "@/features/listings/queries";
import { ListingView, type ListingViewData } from "@/features/listings/listing-view";
import { LISTING_STATUS_LABELS } from "@/features/listings/listing-status";

async function load(id: string) {
  return z.uuid().safeParse(id).success ? getListingDetail(id) : null;
}

export async function generateMetadata({ params }: PageProps<"/listing/[id]">): Promise<Metadata> {
  const listing = await load((await params).id);
  if (!listing) return { title: "Producto no encontrado" };
  const cover = listing.listing_images[0];
  return {
    title: `${listing.title} · ${formatPrice(listing.price_cents, listing.currency)}`,
    description: listing.description.slice(0, 160) || listing.title,
    alternates: { canonical: `/listing/${listing.id}` },
    // Replaces the layout's openGraph object, so repeat the site-wide fields.
    openGraph: {
      siteName: SITE_NAME,
      locale: "es_MX",
      type: "website",
      title: listing.title,
      ...(cover && { images: [listingPhotoUrl(cover.storage_path)] }),
    },
  };
}

function toViewData(l: ListingDetail): ListingViewData {
  return {
    title: l.title,
    description: l.description,
    priceCents: l.price_cents,
    currency: l.currency,
    condition: l.condition,
    brand: l.brand,
    model: l.model,
    ageStages: l.age_stages,
    ageMode: l.category?.age_mode,
    gender: l.gender,
    categoryName: l.category?.name ?? null,
    isBundle: l.listing_type === "bundle",
    bundleItemCount: l.bundle_item_count,
    city: l.city,
    municipality: l.municipality,
    deliveryMethods: l.delivery_methods,
    shippingPriceCents: l.shipping_price_cents,
    images: l.listing_images.map((i) => ({
      src: listingPhotoUrl(i.storage_path),
      thumb: listingPhotoUrl(i.storage_path, "thumb"),
      width: i.width,
      height: i.height,
    })),
    seller: {
      username: l.seller.username,
      displayName: l.seller.display_name,
      avatarUrl: l.seller.avatar_url,
      salesCount: l.seller.sales_count,
      ratingAvg: l.seller.rating_avg,
      ratingCount: l.seller.rating_count,
      activeListings: l.seller.active_listings,
    },
  };
}

export default async function ListingPage({ params, searchParams }: PageProps<"/listing/[id]">) {
  const { id } = await params;
  const { published } = await searchParams;
  const [listing, user] = await Promise.all([load(id), getCurrentUser()]);
  if (!listing) notFound();

  const isOwner = user?.id === listing.seller_id;
  if (!isOwner && listing.status === "active") {
    // Counted after the response so the page never waits for it (owners are excluded above).
    after(async () => {
      await createPublicClient().rpc("record_listing_view", { p_listing_id: listing.id });
    });
    await track("listing_viewed", user?.id ?? "anonymous", {
      listing_id: listing.id,
      category: listing.category?.slug,
    });
  }

  const status = LISTING_STATUS_LABELS[listing.status];

  return (
    <div className="space-y-4">
      <script
        type="application/ld+json"
        // Escape "<" so listing text can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(listing)).replace(/</g, "\\u003c") }}
      />
      {isOwner && published === "1" && listing.status === "active" && (
        <p className="rounded-2xl bg-accent p-4 text-sm font-semibold text-accent-foreground">
          🎉 ¡Tu producto ya está publicado! Comparte el enlace para venderlo más rápido.
        </p>
      )}
      {isOwner && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3 text-sm">
          <span>
            Este es tu producto · <span className="font-bold">{status.label}</span>
            {listing.status === "active" && ` · ${listing.view_count} vistas`}
          </span>
          <div className="flex gap-2">
            {listing.status !== "reserved" && listing.status !== "sold" && (
              <Link href={`/sell/${listing.id}/edit`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                Editar
              </Link>
            )}
            <Link href="/sell" className={buttonVariants({ size: "sm", variant: "ghost" })}>
              Mis productos
            </Link>
          </div>
        </div>
      )}

      <ListingView
        data={toViewData(listing)}
        actions={isOwner ? null : <BuyerActions listingId={listing.id} status={listing.status} />}
      />
    </div>
  );
}

/** schema.org Product, so search engines can show price and availability. */
function productJsonLd(l: ListingDetail) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: l.title,
    description: l.description || l.title,
    image: l.listing_images.map((i) => listingPhotoUrl(i.storage_path)),
    ...(l.brand && { brand: { "@type": "Brand", name: l.brand } }),
    ...(l.category && { category: l.category.name }),
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/listing/${l.id}`,
      price: (l.price_cents / 100).toFixed(2),
      priceCurrency: l.currency,
      itemCondition:
        l.condition === "new_with_tags" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
      availability: l.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
    },
  };
}

function BuyerActions({ listingId, status }: { listingId: string; status: ListingDetail["status"] }) {
  if (status === "sold" || status === "reserved") {
    return (
      <p className="rounded-2xl bg-muted p-4 text-center text-sm font-bold">
        {status === "sold" ? "Este producto ya se vendió" : "Alguien lo está comprando en este momento"}
      </p>
    );
  }
  // Favorites and chat arrive in the next stages.
  return (
    <div className="space-y-2">
      <Link href={`/checkout/${listingId}`} className={buttonVariants({ size: "lg", className: "w-full" })}>
        <ShoppingBag /> Comprar
      </Link>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled>
          <MessageCircle /> Contactar
        </Button>
        <Button variant="outline" disabled>
          <Heart /> Guardar
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Pago protegido: el vendedor recibe tu dinero cuando confirmas que recibiste el producto.
      </p>
    </div>
  );
}
