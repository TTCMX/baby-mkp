import Link from "next/link";
import { ImageOff } from "lucide-react";
import { LISTING_STATUSES } from "@/lib/domain/constants";
import { formatPrice } from "@/lib/money";
import { listingPhotoUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { cleanText } from "@/features/catalog/filters";
import { ListingControls } from "@/features/admin/listing-controls";
import { LISTING_STATUS_LABELS } from "@/features/listings/listing-status";
import type { ListingStatus } from "@/lib/domain/constants";

export const metadata = { title: "Productos" };

export default async function AdminListings({ searchParams }: PageProps<"/admin/listings">) {
  const sp = await searchParams;
  const q = cleanText(typeof sp.q === "string" ? sp.q : "", 80);
  const status = LISTING_STATUSES.includes(sp.status as ListingStatus) ? (sp.status as ListingStatus) : null;

  // Admin session: RLS lets admins read every listing (drafts included).
  const supabase = await createClient();
  let query = supabase
    .from("listings")
    .select(
      "id, title, price_cents, status, created_at, seller:profiles!listings_seller_id_fkey(username), listing_images(storage_path, position)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("position", { referencedTable: "listing_images" })
    .limit(1, { referencedTable: "listing_images" })
    .limit(50);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("title", `%${q}%`);
  const { data: listings, count } = await query;

  return (
    <div className="space-y-4">
      <form className="flex gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por título…"
          className="h-10 flex-1 rounded-full border border-input bg-card px-4 text-sm"
        />
      </form>
      <nav className="flex flex-wrap gap-1.5 text-xs">
        <FilterChip href={`/admin/listings${q ? `?q=${encodeURIComponent(q)}` : ""}`} active={!status}>
          Todos
        </FilterChip>
        {LISTING_STATUSES.map((s) => (
          <FilterChip
            key={s}
            href={`/admin/listings?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            active={status === s}
          >
            {LISTING_STATUS_LABELS[s].label}
          </FilterChip>
        ))}
      </nav>
      <p className="text-sm text-muted-foreground">{count ?? 0} productos</p>

      <ul className="divide-y rounded-2xl border bg-card">
        {(listings ?? []).map((l) => {
          const cover = l.listing_images?.[0];
          const seller = l.seller as unknown as { username: string } | null;
          return (
            <li key={l.id} className="flex gap-3 p-3">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listingPhotoUrl(cover.storage_path, "thumb")}
                  alt=""
                  className="size-16 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <ImageOff className="size-5 text-muted-foreground" />
                </span>
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/listings/${l.id}`} className="font-bold hover:underline">
                    {l.title}
                  </Link>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-bold",
                      LISTING_STATUS_LABELS[l.status as ListingStatus].tone,
                    )}
                  >
                    {LISTING_STATUS_LABELS[l.status as ListingStatus].label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(l.price_cents)} · @{seller?.username}
                </p>
                <ListingControls id={l.id} status={l.status as ListingStatus} />
              </div>
            </li>
          );
        })}
        {!listings?.length && <li className="p-6 text-center text-sm text-muted-foreground">Sin resultados.</li>}
      </ul>
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn("rounded-full px-3 py-1 font-semibold", active ? "bg-foreground text-background" : "bg-muted")}
    >
      {children}
    </Link>
  );
}
