import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Loader2, Mail, Phone, Star, TriangleAlert } from "lucide-react";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { DELIVERY_METHODS } from "@/lib/domain/constants";
import { formatPrice } from "@/lib/money";
import { getPlatformSettings } from "@/lib/settings";
import { listingPhotoUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { AutoRefresh } from "@/features/orders/auto-refresh";
import { BuyerActions, ReviewForm, SellerActions } from "@/features/orders/order-actions";
import { coverOf, getOrder, getOrderExtras } from "@/features/orders/queries";
import { ORDER_STATUS } from "@/features/orders/status";
import { getPayoutAccount } from "@/features/payments/payout-account";
import { completeOrderIfDue } from "@/features/payments/payouts";

export const metadata: Metadata = { title: "Pedido" };

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

const PAYOUT_STATUS: Record<string, string> = {
  pending: "Pendiente: configura tus cobros para recibirlo",
  in_transit: "En camino a tu cuenta",
  paid: "Transferido a tu cuenta de Stripe",
  failed: "Hubo un problema con la transferencia; lo reintentaremos",
};

export default async function OrderPage({ params, searchParams }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const { paid } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser(`/orders/${id}`);
  let order = await getOrder(id);
  if (!order) notFound();

  const settings = await getPlatformSettings();
  const autoCompleteDays = settings.order_auto_complete_days;

  // Confirmation window elapsed and nobody reported a problem: complete it now
  // (the daily job does the same for orders nobody opens).
  // (Not re-fetched: Next memoizes identical GETs within a render and would return the stale row.)
  if (await completeOrderIfDue(order, autoCompleteDays)) {
    order = { ...order, status: "completed", completed_at: new Date().toISOString() };
  }

  const isSeller = order.seller_id === user.id;
  const status = ORDER_STATUS[order.status];
  const cover = coverOf(order);
  const waitingWebhook = paid === "1" && order.status === "pending_payment";
  const extras = await getOrderExtras(order, user.id);
  const payoutAccount =
    isSeller && !["cancelled", "refunded", "pending_payment"].includes(order.status)
      ? await getPayoutAccount(user.id)
      : null;
  const addr = order.shipping_address;
  const counterpartName = isSeller ? order.buyer_name : order.seller_name;
  const myReview = extras.reviews.find((r) => r.reviewer_id === user.id);
  const theirReview = extras.reviews.find((r) => r.reviewer_id !== user.id);
  const open = ["paid", "in_delivery", "delivered"].includes(order.status) && !order.disputed_at;

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
      {payoutAccount && !payoutAccount.payouts_enabled && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm">
          <p className="font-bold">Configura tus cobros para recibir {formatPrice(order.seller_net_cents)}</p>
          <p className="mt-1 text-muted-foreground">Guardamos tu dinero de forma segura hasta que lo configures.</p>
          <Link href="/settings#cobros" className={buttonVariants({ size: "sm", className: "mt-3" })}>
            Configurar cobros
          </Link>
        </div>
      )}
      {order.disputed_at && (
        <div className="flex gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <TriangleAlert className="size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-bold">{isSeller ? "El comprador reportó un problema" : "Reportaste un problema"}</p>
            <p className="mt-1 whitespace-pre-line text-muted-foreground">“{order.dispute_reason}”</p>
            <p className="mt-2 text-muted-foreground">
              Nuestro equipo lo revisará y los contactará. El pago al vendedor queda en pausa mientras tanto.
            </p>
          </div>
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

      {open && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-extrabold">{isSeller ? "Siguiente paso" : "¿Ya lo tienes?"}</h2>
          {isSeller ? (
            order.status === "delivered" ? (
              <p className="text-sm text-muted-foreground">
                Esperando a que el comprador confirme. Si no reporta ningún problema, la venta se completa sola en{" "}
                {autoCompleteDays} días.
              </p>
            ) : (
              <SellerActions orderId={order.id} status={order.status} deliveryMethod={order.delivery_method} />
            )
          ) : (
            <BuyerActions orderId={order.id} autoCompleteDays={autoCompleteDays} />
          )}
        </section>
      )}

      {extras.contact && ["paid", "in_delivery", "delivered"].includes(order.status) && (
        <section className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
          <h2 className="font-extrabold">Contacto de {extras.contact.display_name}</h2>
          <p className="text-xs text-muted-foreground">Úsalo solo para coordinar la entrega de este pedido.</p>
          {extras.contact.email && (
            <a href={`mailto:${extras.contact.email}`} className="flex items-center gap-2 font-semibold text-primary">
              <Mail className="size-4" /> {extras.contact.email}
            </a>
          )}
          {extras.contact.phone && (
            <a href={`tel:${extras.contact.phone}`} className="flex items-center gap-2 font-semibold text-primary">
              <Phone className="size-4" /> {extras.contact.phone}
            </a>
          )}
        </section>
      )}

      <section className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
        <h2 className="font-extrabold">Entrega</h2>
        <p>{DELIVERY_METHODS[order.delivery_method]}</p>
        {(order.tracking_carrier || order.tracking_number) && (
          <p>
            Guía:{" "}
            <span className="font-semibold">
              {[order.tracking_carrier, order.tracking_number].filter(Boolean).join(" · ")}
            </span>
          </p>
        )}
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
        <ul className="space-y-0.5 pt-1 text-xs text-muted-foreground">
          {order.shipped_at && <li>Enviado: {dateFmt.format(new Date(order.shipped_at))}</li>}
          {order.delivered_at && <li>Entregado: {dateFmt.format(new Date(order.delivered_at))}</li>}
          {order.completed_at && <li>Completado: {dateFmt.format(new Date(order.completed_at))}</li>}
        </ul>
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
              <Row
                label={<b>{extras.payout?.status === "paid" ? "Recibiste" : "Recibirás"}</b>}
                value={<b>{formatPrice(order.seller_net_cents)}</b>}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {extras.payout
                ? (PAYOUT_STATUS[extras.payout.status] ?? extras.payout.status)
                : "Te transferimos cuando el comprador confirme que recibió el producto."}
            </p>
          </>
        ) : (
          <div className="border-t pt-2">
            <Row label={<b>Total pagado</b>} value={<b>{formatPrice(order.total_cents)}</b>} />
          </div>
        )}
      </section>

      {order.status === "completed" && (
        <section className="space-y-3 rounded-2xl border bg-card p-4 text-sm">
          <h2 className="font-extrabold">Reseñas</h2>
          {myReview ? (
            <ReviewLine label="Tu reseña" rating={myReview.rating} comment={myReview.comment} />
          ) : (
            <ReviewForm orderId={order.id} revieweeName={counterpartName} />
          )}
          {theirReview && (
            <ReviewLine
              label={`${counterpartName} te calificó`}
              rating={theirReview.rating}
              comment={theirReview.comment}
            />
          )}
        </section>
      )}

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

function ReviewLine({ label, rating, comment }: { label: string; rating: number; comment: string | null }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 flex gap-0.5" aria-label={`${rating} de 5 estrellas`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={cn("size-4", n <= rating ? "fill-primary text-primary" : "text-muted-foreground")} />
        ))}
      </p>
      {comment && <p className="mt-1">{comment}</p>}
    </div>
  );
}
