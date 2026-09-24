import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { processSellerPendingPayouts } from "./payouts";

export type PayoutStatus = "none" | "pending" | "active";

/** Seller can receive transfers once Stripe finished verification. */
export function payoutsReady(account: Stripe.Account) {
  return Boolean(account.details_submitted && account.payouts_enabled && account.capabilities?.transfers === "active");
}

export async function getPayoutAccount(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("private_profiles")
    .select("stripe_account_id, payouts_enabled")
    .eq("id", userId)
    .maybeSingle<{ stripe_account_id: string | null; payouts_enabled: boolean }>();
  return data ?? { stripe_account_id: null, payouts_enabled: false };
}

/** Refreshes `payouts_enabled` from Stripe and returns the resulting status. */
export async function syncPayoutStatus(userId: string): Promise<PayoutStatus> {
  const { stripe_account_id: accountId, payouts_enabled } = await getPayoutAccount(userId);
  if (!accountId) return "none";
  if (payouts_enabled) return "active";

  const account = await getStripe().accounts.retrieve(accountId);
  const ready = payoutsReady(account);
  if (ready) {
    await createAdminClient().from("private_profiles").update({ payouts_enabled: true }).eq("id", userId);
    // Money from sales completed before the seller finished setup.
    await processSellerPendingPayouts(userId);
  }
  return ready ? "active" : "pending";
}

/**
 * Creates (once) the seller's Stripe connected account. Express-style:
 * Stripe hosts onboarding and the seller dashboard; the platform pays fees
 * and carries negative-balance liability. The account only receives
 * transfers (the platform charges buyers: "separate charges and transfers").
 */
export async function ensureConnectedAccount(userId: string, email: string | null): Promise<string> {
  const { stripe_account_id } = await getPayoutAccount(userId);
  if (stripe_account_id) return stripe_account_id;

  const account = await getStripe().accounts.create(
    {
      country: "MX",
      email: email ?? undefined,
      controller: {
        fees: { payer: "application" },
        losses: { payments: "application" },
        requirement_collection: "stripe",
        stripe_dashboard: { type: "express" },
      },
      capabilities: { transfers: { requested: true } },
      business_type: "individual",
      metadata: { user_id: userId },
    },
    { idempotencyKey: `connect-account-${userId}` },
  );

  const { error } = await createAdminClient()
    .from("private_profiles")
    .update({ stripe_account_id: account.id, payouts_enabled: false })
    .eq("id", userId)
    .is("stripe_account_id", null);
  if (error) throw error;
  return account.id;
}
