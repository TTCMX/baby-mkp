import type { Metadata } from "next";
import Link from "next/link";
import { ImageOff, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { listingPhotoUrl } from "@/lib/storage";
import { buttonVariants } from "@/components/ui/button";
import { getMyListings } from "@/features/listings/queries";
import { LISTING_STATUS_LABELS } from "@/features/listings/listing-status";
import { MyListingActions } from "@/features/listings/my-listing-actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mis productos" };

const NOTICES: Record<string, string> = {
  draft: "Guardamos tu borrador. Publícalo cuando quieras.",
  pending_review: "¡Listo! Tu producto está en revisión y se publicará en cuanto lo aprobemos.",
  active: "Tus cambios están guardados.",
  inactive: "Tus cambios están guardados. El producto sigue pausado.",
};

export default async function MyListingsPage({ searchParams }: PageProps<"/sell">) {
  const user = await requireUser("/sell");
  const { saved } = await searchParams;
  const listings = await getMyListings(user.id);
  const notice = typeof saved === "string" ? NOTICES[saved] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Mis productos</h1>
        <Link href="/sell/new" className={buttonVariants({ size: "sm" })}>
          <Plus /> Vender
        </Link>
      </div>

      {notice && <p className="rounded-2xl bg-accent p-4 text-sm font-semibold text-accent-foreground">{notice}</p>}

      {listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-bold">Aún no vendes nada</p>
          <p className="mt-1 text-sm text-muted-foreground">Publicar toma un par de minutos.</p>
          <Link href="/sell/new" className={buttonVariants({ className: "mt-4" })}>
            Vender mi primer producto
          </Link>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {listings.map((l) => {
            const cover = l.listing_images[0];
            const status = LISTING_STATUS_LABELS[l.status];
            const isPublic = l.status === "active" || l.status === "reserved" || l.status === "sold";
            return (
              <li key={l.id} className="flex gap-3 p-3">
                <Link href={isPublic ? `/listing/${l.id}` : `/sell/${l.id}/edit`} className="shrink-0">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={listingPhotoUrl(cover.storage_path, "thumb")}
                      alt=""
                      className="size-20 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="flex size-20 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <ImageOff className="size-6" />
                    </span>
                  )}
                </Link>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-bold">{l.title}</p>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", status.tone)}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm font-extrabold">{formatPrice(l.price_cents, l.currency)}</p>
                  {l.status === "active" && (
                    <p className="text-xs text-muted-foreground">
                      {l.view_count} vistas · {l.favorite_count} favoritos
                    </p>
                  )}
                  <MyListingActions id={l.id} status={l.status} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
