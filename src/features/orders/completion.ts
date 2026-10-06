import "server-only";
import { track } from "@/lib/analytics/server";
import { createAdminClient } from "@/lib/supabase/admin";

// When an order becomes "completed" the database credits the seller's balance
// (trigger `orders_credit_seller`), whichever path completed it: buyer
// confirmation, the daily job, opening the order, or an admin.

/** Daily job: auto-complete delivered orders whose confirmation window elapsed. */
export async function runOrderMaintenance() {
  const { data: completed, error } = await createAdminClient().rpc("complete_due_orders");
  if (error) throw error;
  const completedIds = (completed ?? []) as string[];
  for (const id of completedIds) await trackCompletion(id);
  return { completed: completedIds.length };
}

export async function trackCompletion(orderId: string) {
  const { data: o } = await createAdminClient()
    .from("orders")
    .select("buyer_id, seller_id, total_cents, seller_net_cents")
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return;
  await track("order_completed", o.buyer_id, { order_id: orderId, seller_id: o.seller_id, total_cents: o.total_cents });
  await track("balance_credited", o.seller_id, { order_id: orderId, amount_cents: o.seller_net_cents });
}

/**
 * Completes a single delivered order if its confirmation window elapsed and
 * nobody reported a problem. Returns true if it completed.
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
  return true;
}
