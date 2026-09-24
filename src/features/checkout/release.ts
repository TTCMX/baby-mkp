import "server-only";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Not a Server Action on purpose: `buyerId` must come from the verified
// session (the checkout page), never from the client.
/**
 * Buyer came back from Stripe without paying: release the reservation now
 * (instead of waiting 30 min) and expire the session so it can't be paid later.
 */
export async function releaseCheckout(orderId: string, buyerId: string) {
  if (!z.uuid().safeParse(orderId).success) return;
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, buyer_id, status, stripe_checkout_session_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.buyer_id !== buyerId || order.status !== "pending_payment") return;

  if (order.stripe_checkout_session_id) {
    try {
      await getStripe().checkout.sessions.expire(order.stripe_checkout_session_id);
    } catch (err) {
      // Already completed/expired: the webhook decides the outcome.
      console.warn("[checkout] could not expire session", err);
      return;
    }
  }
  await admin.rpc("cancel_pending_order", { p_order_id: orderId, p_reason: "buyer_cancelled" });
}
