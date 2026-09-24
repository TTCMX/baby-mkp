import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DELIVERY_METHODS, type DeliveryMethod, type OrderStatus } from "@/lib/domain/constants";
import { formatPrice } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { AuditHistory } from "@/features/admin/audit-history";
import { OrderControls } from "@/features/admin/order-controls";
import { ORDER_STATUS } from "@/features/orders/status";

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});
const stripeBase = () =>
  `https://dashboard.stripe.com${process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "" : "/test"}`;

export default async function AdminOrder({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient(); // admin session
  const [{ data: o }, { data: payment }, { data: payout }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "*, order_items(title), buyer:profiles!orders_buyer_id_fkey(username, display_name), seller:profiles!orders_seller_id_fkey(username, display_name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("payments")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("payouts").select("*").eq("order_id", id).neq("status", "cancelled").maybeSingle(),
  ]);
  if (!o) notFound();
  const buyer = o.buyer as { username: string; display_name: string };
  const seller = o.seller as { username: string; display_name: string };
  const openDispute = Boolean(o.disputed_at && !o.dispute_resolved_at);
  const t = (d: string | null) => (d ? dateFmt.format(new Date(d)) : "—");

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pedido #{o.id.slice(0, 8)}</p>
          <h1 className="text-xl font-extrabold">{(o.order_items as { title: string }[])[0]?.title}</h1>
          <p className="text-sm">
            <b>{ORDER_STATUS[o.status as OrderStatus].label}</b> ·{" "}
            {DELIVERY_METHODS[o.delivery_method as DeliveryMethod]}
          </p>
        </div>

        {o.disputed_at && (
          <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-bold">
              {openDispute ? "Problema reportado (abierto)" : "Problema reportado (resuelto)"}
            </p>
            <p className="mt-1 whitespace-pre-line">“{o.dispute_reason}”</p>
            <p className="mt-1 text-muted-foreground">Reportado: {t(o.disputed_at)}</p>
            {o.dispute_resolution && <p className="mt-1">Resolución: {o.dispute_resolution}</p>}
          </section>
        )}

        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="font-extrabold">Acciones</h2>
          <OrderControls id={o.id} status={o.status} openDispute={openDispute} />
        </section>

        <section className="grid gap-2 rounded-2xl border bg-card p-4 text-sm sm:grid-cols-2">
          <p>
            Comprador:{" "}
            <Link className="font-semibold text-primary" href={`/admin/users?q=${buyer.username}`}>
              {buyer.display_name} (@{buyer.username})
            </Link>
          </p>
          <p>
            Vendedor:{" "}
            <Link className="font-semibold text-primary" href={`/admin/users?q=${seller.username}`}>
              {seller.display_name} (@{seller.username})
            </Link>
          </p>
          {o.shipping_address && (
            <p className="sm:col-span-2 text-muted-foreground">
              Dirección:{" "}
              {Object.values(o.shipping_address as Record<string, string>)
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
          {(o.tracking_carrier || o.tracking_number) && (
            <p className="sm:col-span-2">
              Guía: {o.tracking_carrier} {o.tracking_number}
            </p>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-4 text-sm">
          <h2 className="mb-2 font-extrabold">Dinero</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Producto</dt>
            <dd className="text-right">{formatPrice(o.item_price_cents)}</dd>
            <dt className="text-muted-foreground">Envío</dt>
            <dd className="text-right">{formatPrice(o.shipping_cents)}</dd>
            <dt className="font-bold">Total cobrado</dt>
            <dd className="text-right font-bold">{formatPrice(o.total_cents)}</dd>
            <dt className="text-muted-foreground">Comisión ({Number(o.commission_percentage)}%)</dt>
            <dd className="text-right">{formatPrice(o.platform_commission_cents)}</dd>
            <dt className="text-muted-foreground">Fee de Stripe</dt>
            <dd className="text-right">− {formatPrice(o.payment_fee_cents)}</dd>
            <dt className="text-muted-foreground">Neto plataforma</dt>
            <dd className="text-right">{formatPrice(o.platform_net_cents)}</dd>
            <dt className="text-muted-foreground">Neto vendedor</dt>
            <dd className="text-right">{formatPrice(o.seller_net_cents)}</dd>
          </dl>
          <div className="mt-3 space-y-1 border-t pt-3 text-xs">
            <p>
              Pago: {payment?.status ?? "—"}
              {payment?.stripe_payment_intent_id && (
                <>
                  {" · "}
                  <a
                    className="text-primary"
                    href={`${stripeBase()}/payments/${payment.stripe_payment_intent_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ver en Stripe
                  </a>
                </>
              )}
            </p>
            <p>
              Payout al vendedor: {payout?.status ?? "aún no"}
              {payout?.failure_reason && <span className="text-destructive"> · {payout.failure_reason}</span>}
              {payout?.stripe_transfer_id && (
                <>
                  {" · "}
                  <a
                    className="text-primary"
                    href={`${stripeBase()}/connect/transfers/${payout.stripe_transfer_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ver transferencia
                  </a>
                </>
              )}
            </p>
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-2xl border bg-card p-4 text-sm">
          <h2 className="mb-2 font-extrabold">Línea de tiempo</h2>
          <ul className="space-y-1 text-muted-foreground">
            <li>Creado: {t(o.created_at)}</li>
            <li>Pagado: {t(o.paid_at)}</li>
            <li>Enviado: {t(o.shipped_at)}</li>
            <li>Entregado: {t(o.delivered_at)}</li>
            <li>Completado: {t(o.completed_at)}</li>
            {o.refunded_at && <li>Reembolsado: {t(o.refunded_at)}</li>}
            {o.cancel_reason && <li>Motivo: {o.cancel_reason}</li>}
          </ul>
        </section>
        <section className="space-y-2 rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-extrabold">Historial de admin</h2>
          <AuditHistory entityType="order" entityId={o.id} />
        </section>
      </aside>
    </div>
  );
}
