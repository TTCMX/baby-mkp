import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatPrice } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { AuditHistory } from "@/features/admin/audit-history";
import { ListingControls } from "@/features/admin/listing-controls";
import { ListingEditForm } from "@/features/admin/listing-edit-form";
import { LISTING_STATUS_LABELS } from "@/features/listings/listing-status";
import type { ListingStatus } from "@/lib/domain/constants";

export default async function AdminListing({ params }: PageProps<"/admin/listings/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [{ data: l }, { data: categories }] = await Promise.all([
    supabase
      .from("listings")
      .select("*, seller:profiles!listings_seller_id_fkey(username, display_name, status)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("categories").select("id, name").is("parent_id", null).order("sort_order"),
  ]);
  if (!l) notFound();
  const seller = l.seller as { username: string; display_name: string; status: string };
  const status = LISTING_STATUS_LABELS[l.status as ListingStatus];

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-extrabold">Editar producto</h1>
          <Link href={`/listing/${l.id}`} className="text-sm font-semibold text-primary">
            Ver publicación →
          </Link>
        </div>
        <ListingEditForm
          id={l.id}
          title={l.title}
          description={l.description}
          priceCents={l.price_cents}
          categoryId={l.category_id}
          condition={l.condition}
          categories={categories ?? []}
        />
      </section>
      <aside className="space-y-4">
        <section className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
          <p>
            Estado: <b>{status.label}</b>
          </p>
          {l.rejection_reason && <p className="text-muted-foreground">Motivo: {l.rejection_reason}</p>}
          <p>
            Vendedor:{" "}
            <Link href={`/admin/users?q=${seller.username}`} className="font-semibold text-primary">
              @{seller.username}
            </Link>{" "}
            {seller.status === "suspended" && <span className="font-bold text-destructive">(suspendido)</span>}
          </p>
          <p>Precio: {formatPrice(l.price_cents)}</p>
          <p className="text-muted-foreground">
            {l.view_count} vistas · {l.favorite_count} favoritos
          </p>
          <ListingControls id={l.id} status={l.status as ListingStatus} />
        </section>
        <section className="space-y-2 rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-extrabold">Historial</h2>
          <AuditHistory entityType="listing" entityId={l.id} />
        </section>
      </aside>
    </div>
  );
}
