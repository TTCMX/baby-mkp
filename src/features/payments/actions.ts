"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { ensureConnectedAccount } from "./payout-account";

/** Sends the seller to Stripe's hosted onboarding to set up payouts. */
export async function startPayoutOnboarding() {
  const user = await requireUser("/settings");
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;

  let url: string;
  try {
    const accountId = await ensureConnectedAccount(user.id, user.email);
    const link = await getStripe().accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${site}/settings/payouts?refresh=1`,
      return_url: `${site}/settings/payouts`,
    });
    url = link.url;
  } catch (err) {
    console.error("[payments] onboarding failed", err);
    redirect("/settings?payouts=error");
  }
  redirect(url);
}
