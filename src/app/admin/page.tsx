import Link from "next/link";
import { formatPrice } from "@/lib/money";
import { getMetrics } from "@/features/admin/metrics";
import { createClient } from "@/lib/supabase/server";
import { auditLabel } from "@/features/admin/audit-labels";
import { cn } from "@/lib/utils";

const pct = (n: number) => `${(n * 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`;
const dateFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

export default async function AdminHome() {
  const { all: m, recent: m30 } = await getMetrics(30);

  // Audit log read with the admin's own session (RLS: admins only).
  const supabase = await createClient();
  const { data: log } = await supabase
    .from("admin_audit_log")
    .select("id, action, entity_type, entity_id, created_at, admin:profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(10);

  const alerts = [
    { n: m.pending_review, label: "productos por revisar", href: "/admin/listings?status=pending_review" },
    { n: m.open_disputes, label: "problemas reportados", href: "/admin/orders?disputed=1" },
    { n: m.pending_payouts, label: "pagos a vendedores pendientes", href: "/admin/orders?payout=pending" },
  ].filter((a) => a.n > 0);

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {alerts.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                className="inline-flex rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 text-sm font-semibold"
              >
                {a.n} {a.label} →
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="kpi-30">
        <h2 id="kpi-30" className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Últimos 30 días
        </h2>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">GMV</p>
          <p className="text-5xl font-extrabold tracking-tight">{formatPrice(m30.gmv_cents)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {m30.orders} pedidos · ticket promedio {formatPrice(m30.avg_ticket_cents)}
          </p>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Revenue (comisión)" value={formatPrice(m30.revenue_cents)} />
          <Tile label="Revenue neto (– fees)" value={formatPrice(m30.net_revenue_cents)} />
          <Tile label="Take rate" value={pct(m30.take_rate)} />
          <Tile label="Usuarios nuevos" value={m30.new_users.toLocaleString("es-MX")} />
          <Tile label="Vendidos" value={m30.sold_listings.toLocaleString("es-MX")} />
          <Tile label="Días promedio hasta venta" value={m30.avg_days_to_sale.toLocaleString("es-MX")} />
          <Tile label="Pedidos completados" value={m30.completed_orders.toLocaleString("es-MX")} />
          <Tile label="Productos activos" value={m.active_listings.toLocaleString("es-MX")} hint="ahora" />
        </dl>
      </section>

      <section aria-labelledby="kpi-all">
        <h2 id="kpi-all" className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Histórico
        </h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="GMV" value={formatPrice(m.gmv_cents)} />
          <Tile label="Revenue" value={formatPrice(m.revenue_cents)} />
          <Tile label="Take rate" value={pct(m.take_rate)} />
          <Tile label="Sell-through" value={pct(m.sell_through)} hint="vendidos / (vendidos + activos)" />
          <Tile label="Pedidos" value={m.orders.toLocaleString("es-MX")} />
          <Tile label="Ticket promedio" value={formatPrice(m.avg_ticket_cents)} />
          <Tile label="Productos vendidos" value={m.sold_listings.toLocaleString("es-MX")} />
          <Tile label="Usuarios" value={m.new_users.toLocaleString("es-MX")} />
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Actividad reciente del equipo
        </h2>
        {log?.length ? (
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {log.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                <span>
                  <b>{(l.admin as unknown as { display_name: string } | null)?.display_name ?? "—"}</b> ·{" "}
                  {auditLabel(l.action)}
                </span>
                <span className="text-muted-foreground">{dateFmt.format(new Date(l.created_at))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sin acciones todavía.</p>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-extrabold">{value}</dd>
      {hint && <dd className="text-[11px] text-muted-foreground">{hint}</dd>}
    </div>
  );
}
