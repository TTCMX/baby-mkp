import "server-only";
import { track } from "@/lib/analytics/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export type PayoutResult = "paid" | "waiting_seller_setup" | "not_eligible" | "failed";

/**
 * Releases the seller's money for a completed order: a Stripe transfer from
 * the platform balance to the seller's connected account ("separate charges
 * and transfers"). Safe to call repeatedly: one payout per order and an
 * idempotency key on the transfer. If the seller hasn't finished payout
 * setup, a pending payout is recorded and paid once they do.
 */
export async function processPayout(orderId: string): Promise<PayoutResult> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, seller_id, status, disputed_at, seller_net_cents, currency")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status !== "completed" || order.disputed_at) return "not_eligible";

  const { data: existing } = await admin
    .from("payouts")
    .select("id, status")
    .eq("order_id", orderId)
    .neq("status", "cancelled")
    .maybeSingle();
  if (existing?.status === "paid" || existing?.status === "in_transit") return "paid";

  let payoutId = existing?.id as string | undefined;
  if (!payoutId) {
    const { data: created, error } = await admin
      .from("payouts")
      .insert({
        order_id: orderId,
        seller_id: order.seller_id,
        amount_cents: order.seller_net_cents,
        currency: order.currency,
      })
      .select("id")
      .single();
    if (error) {
      // Unique per order: a concurrent call created it first.
      if (error.code === "23505") return processPayout(orderId);
      throw error;
    }
    payoutId = created.id;
  }

  const { data: seller } = await admin
    .from("private_profiles")
    .select("stripe_account_id, payouts_enabled")
    .eq("id", order.seller_id)
    .maybeSingle();
  if (!seller?.stripe_account_id || !seller.payouts_enabled) return "waiting_seller_setup";

  const { data: payment } = await admin
    .from("payments")
    .select("stripe_charge_id")
    .eq("order_id", orderId)
    .eq("status", "succeeded")
    .maybeSingle();

  try {
    const transfer = await getStripe().transfers.create(
      {
        amount: order.seller_net_cents,
        currency: order.currency.toLowerCase(),
        destination: seller.stripe_account_id,
        transfer_group: orderId,
        // Ties the transfer to the buyer's charge so it can go out before funds settle.
        ...(payment?.stripe_charge_id && { source_transaction: payment.stripe_charge_id }),
        metadata: { order_id: orderId, payout_id: payoutId! },
      },
      { idempotencyKey: `payout-${orderId}` },
    );
    await admin
      .from("payouts")
      .update({
        status: "paid",
        stripe_transfer_id: transfer.id,
        released_at: new Date().toISOString(),
        failure_reason: null,
      })
      .eq("id", payoutId!);
    await track("seller_payout", order.seller_id, { order_id: orderId, amount_cents: order.seller_net_cents });
    return "paid";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[payouts] transfer failed", orderId, message);
    await admin
      .from("payouts")
      .update({ status: "failed", failure_reason: message.slice(0, 500) })
      .eq("id", payoutId!);
    return "failed";
  }
}

/** Pays every pending/failed payout of a seller (e.g. right after they finish Stripe onboarding). */
export async function processSellerPendingPayouts(sellerId: string) {
  const { data } = await createAdminClient()
    .from("payouts")
    .select("order_id")
    .eq("seller_id", sellerId)
    .in("status", ["pending", "failed"]);
  for (const p of data ?? []) await processPayout(p.order_id);
}

/** Daily job: auto-complete due orders, then retry any payout not yet paid. */
export async function runOrderMaintenance() {
  const admin = createAdminClient();
  const { data: completed, error } = await admin.rpc("complete_due_orders");
  if (error) throw error;
  const completedIds = (completed ?? []) as string[];
  for (const id of completedIds) {
    await trackCompletion(id);
    await processPayout(id);
  }

  const { data: pending } = await admin.from("payouts").select("order_id").in("status", ["pending", "failed"]);
  const results: Record<string, number> = {};
  for (const p of pending ?? []) {
    const r = await processPayout(p.order_id);
    results[r] = (results[r] ?? 0) + 1;
  }
  return { completed: completedIds.length, payouts: results };
}

export async function trackCompletion(orderId: string) {
  const { data: o } = await createAdminClient()
    .from("orders")
    .select("buyer_id, seller_id, total_cents, created_at, completed_at")
    .eq("id", orderId)
    .maybeSingle();
  if (o)
    await track("order_completed", o.buyer_id, {
      order_id: orderId,
      seller_id: o.seller_id,
      total_cents: o.total_cents,
    });
}

/**
 * Completes a single delivered order if its confirmation window elapsed and
 * nobody reported a problem, then pays the seller. Returns true if it completed.
 */
export async function completeOrderIfDue(
  order: { id: string; status: string; disputed_at: string | null; delivered_at: string | null },
  autoCompleteDays: number,
): Promise<boolean> {
  if (order.status !== "delivered" || order.disputed_at || !order.delivered_at) return false;
  if (Date.now() - new Date(order.delivered_at).getTime() <= autoCompleteDays * 86_400_000) return false;
  const { data } = await createAdminClient().rpc("complete_due_orders", { p_order_id: order.id });
  if (!Array.isArray(data) || data.length === 0) return false;
  await trackCompletion(order.id);
  await processPayout(order.id);
  return true;
}
