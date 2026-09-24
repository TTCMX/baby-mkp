import Link from "next/link";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/domain/constants";
import { formatPrice } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ORDER_STATUS } from "@/features/orders/status";

export const metadata = { title: "Pedidos" };

const dateFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeZone: "America/Mexico_City" });

export default async function AdminOrders({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams;
  const status = ORDER_STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : null;
  const disputed = sp.disputed === "1";
  const payoutPending = sp.payout === "pending";

  const supabase = await createClient(); // admin session (RLS: is_admin)
  let query = supabase
    .from("orders")
    .select(
      "id, status, total_cents, platform_commission_cents, created_at, disputed_at, dispute_resolved_at, order_items(title), buyer:profiles!orders_buyer_id_fkey(username), seller:profiles!orders_seller_id_fkey(username)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (status) query = query.eq("status", status);
  else query = query.neq("status", "pending_payment");
  if (disputed) query = query.not("disputed_at", "is", null).is("dispute_resolved_at", null);
  if (payoutPending) {
    const { data: p } = await supabase.from("payouts").select("order_id").in("status", ["pending", "failed"]);
    query = query.in("id", (p ?? []).map((x) => x.order_id).concat("00000000-0000-0000-0000-000000000000"));
  }
  const { data: orders, count } = await query;

  const chip = (href: string, active: boolean, label: string) => (
    <Link
      key={href}
      href={href}
      className={cn("rounded-full px-3 py-1 font-semibold", active ? "bg-foreground text-background" : "bg-muted")}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1.5 text-xs">
        {chip("/admin/orders", !status && !disputed && !payoutPending, "Todos")}
        {chip("/admin/orders?disputed=1", disputed, "Con problema")}
        {chip("/admin/orders?payout=pending", payoutPending, "Pago pendiente")}
        {ORDER_STATUSES.map((s) => chip(`/admin/orders?status=${s}`, status === s, ORDER_STATUS[s].label))}
      </nav>
      <p className="text-sm text-muted-foreground">{count ?? 0} pedidos</p>
      <ul className="divide-y rounded-2xl border bg-card">
        {(orders ?? []).map((o) => {
          const s = ORDER_STATUS[o.status as OrderStatus];
          const openDispute = o.disputed_at && !o.dispute_resolved_at;
          return (
            <li key={o.id}>
              <Link
                href={`/admin/orders/${o.id}`}
                className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">
                    {(o.order_items as { title: string }[])[0]?.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    #{o.id.slice(0, 8)} · @{(o.buyer as unknown as { username: string }).username} → @
                    {(o.seller as unknown as { username: string }).username} · {dateFmt.format(new Date(o.created_at))}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-sm">
                  {openDispute && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
                      Problema
                    </span>
                  )}
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", s.tone)}>{s.label}</span>
                  <b>{formatPrice(o.total_cents)}</b>
                </span>
              </Link>
            </li>
          );
        })}
        {!orders?.length && <li className="p-6 text-center text-sm text-muted-foreground">Sin pedidos.</li>}
      </ul>
    </div>
  );
}
