import Link from "next/link";
import { ImageOff } from "lucide-react";
import { LISTING_CONDITIONS } from "@/lib/domain/constants";
import { formatPrice } from "@/lib/money";
import { listingPhotoUrl } from "@/lib/storage";
import type { ListingCardData } from "./queries";

/** Photo-first product card used across catalogue grids. */
export function ListingCard({ listing }: { listing: ListingCardData }) {
  const cover = listing.listing_images[0];

  return (
    <Link href={`/listing/${listing.id}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- photos are pre-resized thumbnails
          <img
            src={listingPhotoUrl(cover.storage_path, "thumb")}
            alt={listing.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-8" />
          </div>
        )}
        {listing.status === "reserved" && (
          <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2.5 py-1 text-xs font-bold">
            Reservado
          </span>
        )}
      </div>
      <div className="mt-2 space-y-0.5 px-0.5">
        <p className="text-base font-extrabold">{formatPrice(listing.price_cents, listing.currency)}</p>
        <p className="line-clamp-1 text-sm">{listing.title}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {LISTING_CONDITIONS[listing.condition].label} · {listing.municipality ?? listing.city}
        </p>
      </div>
    </Link>
  );
}
