import { NextResponse } from "next/server";
import { runOrderMaintenance } from "@/features/orders/completion";
import { backfillStripeFees } from "@/features/checkout/fees";
import { flushNotificationEmails } from "@/features/notifications/emails";

/**
 * Daily (vercel.json cron): auto-completes orders whose confirmation window
 * elapsed (which credits the sellers' balance). Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const orders = await runOrderMaintenance();
    // Sweep: anything a request didn't get to email (or that failed) goes now.
    const emails = await flushNotificationEmails(500);
    const fees = await backfillStripeFees();
    return NextResponse.json({ ...orders, emails, fees });
  } catch (err) {
    console.error("[cron] order maintenance failed", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
