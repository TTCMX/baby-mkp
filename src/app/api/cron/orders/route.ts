import { NextResponse } from "next/server";
import { runOrderMaintenance } from "@/features/payments/payouts";

/**
 * Daily (vercel.json cron): auto-completes orders whose confirmation window
 * elapsed and retries pending payouts. Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runOrderMaintenance());
  } catch (err) {
    console.error("[cron] order maintenance failed", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
