import "server-only";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe sometimes hasn't settled the charge's balance transaction when the
 * payment webhook arrives, so the order is saved with a $0 fee (and an inflated
 * platform net). The daily job fills those in once Stripe has them.
 */
export async function backfillStripeFees(limit = 100): Promise<{ fixed: number }> {
  if (!isStripeConfigured()) return { fixed: 0 };
  const db = createAdminClient();
  const { data: orders, error } = await db
    .from("orders")
    .select("id, stripe_payment_intent_id, platform_net_cents")
    .eq("payment_fee_cents", 0)
    .not("stripe_payment_intent_id", "is", null)
    .in("status", ["paid", "in_delivery", "delivered", "completed"])
    .gte("paid_at", new Date(Date.now() - 45 * 86_400_000).toISOString())
    .limit(limit);
  if (error) throw error;

  let fixed = 0;
  for (const o of orders ?? []) {
    try {
      const pi = await getStripe().paymentIntents.retrieve(o.stripe_payment_intent_id!, {
        expand: ["latest_charge.balance_transaction"],
      });
      const charge = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
      const fee = charge && typeof charge.balance_transaction === "object" ? charge.balance_transaction?.fee : null;
      if (!fee) continue;
      const { error: updateError } = await db
        .from("orders")
        .update({ payment_fee_cents: fee, platform_net_cents: o.platform_net_cents - fee })
        .eq("id", o.id)
        .eq("payment_fee_cents", 0);
      if (updateError) throw updateError;
      await db.from("payments").update({ fee_cents: fee }).eq("stripe_payment_intent_id", pi.id);
      fixed++;
    } catch (err) {
      console.error("[fees] backfill failed", o.id, err);
    }
  }
  return { fixed };
}
