import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { DELIVERY_METHODS } from "@/lib/domain/constants";
import { formatPrice } from "@/lib/money";
import { listingPhotoUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { AutoRefresh } from "@/features/orders/auto-refresh";
import { coverOf, getOrder } from "@/features/orders/queries";
import { ORDER_STATUS } from "@/features/orders/status";
import { getPayoutAccount } from "@/features/payments/payout-account";

export const metadata: Metadata = { title: "Pedido" };

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

export default async function OrderPage({ params, searchParams }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const { paid } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser(`/orders/${id}`);
  const order = await getOrder(id);
  if (!order) notFound();

  const isSeller = order.seller_id === user.id;
  const status = ORDER_STATUS[order.status];
  const cover = coverOf(order);
  const waitingWebhook = paid === "1" && order.status === "pending_payment";
  const payout = isSeller && order.status !== "cancelled" ? await getPayoutAccount(user.id) : null;
  const addr = order.shipping_address;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {waitingWebhook && (
        <div className="flex items-center gap-3 rounded-2xl bg-secondary p-4 text-sm font-semibold">
          <Loader2 className="size-5 animate-spin" /> Confirmando tu pago…
          <AutoRefresh />
        </div>
      )}
      {paid === "1" && order.status === "paid" && !isSeller && (
        <div className="flex items-center gap-3 rounded-2xl bg-accent p-4 text-sm font-semibold text-accent-foreground">
          <CheckCircle2 className="size-5" /> ¡Listo! Tu pago está confirmado. Avisamos al vendedor.
        </div>
      )}
      {isSeller && payout && !payout.payouts_enabled && order.status !== "pending_payment" && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm">
          <p className="font-bold">Configura tus cobros para recibir {formatPrice(order.seller_net_cents)}</p>
          <p className="mt-1 text-muted-foreground">Guardamos tu dinero de forma segura hasta que lo configures.</p>
          <Link href="/settings#cobros" className={buttonVariants({ size: "sm", className: "mt-3" })}>
            Configurar cobros
          </Link>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {isSeller ? "Venta" : "Compra"} · #{order.id.slice(0, 8)}
          </p>
          <h1 className="text-2xl font-extrabold">{order.order_items[0]?.title}</h1>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", status.tone)}>{status.label}</span>
      </div>

      <Link href={`/listing/${order.listing_id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listingPhotoUrl(cover, "thumb")} alt="" className="size-16 rounded-xl object-cover" />
        )}
        <div className="text-sm">
          <p>{isSeller ? `Comprador: ${order.buyer_name}` : `Vendedor: ${order.seller_name}`}</p>
          <p className="text-muted-foreground">
            {order.paid_at
              ? `Pagado el ${dateFmt.format(new Date(order.paid_at))}`
              : dateFmt.format(new Date(order.created_at))}
          </p>
        </div>
      </Link>

      <section className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
        <h2 className="font-extrabold">Entrega</h2>
        <p>{DELIVERY_METHODS[order.delivery_method]}</p>
        {addr && (
          <address className="not-italic text-muted-foreground">
            {addr.recipientName} · {addr.phone}
            <br />
            {addr.street} {addr.exteriorNumber}
            {addr.interiorNumber ? ` int. ${addr.interiorNumber}` : ""}, {addr.neighborhood}
            <br />
            {addr.postalCode} {addr.municipality}, {addr.city}, {addr.state}
            {addr.references && (
              <>
                <br />
                Ref.: {addr.references}
              </>
            )}
          </address>
        )}
        {order.status === "paid" && (
          <p className="rounded-xl bg-muted p-3 text-xs">
            {isSeller
              ? "Prepara el producto. Muy pronto podrás marcarlo como enviado y escribir al comprador desde aquí."
              : "El vendedor ya fue notificado. Muy pronto podrás seguir la entrega y escribirle desde aquí."}
          </p>
        )}
      </section>

      <section className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
        <h2 className="font-extrabold">{isSeller ? "Tu venta" : "Tu pago"}</h2>
        <Row label="Producto" value={formatPrice(order.item_price_cents)} />
        {order.shipping_cents > 0 && <Row label="Envío" value={formatPrice(order.shipping_cents)} />}
        {isSeller ? (
          <>
            <Row
              label={`Comisión (${Number(order.commission_percentage)}%)`}
              value={`− ${formatPrice(order.platform_commission_cents)}`}
            />
            <div className="border-t pt-2">
              <Row label={<b>Recibirás</b>} value={<b>{formatPrice(order.seller_net_cents)}</b>} />
            </div>
            <p className="text-xs text-muted-foreground">
              Te transferimos cuando el comprador confirme que recibió el producto.
            </p>
          </>
        ) : (
          <div className="border-t pt-2">
            <Row label={<b>Total pagado</b>} value={<b>{formatPrice(order.total_cents)}</b>} />
          </div>
        )}
      </section>

      <Link
        href={isSeller ? "/orders?tab=sales" : "/orders"}
        className={buttonVariants({ variant: "outline", className: "w-full" })}
      >
        Ver todos mis pedidos
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
