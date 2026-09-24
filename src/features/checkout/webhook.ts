import "server-only";
import type Stripe from "stripe";
import { track } from "@/lib/analytics/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe → our database. Every handler is idempotent (Stripe retries and may
 * deliver events more than once or out of order).
 */
export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.payment_status === "paid") await confirmPayment(session);
      return;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const orderId = event.data.object.metadata?.order_id;
      if (orderId) {
        await createAdminClient().rpc("cancel_pending_order", {
          p_order_id: orderId,
          p_reason: event.type === "checkout.session.expired" ? "checkout_expired" : "payment_failed",
        });
      }
      return;
    }
    default:
      return;
  }
}

async function confirmPayment(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId || !session.payment_intent) {
    console.warn("[webhook] session without order/payment intent", session.id);
    return;
  }
  const stripe = getStripe();
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge.balance_transaction"] });
  const charge = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  const balance = charge && typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;

  if (pi.currency !== "mxn") throw new Error(`Unexpected currency ${pi.currency} for order ${orderId}`);

  const admin = createAdminClient();
  const { data: result, error } = await admin.rpc("mark_order_paid", {
    p_order_id: orderId,
    p_payment_intent_id: pi.id,
    p_charge_id: charge?.id ?? null,
    p_amount_cents: pi.amount_received,
    p_fee_cents: balance?.fee ?? 0,
  });
  if (error) throw error;

  if (result === "needs_refund") {
    // Paid after the reservation was released (e.g. someone else bought it).
    await stripe.refunds.create(
      { payment_intent: pi.id, reason: "requested_by_customer", metadata: { order_id: orderId } },
      { idempotencyKey: `late-payment-refund-${pi.id}` },
    );
    await admin.from("payments").upsert(
      {
        order_id: orderId,
        stripe_payment_intent_id: pi.id,
        stripe_charge_id: charge?.id ?? null,
        amount_cents: pi.amount_received,
        refunded_cents: pi.amount_received,
        status: "refunded",
      },
      { onConflict: "stripe_payment_intent_id" },
    );
    console.warn("[webhook] late payment refunded", { orderId, paymentIntent: pi.id });
    return;
  }

  if (result === "paid") {
    const { data: order } = await admin
      .from("orders")
      .select("buyer_id, seller_id, listing_id, total_cents, platform_commission_cents")
      .eq("id", orderId)
      .single();
    if (order) {
      const props = { order_id: orderId, listing_id: order.listing_id, total_cents: order.total_cents };
      await Promise.all([
        track("payment_completed", order.buyer_id, props),
        track("order_created", order.buyer_id, { ...props, commission_cents: order.platform_commission_cents }),
        track("listing_sold", order.seller_id, props),
      ]);
    }
  }
}
