import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { syncPayoutStatus } from "@/features/payments/payout-account";

/** Return / refresh URL of Stripe onboarding: sync status and go back to settings. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/settings", request.url));

  let status = "pending";
  try {
    status = await syncPayoutStatus(user.id);
  } catch (err) {
    console.error("[payments] sync failed", err);
  }
  return NextResponse.redirect(new URL(`/settings?payouts=${status}`, request.url));
}
