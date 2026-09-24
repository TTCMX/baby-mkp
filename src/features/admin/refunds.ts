import "server-only";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const REFUNDABLE = ["paid", "in_delivery", "delivered", "completed"];

/**
 * Full refund of an order to the buyer. If the seller was already paid, the
 * transfer is reversed (money comes back to the platform before refunding).
 * Idempotent per order. The listing goes to "inactive": the seller decides
 * whether to publish it again once they get the product back.
 */
export async function refundOrder(orderId: string, reason: string, resolution?: string) {
  const admin = createAdminClient();
  const stripe = getStripe();

  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) throw new Error("order_not_found");
  if (!REFUNDABLE.includes(order.status)) throw new Error("not_refundable");

  const { data: payment } = await admin
    .from("payments")
    .select("id, stripe_payment_intent_id, amount_cents")
    .eq("order_id", orderId)
    .eq("status", "succeeded")
    .maybeSingle();
  if (!payment?.stripe_payment_intent_id) throw new Error("payment_not_found");

  // 1. Take back the seller's money if it was already transferred.
  const { data: payout } = await admin
    .from("payouts")
    .select("id, status, stripe_transfer_id")
    .eq("order_id", orderId)
    .neq("status", "cancelled")
    .maybeSingle();
  if (payout?.stripe_transfer_id && (payout.status === "paid" || payout.status === "in_transit")) {
    await stripe.transfers.createReversal(
      payout.stripe_transfer_id,
      { metadata: { order_id: orderId } },
      { idempotencyKey: `reversal-${orderId}` },
    );
  }
  if (payout) await admin.from("payouts").update({ status: "cancelled" }).eq("id", payout.id);

  // 2. Refund the buyer.
  await stripe.refunds.create(
    { payment_intent: payment.stripe_payment_intent_id, metadata: { order_id: orderId } },
    { idempotencyKey: `refund-${orderId}` },
  );

  // 3. Book-keeping.
  const now = new Date().toISOString();
  await admin
    .from("payments")
    .update({ status: "refunded", refunded_cents: payment.amount_cents })
    .eq("id", payment.id);
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
      body: "Verás el dinero en tu método de pago en unos días.",
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
