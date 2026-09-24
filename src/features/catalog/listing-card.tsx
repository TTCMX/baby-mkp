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
    <Link
      href={`/listing/${listing.id}`}
      className="group flex h-full flex-col gap-2.5 rounded-[22px] border-[1.5px] bg-card p-2 pb-3.5 transition-colors hover:border-sky-soft"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-sky-wash">
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
      <div className="flex flex-col gap-0.5 px-1.5">
        <p className="truncate text-sm">{listing.title}</p>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[17px] font-extrabold">{formatPrice(listing.price_cents, listing.currency)}</p>
          <p className="truncate text-xs font-bold text-muted-foreground">
            {LISTING_CONDITIONS[listing.condition].label}
          </p>
        </div>
        <p className="truncate text-xs text-muted-foreground">{listing.municipality ?? listing.city}</p>
      </div>
    </Link>
  );
}
