import "server-only";
import { formatPrice } from "@/lib/money";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const REFUNDABLE = ["paid", "in_delivery", "delivered", "completed"];

/**
 * Full refund of an order to the buyer: the card part through Stripe and the
 * part paid with balance back to their balance. If the seller was already
 * credited for the sale, it's taken back from their balance. Idempotent per
 * order. The listing goes to "inactive": the seller decides whether to publish
 * it again once they get the product back.
 */
export async function refundOrder(orderId: string, reason: string, resolution?: string) {
  const admin = createAdminClient();

  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) throw new Error("order_not_found");
  if (!REFUNDABLE.includes(order.status)) throw new Error("not_refundable");

  const { data: payments } = await admin
    .from("payments")
    .select("id, provider, stripe_payment_intent_id, amount_cents")
    .eq("order_id", orderId)
    .eq("status", "succeeded");
  if (!payments?.length) throw new Error("payment_not_found");
  const card = payments.find((p) => p.provider === "stripe" && p.stripe_payment_intent_id);

  // 1. Card part back to the card.
  if (card) {
    await getStripe().refunds.create(
      { payment_intent: card.stripe_payment_intent_id!, metadata: { order_id: orderId } },
      { idempotencyKey: `refund-${orderId}` },
    );
  }

  // 2. Balances: buyer's balance part back, seller's sale reversed if credited.
  const { error: balanceError } = await admin.rpc("refund_order_balances", { p_order_id: orderId });
  if (balanceError) throw balanceError;

  // 3. Book-keeping.
  const now = new Date().toISOString();
  for (const p of payments) {
    await admin.from("payments").update({ status: "refunded", refunded_cents: p.amount_cents }).eq("id", p.id);
  }
  await admin
    .from("orders")
    .update({
      status: "refunded",
      refunded_at: now,
      cancelled_at: now,
      cancel_reason: reason,
      ...(order.disputed_at &&
        !order.dispute_resolved_at && { dispute_resolved_at: now, dispute_resolution: resolution ?? reason }),
    })
    .eq("id", orderId);
  await admin.from("listings").update({ status: "inactive" }).eq("id", order.listing_id).eq("status", "sold");
  await admin.from("notifications").insert([
    {
      user_id: order.buyer_id,
      type: "order_refunded",
      title: "Te reembolsamos tu compra",
      body: refundMessage(card ? card.amount_cents : 0, order.balance_applied_cents),
      link: `/orders/${orderId}`,
      data: { order_id: orderId },
    },
    {
      user_id: order.seller_id,
      type: "order_refunded",
      title: "Se reembolsó un pedido",
      body: reason,
      link: `/orders/${orderId}`,
      data: { order_id: orderId },
    },
  ]);
}

function refundMessage(cardCents: number, balanceCents: number) {
  if (cardCents && balanceCents)
    return `Regresamos ${formatPrice(balanceCents)} a tu saldo y ${formatPrice(cardCents)} a tu tarjeta (lo verás en unos días).`;
  if (balanceCents) return `Regresamos ${formatPrice(balanceCents)} a tu saldo.`;
  return "Verás el dinero en tu método de pago en unos días.";
}
